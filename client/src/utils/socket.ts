import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../types/socket';

// Single shared socket instance for the whole app
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
  {
    autoConnect: false, // connect manually when needed (in PollView)
  }
);

export default socket;
