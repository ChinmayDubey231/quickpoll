import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../types/socket';

// Single shared socket instance for the whole app
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  // Socket.io lives at the server root; drop any trailing slash or /api suffix.
  (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000').replace(/\/+$/, '').replace(/\/api$/, ''),
  {
    autoConnect: false, // connect manually when needed (in PollView)
  }
);

export default socket;
