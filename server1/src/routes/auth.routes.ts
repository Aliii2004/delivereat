import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';

const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Email noto\'g\'ri'),
    body('password').isLength({ min: 6 }).withMessage('Parol kamida 6 ta belgi'),
    body('name').trim().notEmpty().withMessage('Ism kiritilmadi'),
    body('phone').optional().isMobilePhone('any'),
    body('role')
      .optional()
      .isIn(['CUSTOMER', 'RESTAURANT_OWNER', 'COURIER'])
      .withMessage('Role noto\'g\'ri'),
  ],
  validate,
  authController.register
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Email noto\'g\'ri'),
    body('password').notEmpty().withMessage('Parol kiritilmadi'),
  ],
  validate,
  authController.login
);

router.post('/refresh', authController.refreshToken);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.patch('/profile', authenticate, authController.updateProfile);

export default router;
