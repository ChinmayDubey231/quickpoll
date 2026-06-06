import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import connectDB from './config/db.js';
import { setIO } from './config/socket.js';

const app = express();
const httpServer = createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
// Create io, register with the shared accessor so controllers and workers
// can call getIO() without importing index.js (avoids circular ESM deps).
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});
setIO(io);

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
import authRoutes from './routes/auth.js';
import pollRoutes from './routes/polls.js';
import voteRoutes from './routes/votes.js';

app.use('/api/auth', authRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/votes', voteRoutes);

// ─── Socket.io handlers ───────────────────────────────────────────────────────
import { registerPollHandlers } from './socket/pollHandler.js';

io.on('connection', (socket) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🔌 socket connected: ${socket.id}`);
  }
  registerPollHandlers(io, socket);
});

// ─── BullMQ Worker ────────────────────────────────────────────────────────────
// Started after setIO() so getIO() is always safe inside the worker.
import { startPollWorker } from './workers/pollWorker.js';
startPollWorker();

// ─── Boot ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`   Socket.io  ✅`);
    console.log(`   BullMQ     ✅`);
  });
};

start();
