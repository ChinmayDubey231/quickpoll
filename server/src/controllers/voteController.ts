import type { Request, Response } from 'express';
import Vote from '../models/Vote.js';
import Poll from '../models/Poll.js';
import redis from '../config/redis.js';
import { FEATURES } from '../config/features.js';
import { getIO } from '../config/socket.js';
import { paramId, getClientIp } from '../utils/http.js';
import type { OptionCount } from '../types/socket.js';

const isValidSingleIndex = (value: unknown, optionCount: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < optionCount;

// ─── GET /api/votes/:pollId ────────────────────────────────────────────────────
// Returns current vote counts per option (from Redis — fast read for live chart)
export const getVoteCounts = async (req: Request, res: Response) => {
  const pollId = paramId(req.params.pollId);

  const poll = await Poll.findById(pollId).select('options');
  if (!poll) return res.status(404).json({ message: 'Poll not found' });

  const key = `poll::${pollId}::counts`;
  const raw = await redis.hgetall(key);

  const counts: OptionCount[] = poll.options.map((_, i) => ({
    optionIndex: i,
    count: parseInt(raw?.[String(i)] || '0', 10),
  }));

  res.json({ pollId, counts });
};

// ─── POST /api/votes/:pollId ───────────────────────────────────────────────────
export const castVote = async (req: Request, res: Response) => {
  const pollId = paramId(req.params.pollId);
  const { optionIndex, optionIndexes, rankings, fingerprint } = req.body;
  const ip = getClientIp(req);

  // Validate poll exists and is open
  const poll = await Poll.findById(pollId);
  if (!poll) return res.status(404).json({ message: 'Poll not found' });
  if (!poll.isOpen) return res.status(400).json({ message: 'This poll is closed' });

  const optionCount = poll.options.length;

  // Validate the ballot shape according to the poll's type
  let voteFields: { optionIndex?: number; optionIndexes?: number[]; rankings?: number[] };
  let firstPreferenceForCounting: number;

  if (poll.pollType === 'multi') {
    if (
      !Array.isArray(optionIndexes) ||
      optionIndexes.length < 1 ||
      optionIndexes.length > optionCount ||
      !optionIndexes.every((i: unknown) => isValidSingleIndex(i, optionCount)) ||
      new Set(optionIndexes).size !== optionIndexes.length
    ) {
      return res.status(400).json({ message: 'Invalid option selection' });
    }
    voteFields = { optionIndexes };
    firstPreferenceForCounting = optionIndexes[0];
  } else if (poll.pollType === 'ranked') {
    const expected = Array.from({ length: optionCount }, (_, i) => i).sort();
    const sortedRankings = Array.isArray(rankings) ? [...rankings].sort((a, b) => a - b) : null;
    const isFullPermutation =
      Array.isArray(rankings) &&
      rankings.length === optionCount &&
      rankings.every((i: unknown) => isValidSingleIndex(i, optionCount)) &&
      sortedRankings !== null &&
      expected.every((v, i) => v === sortedRankings[i]);

    if (!isFullPermutation) {
      return res.status(400).json({ message: 'Invalid ranking — every option must be ranked exactly once' });
    }
    voteFields = { rankings };
    firstPreferenceForCounting = rankings[0];
  } else {
    if (!isValidSingleIndex(optionIndex, optionCount)) {
      return res.status(400).json({ message: 'Invalid option' });
    }
    voteFields = { optionIndex };
    firstPreferenceForCounting = optionIndex;
  }

  // ── VOTE_GUARD ─────────────────────────────────────────────────────────────
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
  await Vote.create({
    pollId,
    ...voteFields,
    voterFingerprint: fingerprint || null,
    ip,
  });

  // Increment Redis counters — source of truth for live counts.
  // Multi-select increments every selected option; single/ranked increment
  // only the (first) chosen option. A separate ballots counter tracks the
  // true number of votes cast, since multi-select would otherwise be
  // overcounted by summing per-option counts.
  const countKey = `poll::${pollId}::counts`;
  const ballotsKey = `poll::${pollId}::ballots`;
  const optionsToIncrement = poll.pollType === 'multi' ? (voteFields.optionIndexes as number[]) : [firstPreferenceForCounting];

  await Promise.all([
    ...optionsToIncrement.map((i) => redis.hincrby(countKey, String(i), 1)),
    redis.incr(ballotsKey),
    Poll.updateOne({ _id: pollId }, { $inc: { totalVotesCache: 1 } }),
  ]);

  // Fetch updated counts for all options and broadcast via Socket.io
  const raw = await redis.hgetall(countKey);
  const counts: OptionCount[] = poll.options.map((_, i) => ({
    optionIndex: i,
    count: parseInt(raw?.[String(i)] || '0', 10),
  }));
  const totalVotes = parseInt((await redis.get(ballotsKey)) || '0', 10);

  getIO().to(pollId).emit('vote-update', { pollId, counts, totalVotes });

  res.status(201).json({ message: 'Vote recorded', counts, totalVotes });
};
