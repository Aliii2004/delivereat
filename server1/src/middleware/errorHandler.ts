import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
    // Stack trace to'g'ri ko'rinishi uchun
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Bizning custom xatolar
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Prisma xatolari — ishlab chiquvchiga foydali xabarlar
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        // Unique constraint — masalan email takrorlanishi
        return res.status(409).json({ message: 'Bu ma\'lumot allaqachon mavjud' });
      case 'P2025':
        // Record not found — update/delete da mavjud bo'lmasa
        return res.status(404).json({ message: 'Ma\'lumot topilmadi' });
      case 'P2003':
        // Foreign key constraint — bog'liq record mavjud emas
        return res.status(400).json({ message: 'Bog\'liq ma\'lumot topilmadi' });
      case 'P2014':
        // Required relation violation
        return res.status(400).json({ message: 'Majburiy bog\'liqlik buzildi' });
      default:
        console.error(`Prisma error [${err.code}]:`, err.message);
        return res.status(400).json({ message: 'Ma\'lumotlar bazasi xatosi' });
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ message: 'Noto\'g\'ri ma\'lumot formati' });
  }

  // JWT xatolari
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Token noto\'g\'ri' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token muddati tugagan' });
  }

  // Kutilmagan xatolar — production da stack trace ko'rsatmaslik
  console.error('Unhandled error:', err);
  return res.status(500).json({
    message: 'Server xatosi',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
