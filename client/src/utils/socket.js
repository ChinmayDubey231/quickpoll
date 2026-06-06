import { io } from 'socket.io-client';

// Single shared socket instance for the whole app
const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
  autoConnect: false, // connect manually when needed (in PollView)
});

export default socket;
