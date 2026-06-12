import { Server as SocketServer } from 'socket.io';

let ioInstance: SocketServer | null = null;

export const setIO = (io: SocketServer): void => {
  ioInstance = io;
};

export const getIO = (): SocketServer => {
  if (!ioInstance) {
    throw new Error('Socket.io initialized emas!');
  }
  return ioInstance;
};