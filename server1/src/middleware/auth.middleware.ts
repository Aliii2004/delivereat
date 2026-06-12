import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { redisService } from '../services/redis.service';
import { AppError } from './errorHandler';

// ─── JWT PAYLOAD EXTENSION ─────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
        email: string;
      };
    }
  }
}

// ─── AUTHENTICATE: TOKEN VERIFY ────────────────────────────
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Token topilmadi', 401);
    }

    const token = authHeader.split(' ')[1];

    // Blacklist tekshirish (logout qilinganmi?)
    const isBlacklisted = await redisService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new AppError('Token bekor qilindi', 401);
    }

    // Token verify
    const payload = verifyAccessToken(token);
    req.user = payload;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(401).json({ message: 'Token noto\'g\'ri' });
  }
};

// ─── AUTHORIZE: ROLE CHECK ─────────────────────────────────
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Token topilmadi' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Bu operatsiyaga ruxsat yo\'q' });
    }

    next();
  };
};