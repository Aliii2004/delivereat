import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { redisService } from '../services/redis.service';

// Express Request ga user qo'shish
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
        email: string;
      };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token topilmadi' });
    }

    const token = authHeader.split(' ')[1];

    // Redis blacklist tekshirish (logout qilingan tokenlar)
    const isBlacklisted = await redisService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token yaroqsiz' });
    }

    // JWT verify
    const payload = verifyAccessToken(token);
    req.user = payload;

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token noto\'g\'ri yoki muddati o\'tgan' });
  }
};

// Role tekshirish middleware
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Autentifikatsiya talab qilinadi' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Ruxsat yo\'q' });
    }
    next();
  };
};
