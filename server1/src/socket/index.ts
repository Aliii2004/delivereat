import { Server as HTTPServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt';
import { redisService } from '../services/redis.service';
import { setIO } from '../lib/socket.instance';
import { prisma } from '../lib/prisma';

export const initSocket = (httpServer: HTTPServer): SocketServer => {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ─── AUTH MIDDLEWARE ──────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Token topilmadi'));

      const isBlacklisted = await redisService.isTokenBlacklisted(token);
      if (isBlacklisted) return next(new Error('Token yaroqsiz'));

      // FIX: verifyAccessToken JWT expiry ni tekshiradi va expired bo'lsa error throw qiladi
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch (error: any) {
      // JWT expired yoki invalid
      console.log('Socket auth error:', error.message);
      next(new Error('Autentifikatsiya xatosi: token yaroqsiz yoki muddati o\'tgan'));
    }
  });

  // ─── CONNECTION ───────────────────────────────────────────
  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`Socket connected: ${user.userId} (${user.role})`);

    // FIX: User o'z room iga qo'shiladi (notification uchun)
    socket.join(`user:${user.userId}`);

    // ── Barcha zones ga qo'shilish (surge alert uchun) ────────
    socket.on('join:all-zones', () => {
      if (user.role !== 'COURIER') {
        socket.emit('error', { message: 'Faqat kuryer zones ga qo\'shila oladi' });
        return;
      }
      socket.join('all-zones');
      console.log(`Courier ${user.userId} joined all-zones`);
    });

    // ── Buyurtma room ga qo'shilish ─────────────────────────
    // Production: foydalanuvchi shu buyurtmaga tegishliligini tekshirish
    socket.on('join:order', async (orderId: string) => {
      try {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: {
            customerId: true,
            courierId: true,
            restaurant: { select: { ownerId: true } },
          },
        });

        if (!order) {
          socket.emit('error', { message: 'Buyurtma topilmadi' });
          return;
        }

        const isCustomer = order.customerId === user.userId;
        const isCourier = order.courierId === user.userId;
        const isRestaurantOwner = order.restaurant?.ownerId === user.userId;
        const isAdmin = user.role === 'ADMIN';

        if (!isCustomer && !isCourier && !isRestaurantOwner && !isAdmin) {
          socket.emit('error', { message: 'Bu buyurtmaga ruxsat yo\'q' });
          return;
        }

        socket.join(`order:${orderId}`);
        socket.emit('joined:order', { orderId });
      } catch (err) {
        socket.emit('error', { message: 'Server xatosi' });
      }
    });

    // ── Restoran room ga qo'shilish ─────────────────────────
    // FIX: faqat shu restoranninng egasi kira oladi
    socket.on('join:restaurant', async (restaurantId: string) => {
      try {
        if (user.role !== 'RESTAURANT_OWNER') {
          socket.emit('error', { message: 'Ruxsat yo\'q' });
          return;
        }

        const restaurant = await prisma.restaurant.findFirst({
          where: { id: restaurantId, ownerId: user.userId },
          select: { id: true },
        });

        if (!restaurant) {
          socket.emit('error', { message: 'Bu restoran sizga tegishli emas' });
          return;
        }

        socket.join(`restaurant:${restaurantId}`);
        socket.emit('joined:restaurant', { restaurantId });
      } catch {
        socket.emit('error', { message: 'Server xatosi' });
      }
    });

    // ── Kuryer joylashuvini yangilash ───────────────────────
    socket.on('courier:location', async (data: { lat: number; lng: number; orderId?: string }) => {
      if (user.role !== 'COURIER') return;

      // Koordinatlar validatsiyasi
      const lat = Number(data.lat);
      const lng = Number(data.lng);

      if (
        isNaN(lat) || isNaN(lng) ||
        lat < -90 || lat > 90 ||
        lng < -180 || lng > 180
      ) {
        socket.emit('error', { message: 'Koordinatlar noto\'g\'ri' });
        return;
      }

      await redisService.setCourierLocation(user.userId, lat, lng);

      if (data.orderId) {
        socket.to(`order:${data.orderId}`).emit('courier:moved', {
          lat,
          lng,
          courierId: user.userId,
        });
      }

      await redisService.publish('order.events', {
        type: 'courier_location_updated',
        courierId: user.userId,
        orderId: data.orderId,
        lat,
        lng,
        timestamp: new Date().toISOString(),
      });
    });

    // ── Disconnect ──────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${user.userId}`);
    });
  });

  // Singleton ga saqlash — controllers shu orqali oladi
  setIO(io);

  return io;
};
