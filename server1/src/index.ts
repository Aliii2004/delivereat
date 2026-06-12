import 'dotenv/config';
import { createServer } from 'http';
import app from './app';
import { initSocket } from './socket';
import { redisService } from './services/redis.service';
import { SurgeService } from './services/surge.service';

// ─── STARTUP ENV VALIDATION ────────────────────────────────
// Server ishga tushmasdan oldin muhim env larni tekshirish
const REQUIRED_ENV = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`✗ Muhim environment o'zgaruvchilar topilmadi: ${missing.join(', ')}`);
    process.exit(1);
  }

  // JWT_SECRET juda qisqa bo'lsa xavfli
  if ((process.env.JWT_SECRET?.length ?? 0) < 32) {
    console.error('✗ JWT_SECRET kamida 32 belgi bo\'lishi kerak');
    process.exit(1);
  }
}

validateEnv();

// ─── SERVER SETUP ──────────────────────────────────────────
const PORT = process.env.PORT || 4000;

const httpServer = createServer(app);
initSocket(httpServer);

// FIX: Surge monitoring global variable
let surgeMonitor: NodeJS.Timeout | null = null;

async function startServer() {
  try {
    await redisService.connect();
    console.log('✓ Redis connected');

    // FIX: Surge pricing monitoring ishga tushirish
    surgeMonitor = SurgeService.startSurgeMonitoring();
    console.log('✓ Surge pricing monitor started (5 min interval)');

    httpServer.listen(PORT, () => {
      console.log(`✓ Server 1 running on port ${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('✗ Server start failed:', error);
    process.exit(1);
  }
}

// ─── GRACEFUL SHUTDOWN ─────────────────────────────────────
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (surgeMonitor) clearInterval(surgeMonitor);
  await redisService.disconnect();
  httpServer.close(() => {
    console.log('✓ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  if (surgeMonitor) clearInterval(surgeMonitor);
  await redisService.disconnect();
  process.exit(0);
});

// ─── UNHANDLED ERRORS ──────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
