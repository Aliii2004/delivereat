import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import * as courierController from '../controllers/courier.controller';

const router = Router();

// ─── KURYER HOLATI ─────────────────────────────────────────
router.patch(
  '/status',
  authenticate,
  authorize('COURIER'),
  [
    body('status')
      .isIn(['OFFLINE', 'AVAILABLE', 'BUSY'])
      .withMessage("Status: 'OFFLINE', 'AVAILABLE' yoki 'BUSY' bo'lishi kerak"),
  ],
  validate,
  courierController.updateStatus
);

// ─── GPS JOYLASHUV ─────────────────────────────────────────
router.patch(
  '/location',
  authenticate,
  authorize('COURIER'),
  [
    body('lat')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Kenglik (lat) -90 dan 90 gacha bo\'lishi kerak'),
    body('lng')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Uzunlik (lng) -180 dan 180 gacha bo\'lishi kerak'),
    body('orderId')
      .optional()
      .isUUID()
      .withMessage('orderId UUID formatida bo\'lishi kerak'),
  ],
  validate,
  courierController.updateLocation
);

// ─── MAVJUD KURYERLAR ──────────────────────────────────────
router.get(
  '/available',
  authenticate,
  authorize('ADMIN', 'RESTAURANT_OWNER'),
  courierController.getAvailableCouriers
);

// ─── KURYER PROFIL ─────────────────────────────────────────
router.get(
  '/profile',
  authenticate,
  authorize('COURIER'),
  courierController.getCourierProfile
);

// ─── TAYYOR BUYURTMALAR ────────────────────────────────────
// FIX: Kuryerlar uchun pickup qilish mumkin bo'lgan buyurtmalar
router.get(
  '/available-orders',
  authenticate,
  authorize('COURIER'),
  [
    query('lat').optional().isFloat({ min: -90, max: 90 }),
    query('lng').optional().isFloat({ min: -180, max: 180 }),
    query('radius').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  courierController.getAvailableOrders
);

export default router;
