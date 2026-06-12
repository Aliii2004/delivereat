import { Server as SocketServer } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt';
import { setIO } from '../lib/socket.instance';

export const initSocket = (httpServer: any) => {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ─── SOCKET AUTHENTICATION ────────────────────────────────

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Token topilmadi'));
      }

      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      socket.data.userId = payload.userId;
      socket.data.role = payload.role;

      next();
    } catch (error) {
      next(new Error('Token noto\'g\'ri'));
    }
  });

  // ─── CONNECTION HANDLER ───────────────────────────────────

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const role = socket.data.role;

    console.log(`✓ User connected: ${userId} (${role})`);

    // ─── JOIN ORDER ROOM ──────────────────────────────────────

    socket.on('join:order', async (orderId: string) => {
      try {
        if (!orderId) {
          socket.emit('error', { message: 'orderId talab qilinadi' });
          return;
        }

        socket.join(`order:${orderId}`);
        console.log(`✓ User ${userId} joined order:${orderId}`);
        socket.emit('join:success', { room: `order:${orderId}` });
      } catch (error) {
        socket.emit('error', { message: 'Xato yuz berdi' });
      }
    });

    // ─── JOIN RESTAURANT ROOM ────────────────────────────────

    socket.on('join:restaurant', async (restaurantId: string) => {
      try {
        if (role !== 'RESTAURANT_OWNER') {
          socket.emit('error', { message: 'Restoran egasiga mos ruxsat yo\'q' });
          return;
        }

        socket.join(`restaurant:${restaurantId}`);
        console.log(`✓ Restaurant owner ${userId} joined restaurant:${restaurantId}`);
        socket.emit('join:success', { room: `restaurant:${restaurantId}` });
      } catch (error) {
        socket.emit('error', { message: 'Xato yuz berdi' });
      }
    });

    // ─── JOIN ALL-ZONES (Courier) ────────────────────────────

    socket.on('join:all-zones', async () => {
      try {
        if (role !== 'COURIER') {
          socket.emit('error', { message: 'Kuryer roliga mos emas' });
          return;
        }

        socket.join('all-zones');
        console.log(`✓ Courier ${userId} joined all-zones`);
        socket.emit('join:success', { room: 'all-zones' });
      } catch (error) {
        socket.emit('error', { message: 'Xato yuz berdi' });
      }
    });

    // ─── JOIN USER ROOM (Notifications) ────────────────────

    socket.on('join:user', async () => {
      socket.join(`user:${userId}`);
      socket.emit('join:success', { room: `user:${userId}` });
    });

    // ─── COURIER LOCATION UPDATE ──────────────────────────────

    socket.on('courier:update-location', async (data: { lat: number; lng: number; orderId?: string }) => {
      try {
        if (role !== 'COURIER') {
          socket.emit('error', { message: 'Kuryer roliga mos emas' });
          return;
        }

        const { lat, lng, orderId } = data;

        if (typeof lat !== 'number' || typeof lng !== 'number') {
          socket.emit('error', { message: 'Koordinatalar noto\'g\'ri' });
          return;
        }

        // Broadcast faqat active order room ga
        if (orderId) {
          io.to(`order:${orderId}`).emit('courier:moved', {
            courierId: userId,
            latitude: lat,
            longitude: lng,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        socket.emit('error', { message: 'Xato yuz berdi' });
      }
    });

    // ─── DISCONNECT ────────────────────────────────────────

    socket.on('disconnect', () => {
      console.log(`✗ User disconnected: ${userId}`);
    });

    // ─── ERROR HANDLER ──────────────────────────────────────

    socket.on('error', (error) => {
      console.error(`Socket error for ${userId}:`, error);
    });
  });

  // Store Socket.io instance for use in controllers
  setIO(io);

  return io;
};