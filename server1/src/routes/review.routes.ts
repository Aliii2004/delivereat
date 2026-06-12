import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import * as reviewController from '../controllers/review.controller';

const router = Router();

// ─── REVIEW YARATISH ───────────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize('CUSTOMER'),
  [
    body('orderId').isUUID().withMessage('orderId UUID bo\'lishi kerak'),
    body('restaurantRating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating 1-5 orasida'),
    body('courierRating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating 1-5 orasida'),
    body('restaurantComment').optional().isLength({ max: 500 }),
    body('courierComment').optional().isLength({ max: 500 }),
  ],
  validate,
  reviewController.createReview
);

// ─── RESTORAN REVIEWLARI ───────────────────────────────────
router.get(
  '/restaurant/:restaurantId',
  [
    param('restaurantId').isUUID(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  reviewController.getRestaurantReviews
);

// ─── KURYER REVIEWLARI ─────────────────────────────────────
router.get(
  '/courier/:courierId',
  [
    param('courierId').isUUID(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  reviewController.getCourierReviews
);

export default router;
