import type { Request, Response } from 'express';
import type { HydratedDocument } from 'mongoose';
import Poll from '../models/Poll.js';
import Vote from '../models/Vote.js';
import Comment from '../models/Comment.js';
import Reaction from '../models/Reaction.js';
import redis from '../config/redis.js';
import { pollExpiryQueue } from '../config/bullmq.js';
import { getIO } from '../config/socket.js';
import { computeIRV } from '../utils/irv.js';
import type { IPoll, PollType } from '../types/models.js';
import type { OptionCount } from '../types/socket.js';

const POLL_TYPES: PollType[] = ['single', 'multi', 'ranked'];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const getOptionCounts = async (poll: HydratedDocument<IPoll>): Promise<OptionCount[]> => {
  const raw = await redis.hgetall(`poll::${poll._id}::counts`);
  return poll.options.map((_, i) => ({
    optionIndex: i,
    count: parseInt(raw?.[String(i)] || '0', 10),
  }));
};

// Total ballots cast (distinct from the sum of per-option counts, which
// overcounts once a single voter can pick more than one option on a
// 'multi' poll). Falls back to summing option counts for polls that were
// seeded before the dedicated ballots counter existed.
const getTotalVotes = async (pollId: string, counts: OptionCount[]): Promise<number> => {
  const raw = await redis.get(`poll::${pollId}::ballots`);
  if (raw !== null) return parseInt(raw, 10);
  return counts.reduce((sum, c) => sum + c.count, 0);
};

// Attach live vote counts (from Redis) to an array of polls
const attachCounts = async (polls: HydratedDocument<IPoll>[]) => {
  return Promise.all(
    polls.map(async (poll) => {
      const counts = await getOptionCounts(poll);
      const totalVotes = await getTotalVotes(poll._id.toString(), counts);
      return { ...poll.toObject(), counts, totalVotes };
    })
  );
};

// Closes a poll, caching the IRV result for ranked polls, and emits
// poll-closed to the poll's socket room. Shared by closePoll (manual) and
// the BullMQ expiry worker (automatic) so both paths behave identically.
export const finalizePollClose = async (poll: HydratedDocument<IPoll>) => {
  if (poll.pollType === 'ranked') {
    const votes = await Vote.find({ pollId: poll._id, rankings: { $exists: true } });
    const ballots = votes
      .map((v) => v.rankings)
      .filter((r): r is number[] => Array.isArray(r) && r.length > 0);
    poll.finalResult = computeIRV(ballots, poll.options.length);
  }

  poll.isOpen = false;
  await poll.save();

  getIO().to(poll._id.toString()).emit('poll-closed', {
    pollId: poll._id.toString(),
    finalResult: poll.finalResult,
  });

  return poll;
};

// Wraps a CSV field in quotes (doubling any internal quotes) if it contains
// a comma, quote, or newline that would otherwise break column alignment.
const csvEscape = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

