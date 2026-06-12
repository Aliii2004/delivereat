import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import orderRoutes from './routes/order.routes';
import courierRoutes from './routes/courier.routes';
import addressRoutes from './routes/address.routes';
import internalRoutes from './routes/internal.routes';
import reviewRoutes from './routes/review.routes';
import notificationRoutes from './routes/notification.routes';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './lib/prisma';
import { redisService } from './services/redis.service';

const app = express();

// ─── SECURITY ──────────────────────────────────────────────
app.use(helmet());

// ─── CORS ──────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── BODY PARSER ───────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── LOGGING ───────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined'));
  } else {
    app.use(morgan('dev'));
  }
}

// ─── HEALTH CHECK ──────────────────────────────────────────
// FIX: Database va Redis connectivity check qo'shildi
app.get('/api/health', async (_req, res) => {
  const health: any = {
    status: 'ok',
    service: 'server1',
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = 'ok';
  } catch (error) {
    health.status = 'degraded';
    health.checks.database = 'error';
  }

  // Redis check
  try {
    await redisService.get('health:check');
    health.checks.redis = 'ok';
  } catch (error) {
    health.status = 'degraded';
    health.checks.redis = 'error';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// ─── ROUTES ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/couriers', courierRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);

// Internal: faqat Docker network ichidan (S2 dan keladi)
app.use('/internal', internalRoutes);

// ─── ERROR HANDLER (oxirida bo'lishi shart) ────────────────
app.use(errorHandler);

export default app;
