import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { getIO } from '../lib/socket.instance';

// ─── REVIEW YARATISH ───────────────────────────────────────
// Mijoz buyurtma yetkazilgandan keyin review qoldirishi mumkin

export const createReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId, restaurantRating, courierRating, restaurantComment, courierComment } = req.body;
    const customerId = req.user!.userId;

    // Order tekshirish
    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId, status: 'DELIVERED' },
      include: { restaurant: true, courier: true },
    });

    if (!order) {
      throw new AppError('Buyurtma topilmadi yoki hali yetkazilmagan', 404);
    }

    // Avval review qo'shilgan bo'lsa
    const existingReviews = await prisma.review.findMany({ where: { orderId } });
    const hasRestaurantReview = existingReviews.some(r => r.restaurantId === order.restaurantId);
    const hasCourierReview = existingReviews.some(r => r.courierId === order.courierId);

    if (restaurantRating && hasRestaurantReview) {
      throw new AppError('Restoran uchun allaqachon review qoldirilgan', 400);
    }

    if (courierRating && hasCourierReview) {
      throw new AppError('Kuryer uchun allaqachon review qoldirilgan', 400);
    }

    // Restoran review
    if (restaurantRating) {
      await prisma.review.create({
        data: {
          orderId,
          customerId,
          restaurantId: order.restaurantId,
          rating: restaurantRating,
          comment: restaurantComment,
        },
      });

      // Restoran rating ni yangilash
      const restaurantReviews = await prisma.review.findMany({
        where: { restaurantId: order.restaurantId },
      });
      const avgRating = restaurantReviews.reduce((sum, r) => sum + r.rating, 0) / restaurantReviews.length;
      
      await prisma.restaurant.update({
        where: { id: order.restaurantId },
        data: { 
          rating: Math.round(avgRating * 10) / 10,
          ratingCount: restaurantReviews.length,
        },
      });
    }

    // Kuryer review
    if (courierRating && order.courierId) {
      await prisma.review.create({
        data: {
          orderId,
          customerId,
          courierId: order.courierId,
          rating: courierRating,
          comment: courierComment,
        },
      });

      // Kuryer rating ni yangilash
      const courierReviews = await prisma.review.findMany({
        where: { courierId: order.courierId },
      });
      const avgRating = courierReviews.reduce((sum, r) => sum + r.rating, 0) / courierReviews.length;
      
      await prisma.courier.update({
        where: { userId: order.courierId },
        data: { rating: Math.round(avgRating * 10) / 10 },
      });
    }

    // Notification yuborish
    if (order.restaurant.ownerId) {
      await prisma.notification.create({
        data: {
          userId: order.restaurant.ownerId,
          type: 'REVIEW',
          title: 'Yangi baholash',
          message: `${restaurantRating} yulduz olindingiz`,
          data: JSON.stringify({ orderId, rating: restaurantRating }),
        },
      });
      
      getIO().to(`user:${order.restaurant.ownerId}`).emit('notification', {
        type: 'REVIEW',
        title: 'Yangi baholash',
        message: `${restaurantRating} yulduz olindingiz`,
      });
    }

    return res.status(201).json({ message: 'Review qo\'shildi', success: true });
  } catch (error) {
    next(error);
  }
};

// ─── RESTORAN REVIEWLARI ───────────────────────────────────

export const getRestaurantReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { restaurantId },
        include: {
          customer: { select: { name: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where: { restaurantId } }),
    ]);

    return res.json({
      reviews,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ─── KURYER REVIEWLARI ─────────────────────────────────────

export const getCourierReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courierId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { courierId },
        include: {
          customer: { select: { name: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where: { courierId } }),
    ]);

    return res.json({
      reviews,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};
