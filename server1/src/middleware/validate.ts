import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

// express-validator natijalarini bir joyda tekshirish
// Har bir routes da takrorlamay, bitta middleware sifatida ishlatiladi
export const validate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation xatosi',
      errors: errors.array().map((e) => ({
        field: e.type === 'field' ? e.path : 'unknown',
        message: e.msg,
      })),
    });
  }
  next();
};
