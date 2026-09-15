import type { Request, Response } from 'express';
import Poll from '../models/Poll.js';
import Reaction from '../models/Reaction.js';
import redis from '../config/redis.js';
import { FEATURES, REACTION_EMOJIS } from '../config/features.js';
import { getIO } from '../config/socket.js';
import { paramId, getClientIp } from '../utils/http.js';
import type { ReactionCount } from '../types/socket.js';

const getReactionCounts = async (pollId: string): Promise<ReactionCount[]> => {
  const raw = await redis.hgetall(`poll::${pollId}::reactions`);
  return REACTION_EMOJIS.map((emoji) => ({
    emoji,
    count: parseInt(raw?.[emoji] || '0', 10),
  }));
};

// ─── GET /api/polls/:id/reactions ──────────────────────────────────────────────
export const getReactions = async (req: Request, res: Response) => {
  const pollId = paramId(req.params.id);
  const reactions = await getReactionCounts(pollId);
  res.json({ pollId, reactions });
};

// ─── POST /api/polls/:id/reactions ─────────────────────────────────────────────
// Public — dedup'd per voter+emoji the same way VOTE_GUARD dedups votes
export const addReaction = async (req: Request, res: Response) => {
  const pollId = paramId(req.params.id);
  const { emoji, fingerprint } = req.body;
  const ip = getClientIp(req);

  if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) {
    return res.status(400).json({ message: 'Invalid reaction' });
  }

  const poll = await Poll.findById(pollId).select('_id');
  if (!poll) return res.status(404).json({ message: 'Poll not found' });

  if (FEATURES.VOTE_GUARD) {
    const fingerprintKey = `reaction::${pollId}::${emoji}::${fingerprint}`;
    const ipKey = `reaction::${pollId}::${emoji}::${ip}`;

    const [fpExists, ipExists] = await Promise.all([
      fingerprint ? redis.exists(fingerprintKey) : Promise.resolve(0),
      redis.exists(ipKey),
    ]);

    if (fpExists || ipExists) {
      return res.status(409).json({ message: 'You already reacted with this emoji' });
    }

    const EX = 60 * 60 * 24 * 30;
    await Promise.all([
      fingerprint ? redis.set(fingerprintKey, '1', 'EX', EX) : Promise.resolve(),
      redis.set(ipKey, '1', 'EX', EX),
    ]);
  }

  await Reaction.create({ pollId, emoji, voterFingerprint: fingerprint || null, ip });
  await redis.hincrby(`poll::${pollId}::reactions`, emoji, 1);

  const reactions = await getReactionCounts(pollId);
  getIO().to(pollId).emit('reaction-update', { pollId, reactions });

  res.status(201).json({ pollId, reactions });
};
