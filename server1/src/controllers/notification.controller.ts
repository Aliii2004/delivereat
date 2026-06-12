import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

// ─── NOTIFICATIONLAR RO'YXATI ──────────────────────────────

export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return res.json({
      notifications,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ─── O'QILGAN DEB BELGILASH ────────────────────────────────

export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user!.userId;

    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new AppError('Notification topilmadi', 404);
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return res.json({ message: 'O\'qilgan deb belgilandi' });
  } catch (error) {
    next(error);
  }
};

// ─── BARCHA O'QILGAN ───────────────────────────────────────

export const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return res.json({ message: 'Barcha notification o\'qilgan' });
  } catch (error) {
    next(error);
  }
};

// ─── NOTIFICATION O'CHIRISH ────────────────────────────────

export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user!.userId;

    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new AppError('Notification topilmadi', 404);
    }

    await prisma.notification.delete({ where: { id: notificationId } });

    return res.json({ message: 'Notification o\'chirildi' });
  } catch (error) {
    next(error);
  }
};

// ─── UNREAD COUNT ──────────────────────────────────────────

export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    return res.json({ count });
  } catch (error) {
    next(error);
  }
};
