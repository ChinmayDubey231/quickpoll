import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socket.js';

/**
 * Thin wrapper so controllers and workers can import `getIO()`
 * without creating a circular dependency on index.js.
 *
 * index.js calls setIO(io) once after creating the Server instance.
 * Everyone else calls getIO().
 */
type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

let _io: AppServer | null = null;

export const setIO = (io: AppServer): void => {
  _io = io;
};

export const getIO = (): AppServer => {
  if (!_io) throw new Error('Socket.io not initialised — call setIO(io) first');
  return _io;
};
