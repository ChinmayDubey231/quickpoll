import { Worker } from 'bullmq';
import Poll from '../models/Poll.js';
import { bullmqConnection } from '../config/bullmq.js';
import { getIO } from '../config/socket.js';

/**
 * startPollWorker — call once from index.js after setIO() has been called.
 *
 * Processes jobs on the "poll-expiry" queue. Each job was enqueued with a
 * delay of (expiresAt - Date.now()) ms when the poll was created, so the
 * worker fires at (approximately) the right moment.
 */
export const startPollWorker = () => {
  const worker = new Worker(
    'poll-expiry',
    async (job) => {
      const { pollId } = job.data;

      if (!pollId) {
        console.warn('⚠️  poll-expiry job missing pollId, skipping');
        return;
      }

      // Find the poll — it may already be manually closed or deleted
      const poll = await Poll.findById(pollId);

      if (!poll) {
        console.warn(`⚠️  poll-expiry: poll ${pollId} not found, skipping`);
        return;
      }

      if (!poll.isOpen) {
        console.log(`ℹ️  poll-expiry: poll ${pollId} already closed, skipping`);
        return;
      }

      // Close the poll in MongoDB
      poll.isOpen = false;
      await poll.save();

      console.log(`⏰ poll-expiry: closed poll ${pollId}`);

      // Notify all viewers currently watching this poll
      try {
        getIO().to(pollId).emit('poll-closed', { pollId });
      } catch (err) {
        // io not ready is non-fatal — poll is already closed in DB
        console.error(`⚠️  poll-expiry: could not emit poll-closed for ${pollId}:`, err.message);
      }
    },
    {
      connection: bullmqConnection,
      // Process one job at a time — polls close sequentially, no race conditions
      concurrency: 1,
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ poll-expiry job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ poll-expiry job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('❌ poll-expiry worker error:', err.message);
  });

  console.log('✅ BullMQ poll-expiry worker started');
  return worker;
};
