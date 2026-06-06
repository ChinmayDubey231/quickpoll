import { Queue } from "bullmq";
import Redis from "ioredis";

export const bullmqConnection = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },
);

export const pollExpiryQueue = new Queue("poll-expiry", {
  connection: bullmqConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
});

console.log("✅ BullMQ queue initialised");
