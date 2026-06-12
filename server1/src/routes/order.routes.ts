import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import * as orderController from '../controllers/order.controller';

const router = Router();

// ─── BUYURTMA YARATISH ─────────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize('CUSTOMER'),
  [
    body('restaurantId').isUUID().withMessage('restaurantId UUID bo\'lishi kerak'),
    body('addressId').notEmpty().withMessage('addressId bo\'sh bo\'lmasin'),
    body('items').isArray({ min: 1 }).withMessage('Kamida bitta taom tanlang'),
    body('items.*.menuItemId').isUUID().withMessage('menuItemId UUID bo\'lishi kerak'),
    body('items.*.quantity')
      .isInt({ min: 1, max: 50 })
      .withMessage('Miqdor 1-50 orasida bo\'lishi kerak'),
    body('note').optional().isLength({ max: 300 }).withMessage('Izoh 300 belgidan oshmasin'),
  ],
  validate,
  orderController.createOrder
);

// ─── BUYURTMALAR RO'YXATI ──────────────────────────────────
router.get(
  '/',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  orderController.getMyOrders
);

// ─── BITTA BUYURTMA ────────────────────────────────────────
router.get(
  '/:orderId',
  authenticate,
  [param('orderId').isUUID()],
  validate,
  orderController.getOrder
);

// ─── RESTORAN HOLATLARI ────────────────────────────────────
router.patch(
  '/:orderId/accept',
  authenticate,
  authorize('RESTAURANT_OWNER'),
  [param('orderId').isUUID()],
  validate,
  orderController.acceptOrder
);

router.patch(
  '/:orderId/preparing',
  authenticate,
  authorize('RESTAURANT_OWNER'),
  [param('orderId').isUUID()],
  validate,
  orderController.markPreparing
);

router.patch(
  '/:orderId/ready',
  authenticate,
  authorize('RESTAURANT_OWNER'),
  [param('orderId').isUUID()],
  validate,
  orderController.markReady
);

// ─── KURYER HOLATLARI ─────────────────────────────────────
router.patch(
  '/:orderId/pickup',
  authenticate,
  authorize('COURIER'),
  [param('orderId').isUUID()],
  validate,
  orderController.pickupOrder
);

router.patch(
  '/:orderId/deliver',
  authenticate,
  authorize('COURIER'),
  [param('orderId').isUUID()],
  validate,
  orderController.deliverOrder
);

// ─── BEKOR QILISH ─────────────────────────────────────────
router.patch(
  '/:orderId/cancel',
  authenticate,
  [
    param('orderId').isUUID(),
    body('reason').optional().isLength({ max: 200 }),
  ],
  validate,
  orderController.cancelOrder
);

export default router;
