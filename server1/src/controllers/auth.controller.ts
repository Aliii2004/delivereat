import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getTokenExpiry,
} from '../lib/jwt';
import { redisService } from '../services/redis.service';
import { AppError } from '../middleware/errorHandler';

const DUMMY_PASSWORD_HASH = '$2b$12$rr3gEVtbLa1FrdQFymjHX.o4.I5ZwfB4YxMBwzjTan63OAwd5gqWi';

const hashRefreshToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

// ─── REGISTER ──────────────────────────────────────────────
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // validationResult OLIB TASHLANDI — routes da validate middleware bor
    const { email, password, name, phone, role = UserRole.CUSTOMER } = req.body;

    // ADMIN rolini API orqali o'rnatib bo'lmaydi — security
    const allowedRoles: UserRole[] = [
      UserRole.CUSTOMER,
      UserRole.RESTAURANT_OWNER,
      UserRole.COURIER,
    ];
    if (!allowedRoles.includes(role)) {
      throw new AppError("Bu role uchun ro'yxatdan o'tib bo'lmaydi", 403);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError("Bu email allaqachon ro'yxatdan o'tgan", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // FIX: Prisma P2002 error handling (unique constraint violation)
    let user;
    try {
      user = await prisma.user.create({
        data: { email, password: hashedPassword, name, phone, role },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new AppError("Bu email allaqachon ro'yxatdan o'tgan", 409);
      }
      throw error;
    }

    const payload = { userId: user.id, role: user.role, email: user.email };
    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await redisService.set(`refresh:${user.id}`, hashRefreshToken(refreshToken), 7 * 24 * 60 * 60);

    return res.status(201).json({ user, accessToken, refreshToken });
  } catch (error) {
    next(error);
  }
};

// ─── LOGIN ─────────────────────────────────────────────────
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    // user topilmasa va parol noto'g'ri bo'lsa bir xil xato — timing attack oldini olish
    if (!user || !user.isActive) {
      // Hash comparison qilmasdan qaytish timing attack uchun ochiq bo'ladi
      // Shu sababli dummy compare qilamiz
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new AppError("Email yoki parol noto'g'ri", 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError("Email yoki parol noto'g'ri", 401);
    }

    const payload = { userId: user.id, role: user.role, email: user.email };
    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await redisService.set(`refresh:${user.id}`, hashRefreshToken(refreshToken), 7 * 24 * 60 * 60);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

// ─── REFRESH TOKEN ─────────────────────────────────────────
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError('Refresh token topilmadi', 400);
    }

    const payload = verifyRefreshToken(refreshToken);

    const stored = await redisService.get(`refresh:${payload.userId}`);
    const hashedIncomingToken = hashRefreshToken(refreshToken);
    if (stored !== hashedIncomingToken) {
      if (stored !== refreshToken) {
        throw new AppError('Refresh token yaroqsiz', 401);
      }
      // Legacy plain token saqlangan bo'lsa, bir martalik migratsiya qilib hash ko'rinishga o'tkazamiz
      console.warn(`Legacy refresh token upgraded for user ${payload.userId}`);
      await redisService.set(
        `refresh:${payload.userId}`,
        hashedIncomingToken,
        7 * 24 * 60 * 60
      );
    }

    const newPayload = {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
    };
    const newAccessToken  = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    await redisService.set(
      `refresh:${payload.userId}`,
      hashRefreshToken(newRefreshToken),
      7 * 24 * 60 * 60
    );

    return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    next(error);
  }
};

// ─── LOGOUT ────────────────────────────────────────────────
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (token) {
      const ttl = getTokenExpiry(token);
      if (ttl > 0) {
        await redisService.blacklistToken(token, ttl);
      }
    }

    if (req.user?.userId) {
      await redisService.del(`refresh:${req.user.userId}`);
    }

    return res.json({ message: 'Muvaffaqiyatli chiqildi' });
  } catch (error) {
    next(error);
  }
};

// ─── GET ME ────────────────────────────────────────────────
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, email: true, name: true,
        phone: true, role: true, avatar: true, createdAt: true,
        addresses: {
          select: {
            id: true, label: true, street: true,
            city: true, latitude: true, longitude: true, isDefault: true,
          },
          orderBy: { isDefault: 'desc' },
        },
      },
    });

    if (!user) throw new AppError('Foydalanuvchi topilmadi', 404);
    return res.json({ user });
  } catch (error) {
    next(error);
  }
};

// ─── UPDATE PROFILE ────────────────────────────────────────
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, phone } = req.body;
    const updateData: Record<string, unknown> = {};
    if (name  !== undefined) updateData.name  = name;
    if (phone !== undefined) updateData.phone = phone;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: updateData,
      select: { id: true, email: true, name: true, phone: true, role: true, avatar: true },
    });
    return res.json({ user });
  } catch (error) {
    next(error);
  }
};
