import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler';

// Routes import
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import orderRoutes from './routes/order.routes';
import courierRoutes from './routes/courier.routes';
import addressRoutes from './routes/address.routes';
import reviewRoutes from './routes/review.routes';
import notificationRoutes from './routes/notification.routes';
import internalRoutes from './routes/internal.routes';

const app = express();

// ─── MIDDLEWARE ────────────────────────────────────────────

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  })
);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── ROUTES ────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/couriers', courierRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/internal', internalRoutes);

// ─── HEALTH CHECK ──────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'server1',
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 HANDLER ───────────────────────────────────────────

app.use('*', (_req: Request, res: Response) => {
  res.status(404).json({ message: 'Rout topilmadi' });
});

// ─── ERROR HANDLER ─────────────────────────────────────────

app.use(errorHandler);

export default app;