// ─── GET /api/polls/export/csv ─────────────────────────────────────────────────
// Creator only — one row per poll option across every poll they own, with
// vote counts/percentages and poll-level metadata.
export const exportPollsCSV = async (req: Request, res: Response) => {
  const polls = await Poll.find({ creatorId: req.user._id }).sort({ createdAt: -1 });
  const pollIds = polls.map((p) => p._id);

  const voteStats = await Vote.aggregate([
    { $match: { pollId: { $in: pollIds } } },
    {
      $group: {
        _id: '$pollId',
        fingerprints: { $addToSet: '$voterFingerprint' },
        recorded: { $sum: 1 },
      },
    },
  ]);
  const uniqueVotersByPoll = new Map<string, number>(
    voteStats.map((s) => [
      s._id.toString(),
      (s.fingerprints as (string | null)[]).filter(Boolean).length || s.recorded,
    ])
  );

  const header = [
    'Poll ID',
    'Question',
    'Poll Type',
    'Status',
    'Public',
    'Created At',
    'Expires At',
    'Total Votes',
    'Unique Voters',
    'Option Index',
    'Option Text',
    'Option Votes',
    'Option Percentage',
  ];
  const rows: string[][] = [header];

  for (const poll of polls) {
    const counts = await getOptionCounts(poll);
    const totalVotes = await getTotalVotes(poll._id.toString(), counts);
    const uniqueVoters = uniqueVotersByPoll.get(poll._id.toString()) ?? 0;

    poll.options.forEach((opt, i) => {
      const count = counts.find((c) => c.optionIndex === i)?.count ?? 0;
      const pct = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : '0.0';
      rows.push([
        poll._id.toString(),
        poll.question,
        poll.pollType,
        poll.isOpen ? 'Open' : 'Closed',
        poll.isPublic ? 'Yes' : 'No',
        poll.createdAt.toISOString(),
        poll.expiresAt ? poll.expiresAt.toISOString() : '',
        String(totalVotes),
        String(uniqueVoters),
        String(i),
        opt.text,
        String(count),
        `${pct}%`,
      ]);
    });
  }

  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
  const filename = `quickpoll-report-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`﻿${csv}`);
};

// ─── GET /api/polls ────────────────────────────────────────────────────────────
// Returns the authenticated creator's polls with vote counts
export const getMyPolls = async (req: Request, res: Response) => {
  const polls = await Poll.find({ creatorId: req.user._id }).sort({ createdAt: -1 });
  const withCounts = await attachCounts(polls);
  res.json(withCounts);
};

// ─── GET /api/polls/discover ────────────────────────────────────────────────────
// Public — paginated list of polls their creators have opted to make discoverable
export const getPublicPolls = async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '12'), 10) || 12));
  const sort: Record<string, 1 | -1> =
    req.query.sort === 'popular' ? { totalVotesCache: -1 } : { createdAt: -1 };

  const filter = { isPublic: true, isOpen: true };
  const [polls, totalCount] = await Promise.all([
    Poll.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Poll.countDocuments(filter),
  ]);

  const withCounts = await attachCounts(polls);

  res.json({
    polls: withCounts,
    page,
    totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    totalCount,
  });
};

// ─── POST /api/polls ───────────────────────────────────────────────────────────
export const createPoll = async (req: Request, res: Response) => {
  const { question, options, expiresAt, pollType, isPublic } = req.body;

  if (!question || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ message: 'Question and at least 2 options are required' });
  }
  if (options.length > 6) {
    return res.status(400).json({ message: 'Maximum 6 options allowed' });
  }
  if (pollType !== undefined && !POLL_TYPES.includes(pollType)) {
    return res.status(400).json({ message: 'Invalid poll type' });
  }

  const optionDocs = options.map((text: string) => ({ text: String(text).trim() }));

  const poll = await Poll.create({
    creatorId: req.user._id,
    question: question.trim(),
    options: optionDocs,
    pollType: pollType || 'single',
    isPublic: Boolean(isPublic),
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
export const getPoll = async (req: Request, res: Response) => {
  const poll = await Poll.findById(req.params.id);
  if (!poll) return res.status(404).json({ message: 'Poll not found' });

  const counts = await getOptionCounts(poll);
  const totalVotes = await getTotalVotes(poll._id.toString(), counts);

  res.json({ ...poll.toObject(), counts, totalVotes });
};

// ─── PATCH /api/polls/:id/close ────────────────────────────────────────────────
export const closePoll = async (req: Request, res: Response) => {
  const poll = await Poll.findOne({ _id: req.params.id, creatorId: req.user._id });
  if (!poll) return res.status(404).json({ message: 'Poll not found' });
  if (!poll.isOpen) return res.status(400).json({ message: 'Poll is already closed' });

  await finalizePollClose(poll);

  res.json({ message: 'Poll closed', poll });
};

// ─── DELETE /api/polls/:id ─────────────────────────────────────────────────────
export const deletePoll = async (req: Request, res: Response) => {
  const poll = await Poll.findOneAndDelete({ _id: req.params.id, creatorId: req.user._id });
  if (!poll) return res.status(404).json({ message: 'Poll not found' });

  // Clean up Redis counts
  await redis.del(
    `poll::${poll._id}::counts`,
    `poll::${poll._id}::ballots`,
    `poll::${poll._id}::reactions`
  );

  // Remove associated votes, comments and reactions
  await Promise.all([
    Vote.deleteMany({ pollId: poll._id }),
    Comment.deleteMany({ pollId: poll._id }),
    Reaction.deleteMany({ pollId: poll._id }),
  ]);

  res.json({ message: 'Poll deleted' });
};

// ─── GET /api/polls/:id/analytics ─────────────────────────────────────────────
// Creator only — timeline data, peak minute, unique voter count
export const getPollAnalytics = async (req: Request, res: Response) => {
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
    (max: { time: string; votes: number } | null, t) => (t.votes > (max?.votes ?? 0) ? t : max),
    null
  );

  let irv = null;
  if (poll.pollType === 'ranked') {
    const ballots = votes
      .map((v) => v.rankings)
      .filter((r): r is number[] => Array.isArray(r) && r.length > 0);
    irv = poll.finalResult ?? computeIRV(ballots, poll.options.length);
  }

  res.json({
    totalVotes,
    uniqueVoters,
    peakMinute: peak?.time ?? null,
    timeline: formattedTimeline,
    irv,
  });
};
