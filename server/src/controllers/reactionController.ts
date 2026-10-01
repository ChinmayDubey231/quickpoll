import type { Request, Response } from 'express';
import Poll from '../models/Poll.js';
import Reaction from '../models/Reaction.js';
import redis from '../config/redis.js';
import { FEATURES, REACTION_EMOJIS } from '../config/features.js';
import { getIO } from '../config/socket.js';
import { paramId, getClientIp } from '../utils/http.js';
import type { ReactionCount } from '../types/socket.js';

const DEDUP_TTL = 60 * 60 * 24 * 30;

const countsKey = (pollId: string) => `poll::${pollId}::reactions`;

// The same fingerprint + IP pair VOTE_GUARD uses for votes, per emoji
const dedupKeys = (pollId: string, emoji: string, fingerprint: string | null, ip: string) => ({
  fingerprintKey: fingerprint ? `reaction::${pollId}::${emoji}::${fingerprint}` : null,
  ipKey: `reaction::${pollId}::${emoji}::${ip}`,
});

const isReactionEmoji = (emoji: unknown): emoji is string =>
  typeof emoji === 'string' && (REACTION_EMOJIS as readonly string[]).includes(emoji);

const readFingerprint = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const getReactionCounts = async (pollId: string): Promise<ReactionCount[]> => {
  const raw = await redis.hgetall(countsKey(pollId));
  return REACTION_EMOJIS.map((emoji) => ({
    emoji,
    count: Math.max(0, parseInt(raw?.[emoji] || '0', 10)),
  }));
};

// Whether this requester counts as having reacted with `emoji`: either their
// fingerprint or their IP is on record, which is also what blocks a repeat
const hasReacted = async (pollId: string, emoji: string, fingerprint: string | null, ip: string) => {
  const { fingerprintKey, ipKey } = dedupKeys(pollId, emoji, fingerprint, ip);
  const [fpExists, ipExists] = await Promise.all([
    fingerprintKey ? redis.exists(fingerprintKey) : Promise.resolve(0),
    redis.exists(ipKey),
  ]);
  return Boolean(fpExists || ipExists);
};

const getMyReactions = async (pollId: string, fingerprint: string | null, ip: string): Promise<string[]> => {
  // Without VOTE_GUARD nothing is tracked per visitor
  if (!FEATURES.VOTE_GUARD) return [];
  const flags = await Promise.all(REACTION_EMOJIS.map((emoji) => hasReacted(pollId, emoji, fingerprint, ip)));
  return REACTION_EMOJIS.filter((_, i) => flags[i]);
};

const broadcast = async (pollId: string) => {
  const reactions = await getReactionCounts(pollId);
  getIO().to(pollId).emit('reaction-update', { pollId, reactions });
  return reactions;
};

// ─── GET /api/polls/:id/reactions?fingerprint= ─────────────────────────────────
// Public — counts for everyone, plus which emojis the requester has used
export const getReactions = async (req: Request, res: Response) => {
  const pollId = paramId(req.params.id);
  const fingerprint = readFingerprint(req.query.fingerprint);
  const [reactions, mine] = await Promise.all([
    getReactionCounts(pollId),
    getMyReactions(pollId, fingerprint, getClientIp(req)),
  ]);
  res.json({ pollId, reactions, mine });
};

// ─── POST /api/polls/:id/reactions ─────────────────────────────────────────────
// Public — dedup'd per voter+emoji the same way VOTE_GUARD dedups votes
export const addReaction = async (req: Request, res: Response) => {
  const pollId = paramId(req.params.id);
  const { emoji } = req.body;
  const fingerprint = readFingerprint(req.body.fingerprint);
  const ip = getClientIp(req);

  if (!isReactionEmoji(emoji)) {
    return res.status(400).json({ message: 'Invalid reaction' });
  }

  const poll = await Poll.findById(pollId).select('_id');
  if (!poll) return res.status(404).json({ message: 'Poll not found' });

  if (FEATURES.VOTE_GUARD) {
    if (await hasReacted(pollId, emoji, fingerprint, ip)) {
      return res.status(409).json({ message: 'You already reacted with this emoji' });
    }

    const { fingerprintKey, ipKey } = dedupKeys(pollId, emoji, fingerprint, ip);
    await Promise.all([
      fingerprintKey ? redis.set(fingerprintKey, '1', 'EX', DEDUP_TTL) : Promise.resolve(),
      redis.set(ipKey, '1', 'EX', DEDUP_TTL),
    ]);
  }

  await Reaction.create({ pollId, emoji, voterFingerprint: fingerprint, ip });
  await redis.hincrby(countsKey(pollId), emoji, 1);

  const reactions = await broadcast(pollId);
  res.status(201).json({ pollId, reactions });
};

// ─── DELETE /api/polls/:id/reactions/:emoji?fingerprint= ───────────────────────
// Public — takes back a reaction made by the same visitor (fingerprint or IP)
export const removeReaction = async (req: Request, res: Response) => {
  const pollId = paramId(req.params.id);
  const emoji = paramId(req.params.emoji);
  const fingerprint = readFingerprint(req.query.fingerprint);
  const ip = getClientIp(req);

  if (!isReactionEmoji(emoji)) {
    return res.status(400).json({ message: 'Invalid reaction' });
  }

  const poll = await Poll.findById(pollId).select('_id');
  if (!poll) return res.status(404).json({ message: 'Poll not found' });

  // This visitor's logged reaction, newest first
  const owner = fingerprint ? [{ voterFingerprint: fingerprint }, { ip }] : [{ ip }];
  const logged = await Reaction.findOne({ pollId, emoji, $or: owner }).sort({ createdAt: -1 });

  let removed: boolean;
  if (FEATURES.VOTE_GUARD) {
    // Clear the keys for both the requester and whoever the log says reacted,
    // so a visitor whose IP has changed since isn't left blocked under the old one
    const current = dedupKeys(pollId, emoji, fingerprint, ip);
    const original = logged ? dedupKeys(pollId, emoji, logged.voterFingerprint, logged.ip ?? ip) : null;
    const keys = [current.fingerprintKey, current.ipKey, original?.fingerprintKey, original?.ipKey].filter(
      (k): k is string => Boolean(k),
    );
    // DEL reports how many keys it removed, so of two overlapping undo
    // requests only one sees a non-zero count and decrements
    removed = (await redis.del(...new Set(keys))) > 0;
    if (removed && logged) await Reaction.deleteOne({ _id: logged._id });
  } else {
    // No keys to go by; the log entry is the record, and only one of two
    // overlapping requests gets to delete it
    removed = logged ? (await Reaction.deleteOne({ _id: logged._id })).deletedCount > 0 : false;
  }

  if (!removed) {
    return res.status(404).json({ message: "You haven't reacted with this emoji" });
  }

  const remaining = await redis.hincrby(countsKey(pollId), emoji, -1);
  // Counts can only drift below zero if they were already out of step
  if (remaining < 0) await redis.hset(countsKey(pollId), emoji, '0');

  const reactions = await broadcast(pollId);
  res.json({ pollId, reactions });
};
