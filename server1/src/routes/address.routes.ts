import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import * as addressController from '../controllers/address.controller';

const router = Router();

router.get('/', authenticate, addressController.getAddresses);

router.post(
  '/',
  authenticate,
  [
    body('label').optional().trim().isLength({ max: 50 }),
    body('street').trim().notEmpty().withMessage('Ko\'cha kiritilmadi'),
    body('city').optional().trim(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('isDefault').optional().isBoolean(),
  ],
  validate,
  addressController.createAddress
);

router.patch(
  '/:addressId',
  authenticate,
  [
    param('addressId').isUUID(),
    body('label').optional().trim().isLength({ max: 50 }),
    body('street').optional().trim().notEmpty(),
    body('city').optional().trim(),
    body('isDefault').optional().isBoolean(),
  ],
  validate,
  addressController.updateAddress
);

router.delete(
  '/:addressId',
  authenticate,
  [param('addressId').isUUID()],
  validate,
  addressController.deleteAddress
);

router.patch(
  '/:addressId/default',
  authenticate,
  [param('addressId').isUUID()],
  validate,
  addressController.setDefaultAddress
);

export default router;
