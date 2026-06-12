import { Server as SocketServer } from 'socket.io';

// Circular dependency muammosini hal qiladi.
// order.controller, courier.controller va boshqalar
// shu fayldan import qiladi — index.ts dan emas.
let io: SocketServer;

export const setIO = (instance: SocketServer) => {
  io = instance;
};

export const getIO = (): SocketServer => {
  if (!io) throw new Error('Socket.io hali ishga tushmagan');
  return io;
};
