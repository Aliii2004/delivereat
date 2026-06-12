import { Router } from 'express';
import { param, query } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import * as notificationController from '../controllers/notification.controller';

const router = Router();

// ─── NOTIFICATIONLAR RO'YXATI ──────────────────────────────
router.get(
  '/',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  notificationController.getNotifications
);

// ─── UNREAD COUNT ──────────────────────────────────────────
router.get('/unread-count', authenticate, notificationController.getUnreadCount);

// ─── O'QILGAN DEB BELGILASH ────────────────────────────────
router.patch(
  '/:notificationId/read',
  authenticate,
  [param('notificationId').isUUID()],
  validate,
  notificationController.markAsRead
);

// ─── BARCHA O'QILGAN ───────────────────────────────────────
router.patch('/mark-all-read', authenticate, notificationController.markAllAsRead);

// ─── NOTIFICATION O'CHIRISH ────────────────────────────────
router.delete(
  '/:notificationId',
  authenticate,
  [param('notificationId').isUUID()],
  validate,
  notificationController.deleteNotification
);

export default router;
