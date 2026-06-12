import { Request, Response, NextFunction } from 'express';
import { CourierStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { redisService } from '../services/redis.service';
import { AppError } from '../middleware/errorHandler';
import { getIO } from '../lib/socket.instance';

// ─── KURYER HOLATI YANGILASH ───────────────────────────────

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body as { status: CourierStatus };

    if (status === CourierStatus.BUSY) {
      throw new AppError("BUSY holatini to'g'ridan o'rnatib bo'lmaydi", 400);
    }

    // upsert — profil bo'lmasa avtomatik yaratadi
    const courier = await prisma.courier.upsert({
      where: { userId: req.user!.userId },
      update: { status },
      create: { userId: req.user!.userId, status, vehicleType: 'bike' },
      select: { id: true, userId: true, status: true },
    });
    return res.json({ courier });
  } catch (error) { next(error); }
};

// ─── GPS JOYLASHUV YANGILASH ───────────────────────────────

export const updateLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, orderId } = req.body as {
      lat: number;
      lng: number;
      orderId?: string;
    };
    const courierId = req.user!.userId;

    // Redis da saqlash (PostgreSQL ga yozmaslik — tez o'zgaradi)
    await redisService.setCourierLocation(courierId, lat, lng);

    if (orderId) {
      getIO().to(`order:${orderId}`).emit('courier:moved', { lat, lng, courierId });
    }

    return res.json({ success: true });
  } catch (error) { next(error); }
};

// ─── MAVJUD KURYERLAR ─────────────────────────────────────

export const getAvailableCouriers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const couriers = await prisma.courier.findMany({
      where: { status: CourierStatus.AVAILABLE }, // FIX: enum ishlatildi
      include: { user: { select: { name: true, phone: true } } },
    });

    // Redis dan joylashuv parallel olish
    const couriersWithLocation = await Promise.all(
      couriers.map(async (c) => {
        const location = await redisService.getCourierLocation(c.userId);
        return { ...c, location };
      })
    );

    return res.json({ couriers: couriersWithLocation });
  } catch (error) { next(error); }
};

// ─── KURYER PROFIL ────────────────────────────────────────

export const getCourierProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // upsert — profil bo'lmasa avtomatik yaratadi
    const courier = await prisma.courier.upsert({
      where: { userId: req.user!.userId },
      update: {},
      create: { userId: req.user!.userId, vehicleType: 'bike', status: 'OFFLINE' },
      include: { user: { select: { name: true, email: true, phone: true, avatar: true } } },
    });
    return res.json({ courier });
  } catch (error) { next(error); }
};

// ─── TAYYOR BUYURTMALAR (KURYER UCHUN) ────────────────────
// FIX: Kuryerlar uchun mavjud buyurtmalar ro'yxati

export const getAvailableOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, radius } = req.query as {
      lat?: string;
      lng?: string;
      radius?: string;
    };
    const radiusKm = radius ? parseFloat(radius) : 10;

    // Faqat READY holatidagi buyurtmalar
    const orders = await prisma.order.findMany({
      where: { status: 'READY' },
      include: {
        restaurant: { select: { name: true, address: true, latitude: true, longitude: true, phone: true } },
        items: { include: { menuItem: { select: { name: true } } } },
        address: { select: { street: true, city: true, latitude: true, longitude: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    // Agar kuryer koordinatalari berilgan bo'lsa, masofaga qarab filter qilish
    if (lat && lng) {
      const courierLat = parseFloat(lat);
      const courierLng = parseFloat(lng);

      if (!isNaN(courierLat) && !isNaN(courierLng)) {
        const filteredOrders = orders.filter((order) => {
          const restLat = order.restaurant.latitude;
          const restLng = order.restaurant.longitude;
          // Agar restoran koordinatasi null bo'lsa — hamma joyga ko'rsatamiz
          if (!restLat || !restLng) return true;
          const distance = calculateDistance(courierLat, courierLng, restLat, restLng);
          return distance <= radiusKm;
        });
        return res.json({ orders: filteredOrders });
      }
    }

    // lat/lng berilmasa yoki noto'g'ri bo'lsa — barchasini qaytaramiz
    return res.json({ orders });
  } catch (error) { next(error); }
};

// Haversine formula — ikki nuqta orasidagi masofa (km)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Yer radiusi (km)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
