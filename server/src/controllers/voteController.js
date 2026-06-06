import Vote from '../models/Vote.js';
import Poll from '../models/Poll.js';
import redis from '../config/redis.js';
import { FEATURES } from '../config/features.js';
import { getIO } from '../config/socket.js';

// ─── GET /api/votes/:pollId ────────────────────────────────────────────────────
// Returns current vote counts per option (from Redis — fast read for live chart)
export const getVoteCounts = async (req, res) => {
  const { pollId } = req.params;

  const poll = await Poll.findById(pollId).select('options');
  if (!poll) return res.status(404).json({ message: 'Poll not found' });

  const key = `poll::${pollId}::counts`;
  const raw = await redis.hgetall(key);

  const counts = poll.options.map((_, i) => ({
    optionIndex: i,
    count: parseInt(raw?.[String(i)] || '0', 10),
  }));

  res.json({ pollId, counts });
};

// ─── POST /api/votes/:pollId ───────────────────────────────────────────────────
export const castVote = async (req, res) => {
  const { pollId } = req.params;
  const { optionIndex, fingerprint } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  // Validate poll exists and is open
  const poll = await Poll.findById(pollId);
  if (!poll) return res.status(404).json({ message: 'Poll not found' });
  if (!poll.isOpen) return res.status(400).json({ message: 'This poll is closed' });

  // Validate optionIndex
  if (
    typeof optionIndex !== 'number' ||
    !Number.isInteger(optionIndex) ||
    optionIndex < 0 ||
    optionIndex >= poll.options.length
  ) {
    return res.status(400).json({ message: 'Invalid option' });
  }

  // ── VOTE_GUARD (feature flagged off) ──────────────────────────────────────
  if (FEATURES.VOTE_GUARD) {
    const fingerprintKey = `vote::${pollId}::${fingerprint}`;
    const ipKey = `vote::${pollId}::${ip}`;

    const [fpExists, ipExists] = await Promise.all([
      fingerprint ? redis.exists(fingerprintKey) : Promise.resolve(0),
      redis.exists(ipKey),
    ]);

    if (fpExists || ipExists) {
      return res.status(409).json({ message: 'You have already voted on this poll' });
    }

    // Mark as voted (expire after 30 days)
    const EX = 60 * 60 * 24 * 30;
    await Promise.all([
      fingerprint ? redis.set(fingerprintKey, '1', 'EX', EX) : Promise.resolve(),
      redis.set(ipKey, '1', 'EX', EX),
    ]);
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Save vote to MongoDB (createdAt used for analytics timeline)
  const vote = await Vote.create({
    pollId,
    optionIndex,
    voterFingerprint: fingerprint || null,
    ip,
  });

  // Increment Redis hash counter — source of truth for live counts
  const countKey = `poll::${pollId}::counts`;
  await redis.hincrby(countKey, String(optionIndex), 1);

  // Fetch updated counts for all options and broadcast via Socket.io
  const raw = await redis.hgetall(countKey);
  const counts = poll.options.map((_, i) => ({
    optionIndex: i,
    count: parseInt(raw?.[String(i)] || '0', 10),
  }));

  getIO().to(pollId).emit('vote-update', { pollId, counts });

  res.status(201).json({ message: 'Vote recorded', counts });
};
