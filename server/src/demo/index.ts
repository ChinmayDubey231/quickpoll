import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Poll from '../models/Poll.js';
import Vote from '../models/Vote.js';
import Comment from '../models/Comment.js';
import Reaction from '../models/Reaction.js';
import redis from '../config/redis.js';
import { pollExpiryQueue } from '../config/bullmq.js';
import { DEMO_PASSWORD, DEMO_USERS } from './content.js';
import { buildDemoData } from './generate.js';

export { DEMO_PASSWORD, DEMO_USERS };

// Inserts the demo users, polls, votes, comments and reactions, syncs the
// Redis live counters and schedules auto-close jobs. Assumes the collections
// are empty — callers decide whether to wipe first.
export const seedDemoData = async () => {
  const now = Date.now();
  const data = buildDemoData(now);
  const password = await bcrypt.hash(DEMO_PASSWORD, 12);

  // timestamps: false keeps the generated createdAt values — the analytics
  // timeline and Discover sorting depend on them.
  const noTimestamps = { timestamps: false };
  await User.insertMany(data.users.map((u) => ({ ...u, password })), noTimestamps);
  await Poll.insertMany(data.polls, noTimestamps);
  await Vote.insertMany(data.votes, noTimestamps);
  await Comment.insertMany(data.comments, noTimestamps);
  await Reaction.insertMany(data.reactions, noTimestamps);

  const pipeline = redis.pipeline();
  for (const { pollId, counts, ballots, reactions } of data.live) {
    const countsKey = `poll::${pollId}::counts`;
    const ballotsKey = `poll::${pollId}::ballots`;
    const reactionsKey = `poll::${pollId}::reactions`;
    pipeline.del(countsKey, ballotsKey, reactionsKey);
    pipeline.hset(countsKey, Object.fromEntries(counts.map((c, i) => [String(i), c])));
    pipeline.set(ballotsKey, ballots);
    if (Object.keys(reactions).length) pipeline.hset(reactionsKey, reactions);
  }
  await pipeline.exec();

  // Schedule auto-close for open polls with a deadline, same as createPoll
  for (const poll of data.polls) {
    if (!poll.isOpen || !poll.expiresAt) continue;
    const delay = poll.expiresAt.getTime() - now;
    if (delay > 0) {
      await pollExpiryQueue.add('close-poll', { pollId: poll._id.toString() }, { delay });
    }
  }

  return {
    users: data.users.length,
    polls: data.polls.length,
    votes: data.votes.length,
    comments: data.comments.length,
    reactions: data.reactions.length,
  };
};

// Seeds demo data on boot only when the database has no users, so a fresh
// deployment has something to show and real data is never touched.
// Set SEED_DEMO_DATA=false to opt out.
export const seedDemoDataIfEmpty = async (): Promise<void> => {
  if (process.env.SEED_DEMO_DATA === 'false') return;
  if ((await User.estimatedDocumentCount()) > 0) return;

  console.log('🌱 Empty database — seeding demo data...');
  const summary = await seedDemoData();
  console.log(
    `✅ Demo data seeded: ${summary.polls} polls, ${summary.votes} votes ` +
      `(login: ${DEMO_USERS[0].email} / ${DEMO_PASSWORD})`
  );
};
