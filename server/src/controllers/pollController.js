import Poll from '../models/Poll.js';
import Vote from '../models/Vote.js';
import redis from '../config/redis.js';
import { pollExpiryQueue } from '../config/bullmq.js';
import { getIO } from '../config/socket.js';

// ─── Helper ────────────────────────────────────────────────────────────────────
// Attach live vote counts (from Redis) to an array of polls
const attachCounts = async (polls) => {
  return Promise.all(
    polls.map(async (poll) => {
      const key = `poll::${poll._id}::counts`;
      const raw = await redis.hgetall(key);
      const counts = poll.options.map((_, i) => ({
        optionIndex: i,
        count: parseInt(raw?.[String(i)] || '0', 10),
      }));
      const totalVotes = counts.reduce((s, c) => s + c.count, 0);
      return { ...poll.toObject(), counts, totalVotes };
    })
  );
};

// ─── GET /api/polls ────────────────────────────────────────────────────────────
// Returns the authenticated creator's polls with vote counts
export const getMyPolls = async (req, res) => {
  const polls = await Poll.find({ creatorId: req.user._id }).sort({ createdAt: -1 });
  const withCounts = await attachCounts(polls);
  res.json(withCounts);
};

// ─── POST /api/polls ───────────────────────────────────────────────────────────
export const createPoll = async (req, res) => {
  const { question, options, expiresAt } = req.body;

  if (!question || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ message: 'Question and at least 2 options are required' });
  }
  if (options.length > 6) {
    return res.status(400).json({ message: 'Maximum 6 options allowed' });
  }

  const optionDocs = options.map((text) => ({ text: String(text).trim() }));

  const poll = await Poll.create({
    creatorId: req.user._id,
    question: question.trim(),
    options: optionDocs,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  });

  // Schedule auto-close job if poll has an expiry
  if (expiresAt) {
    const delay = new Date(expiresAt).getTime() - Date.now();
    if (delay > 0) {
      await pollExpiryQueue.add(
        'close-poll',
        { pollId: poll._id.toString() },
        { delay }
      );
    }
  }

  res.status(201).json(poll);
};

// ─── GET /api/polls/:id ────────────────────────────────────────────────────────
// Public — no auth required
export const getPoll = async (req, res) => {
  const poll = await Poll.findById(req.params.id);
  if (!poll) return res.status(404).json({ message: 'Poll not found' });

  const key = `poll::${poll._id}::counts`;
  const raw = await redis.hgetall(key);
  const counts = poll.options.map((_, i) => ({
    optionIndex: i,
    count: parseInt(raw?.[String(i)] || '0', 10),
  }));

  res.json({ ...poll.toObject(), counts });
};

// ─── PATCH /api/polls/:id/close ────────────────────────────────────────────────
export const closePoll = async (req, res) => {
  const poll = await Poll.findOne({ _id: req.params.id, creatorId: req.user._id });
  if (!poll) return res.status(404).json({ message: 'Poll not found' });
  if (!poll.isOpen) return res.status(400).json({ message: 'Poll is already closed' });

  poll.isOpen = false;
  await poll.save();

  // Notify all viewers in the socket room
  getIO().to(poll._id.toString()).emit('poll-closed', { pollId: poll._id.toString() });

  res.json({ message: 'Poll closed', poll });
};

// ─── DELETE /api/polls/:id ─────────────────────────────────────────────────────
export const deletePoll = async (req, res) => {
  const poll = await Poll.findOneAndDelete({ _id: req.params.id, creatorId: req.user._id });
  if (!poll) return res.status(404).json({ message: 'Poll not found' });

  // Clean up Redis counts
  await redis.del(`poll::${poll._id}::counts`);

  // Remove associated votes
  await Vote.deleteMany({ pollId: poll._id });

  res.json({ message: 'Poll deleted' });
};

// ─── GET /api/polls/:id/analytics ─────────────────────────────────────────────
// Creator only — timeline data, peak minute, unique voter count
export const getPollAnalytics = async (req, res) => {
  const poll = await Poll.findById(req.params.id);
  if (!poll) return res.status(404).json({ message: 'Poll not found' });

  if (poll.creatorId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const votes = await Vote.find({ pollId: poll._id }).sort({ createdAt: 1 });
  const totalVotes = votes.length;

  // Unique voters by fingerprint (those that have one)
  const uniqueFingerprints = new Set(
    votes.map((v) => v.voterFingerprint).filter(Boolean)
  );
  const uniqueVoters = uniqueFingerprints.size || totalVotes;

  // Build 15-minute bucket timeline using MongoDB aggregation
  const timeline = await Vote.aggregate([
    { $match: { pollId: poll._id } },
    {
      $group: {
        _id: {
          $dateTrunc: { date: '$createdAt', unit: 'minute', binSize: 15 },
        },
        votes: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        time: '$_id',
        votes: 1,
      },
    },
  ]);

  // Format timestamps to readable strings
  const formattedTimeline = timeline.map((t) => ({
    time: new Date(t.time).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    votes: t.votes,
  }));

  // Peak minute
  const peak = formattedTimeline.reduce(
    (max, t) => (t.votes > (max?.votes ?? 0) ? t : max),
    null
  );

  res.json({
    totalVotes,
    uniqueVoters,
    peakMinute: peak?.time ?? null,
    timeline: formattedTimeline,
  });
};
