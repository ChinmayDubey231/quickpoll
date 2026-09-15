import { Worker, type Job } from 'bullmq';
import Poll from '../models/Poll.js';
import { bullmqConnection, type PollExpiryJobData } from '../config/bullmq.js';
import { finalizePollClose } from '../controllers/pollController.js';

/**
 * startPollWorker — call once from index.js after setIO() has been called.
 *
 * Processes jobs on the "poll-expiry" queue. Each job was enqueued with a
 * delay of (expiresAt - Date.now()) ms when the poll was created, so the
 * worker fires at (approximately) the right moment.
 */
export const startPollWorker = () => {
  const worker = new Worker<PollExpiryJobData>(
    'poll-expiry',
    async (job: Job<PollExpiryJobData>) => {
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

      try {
        await finalizePollClose(poll);
        console.log(`⏰ poll-expiry: closed poll ${pollId}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`⚠️  poll-expiry: could not finalize poll ${pollId}:`, message);
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
