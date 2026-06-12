// Socket.io singleton — FAQAT browser da ishlatiladi
// SSR da hech qachon import qilinmasin

import Cookies from 'js-cookie';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let socket: any = null;

export const getSocket = () => {
  if (typeof window === 'undefined') return null;

  if (!socket) {
    // Dynamic import — SSR da bu blok ishlamaydi
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { io } = require('socket.io-client');
    const token = Cookies.get('accessToken');

    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket?.id);
    });
    
    socket.on('disconnect', (reason: string) => {
      console.log('Socket disconnected:', reason);
      // FIX: Auto reconnect da yangi token ishlatish
      if (reason !== 'io server disconnect' && reason !== 'io client disconnect') {
        const newToken = Cookies.get('accessToken');
        if (socket && newToken) {
          socket.auth = { token: newToken };
        }
      }
    });
    
    socket.on('connect_error', (err: Error) => {
      console.error('Socket connection error:', err.message);
      // Agar token muammosi bo'lsa, yangi token bilan retry
      if (err.message.includes('token') || err.message.includes('auth')) {
        const newToken = Cookies.get('accessToken');
        if (socket && newToken) {
          socket.auth = { token: newToken };
        }
      }
    });
    
    socket.on('error', (err: { message: string }) => {
      console.error('Socket error:', err.message);
    });
  }

  return socket;
};

export const reconnectSocketWithNewToken = (): void => {
  if (typeof window === 'undefined') return;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  getSocket();
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const joinOrderRoom = (orderId: string): void => {
  const s = getSocket();
  if (s) s.emit('join:order', orderId);
};

export const joinRestaurantRoom = (restaurantId: string): void => {
  const s = getSocket();
  if (s) s.emit('join:restaurant', restaurantId);
};

export const joinAllZones = (): void => {
  const s = getSocket();
  if (s) s.emit('join:all-zones');
};
