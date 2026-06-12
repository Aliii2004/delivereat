import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import * as menuController from '../controllers/menu.controller';

const router = Router();

// ─── PUBLIC ────────────────────────────────────────────────
router.get(
  '/restaurants',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  menuController.getRestaurants
);

router.get(
  '/restaurants/:restaurantId',
  [param('restaurantId').isUUID()],
  validate,
  menuController.getRestaurant
);

router.get(
  '/restaurants/:restaurantId/menu',
  [param('restaurantId').isUUID()],
  validate,
  menuController.getMenu
);

// ─── RESTAURANT OWNER — O'Z RESTORANLARI ───────────────────
router.get(
  '/my-restaurant',
  authenticate,
  authorize('RESTAURANT_OWNER'),
  menuController.getMyRestaurant
);

router.get(
  '/my-items',
  authenticate,
  authorize('RESTAURANT_OWNER'),
  menuController.getMyMenuItems
);

router.post(
  '/categories',
  authenticate,
  authorize('RESTAURANT_OWNER'),
  [body('name').trim().notEmpty().isLength({ max: 50 })],
  validate,
  menuController.createCategory
);

router.delete(
  '/categories/:categoryId',
  authenticate,
  authorize('RESTAURANT_OWNER'),
  [param('categoryId').isUUID()],
  validate,
  menuController.deleteCategory
);


router.post(
  '/items',
  authenticate,
  authorize('RESTAURANT_OWNER'),
  [
    body('name').trim().notEmpty().isLength({ max: 100 }),
    body('price').isFloat({ min: 0 }).withMessage('Narx musbat son bo\'lishi kerak'),
    body('description').optional().isLength({ max: 500 }),
    body('categoryId').optional().isUUID(),
    body('preparationTime').optional().isInt({ min: 1, max: 180 }),
  ],
  validate,
  menuController.createMenuItem
);

router.patch(
  '/items/:itemId',
  authenticate,
  authorize('RESTAURANT_OWNER'),
  [
    param('itemId').isUUID(),
    body('name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('price').optional().isFloat({ min: 0 }),
    body('isAvailable').optional().isBoolean(),
    body('preparationTime').optional().isInt({ min: 1, max: 180 }),
  ],
  validate,
  menuController.updateMenuItem
);

router.delete(
  '/items/:itemId',
  authenticate,
  authorize('RESTAURANT_OWNER'),
  [param('itemId').isUUID()],
  validate,
  menuController.deleteMenuItem
);

router.patch(
  '/restaurant/status',
  authenticate,
  authorize('RESTAURANT_OWNER'),
  [
    body('status')
      .isIn(['OPEN', 'CLOSED', 'BUSY'])
      .withMessage("Status: 'OPEN', 'CLOSED' yoki 'BUSY' bo'lishi kerak"),
  ],
  validate,
  menuController.updateRestaurantStatus
);

export default router;
