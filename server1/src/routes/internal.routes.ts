import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { getIO } from '../lib/socket.instance';
import { validate } from '../middleware/validate';

const router = Router();

// ─── INTERNAL IP GUARD ─────────────────────────────────────
// FIX: Shared secret bilan xavfsizlik
const internalOnly = (req: Request, res: Response, next: Function) => {
  const secret = req.headers['x-internal-secret'] as string;
  const expectedSecret = process.env.INTERNAL_API_SECRET;

  if (!expectedSecret) {
    console.error('INTERNAL_API_SECRET environment variable not set');
    return res.status(500).json({ message: 'Internal configuration error' });
  }

  if (secret !== expectedSecret) {
    console.warn('Unauthorized internal API access attempt');
    return res.status(403).json({ message: 'Forbidden' });
  }
  
  next();
};

// ─── S2 → S1: Surge alert ─────────────────────────────────
// S2 (FastAPI) buyurtmalar ko'payganini aniqlaydi → S1 kuryerlarga xabar beradi
router.post(
  '/surge-alert',
  internalOnly,
  [
    body('zone').notEmpty().isString().withMessage('zone talab qilinadi'),
    body('message').notEmpty().isString().isLength({ max: 200 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { zone, message } = req.body as { zone: string; message: string };

      getIO().to(`zone:${zone}`).emit('surge:alert', {
        message,
        zone,
        timestamp: new Date().toISOString(),
      });

      return res.json({ success: true });
    } catch {
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

export default router;
