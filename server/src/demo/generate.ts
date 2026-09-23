import { Types } from 'mongoose';
import { computeIRV } from '../utils/irv.js';
import { REACTION_EMOJIS } from '../config/features.js';
import type { PollType } from '../types/models.js';
import type { IrvResult } from '../types/socket.js';
import { DEMO_POLLS, DEMO_USERS, type DemoPollSpec } from './content.js';

// Pure demo-data builder: no DB, no Redis. Everything random comes from a
// seeded PRNG so the output is reproducible (only ObjectIds and the "now"
// anchor differ between runs), which also keeps the unit tests stable.

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const SEED = 20260924;

type Rng = () => number;

// mulberry32 — tiny, good-enough PRNG for fixture data
const createRng = (seed: number): Rng => {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffle = <T>(arr: T[], rng: Rng): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// Splits `total` into integer parts proportional to `weights` (largest
// remainder), so a poll's final distribution matches its spec exactly.
const allocate = (total: number, weights: number[]): number[] => {
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (w / sum) * total);
  const counts = exact.map(Math.floor);
  let remaining = total - counts.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of byRemainder) {
    if (remaining-- <= 0) break;
    counts[i] += 1;
  }
  return counts;
};

const pickWeighted = (weights: number[], rng: Rng): number => {
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
};

// Plackett–Luce: repeatedly draw the next preference proportional to weight
const sampleRanking = (weights: number[], rng: Rng): number[] => {
  const remaining = weights.map((w, i) => ({ w, i }));
  const ranking: number[] = [];
  while (remaining.length) {
    const k = pickWeighted(remaining.map((o) => o.w), rng);
    ranking.push(remaining[k].i);
    remaining.splice(k, 1);
  }
  return ranking;
};

const rankedBallots = (spec: DemoPollSpec, rng: Rng): number[][] => {
  if (!spec.blocs) {
    return Array.from({ length: spec.votes }, () => sampleRanking(spec.weights, rng));
  }
  const perBloc = allocate(spec.votes, spec.blocs.map((b) => b.share));
  const ballots = spec.blocs.flatMap((bloc, b) =>
    Array.from({ length: perBloc[b] }, () => {
      const ranking = [...bloc.ranking];
      // Some voters disagree on lower preferences; first choice stays put
      // so the bloc's round-1 strength is exactly what the spec says.
      if (rng() < 0.35 && ranking.length > 2) {
        const i = 1 + Math.floor(rng() * (ranking.length - 2));
        [ranking[i], ranking[i + 1]] = [ranking[i + 1], ranking[i]];
      }
      return ranking;
    })
  );
  return shuffle(ballots, rng);
};

const multiSelection = (weights: number[], rng: Rng): number[] => {
  const picked = weights.flatMap((p, i) => (rng() < p ? [i] : []));
  return picked.length ? picked : [pickWeighted(weights, rng)];
};

// Activity bursts right after a poll launches and tails off: 75% of events
// follow an exponential decay across the window, 25% are spread evenly.
const eventTime = (start: number, windowMs: number, rng: Rng): Date => {
  let f = rng();
  if (rng() < 0.75) {
    do f = -Math.log(1 - rng()) * 0.3;
    while (f >= 1);
  }
  const usable = Math.max(windowMs - MINUTE, 0);
  return new Date(start + MINUTE + f * usable);
};

const fingerprint = (rng: Rng) =>
  Array.from({ length: 32 }, () => Math.floor(rng() * 16).toString(16)).join('');

const ipAddress = (rng: Rng) =>
  `${[73, 98, 142, 174, 203][Math.floor(rng() * 5)]}.${Math.floor(rng() * 256)}.${Math.floor(rng() * 256)}.${1 + Math.floor(rng() * 254)}`;

// ─── Output shapes ────────────────────────────────────────────────────────────

export interface DemoPoll {
  _id: Types.ObjectId;
  creatorId: Types.ObjectId;
  question: string;
  options: { text: string }[];
  pollType: PollType;
  isPublic: boolean;
  isOpen: boolean;
  expiresAt: Date | null;
  totalVotesCache: number;
  finalResult: IrvResult | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DemoVote {
  pollId: Types.ObjectId;
  optionIndex: number | null;
  optionIndexes?: number[];
  rankings?: number[];
  voterFingerprint: string;
  ip: string;
  createdAt: Date;
  updatedAt: Date;
}

// Live counters the server normally keeps in Redis
export interface DemoLiveStats {
  pollId: string;
  counts: number[];
  ballots: number;
  reactions: Record<string, number>;
  // When the poll stopped accepting votes (close time, or now if still open)
  activeUntil: Date;
}

export interface DemoData {
  users: { _id: Types.ObjectId; name: string; email: string; createdAt: Date; updatedAt: Date }[];
  polls: DemoPoll[];
  votes: DemoVote[];
  comments: { pollId: Types.ObjectId; authorName: string; body: string; createdAt: Date; updatedAt: Date }[];
  reactions: { pollId: Types.ObjectId; emoji: string; voterFingerprint: string; ip: string; createdAt: Date; updatedAt: Date }[];
  live: DemoLiveStats[];
}

export const buildDemoData = (now: number = Date.now()): DemoData => {
  const rng = createRng(SEED);

  const userCreatedAt = new Date(now - 14 * 24 * HOUR);
  const users = DEMO_USERS.map((u) => ({
    _id: new Types.ObjectId(),
    name: u.name,
    email: u.email,
    createdAt: userCreatedAt,
    updatedAt: userCreatedAt,
  }));
  const userIdByKey = new Map(DEMO_USERS.map((u, i) => [u.key, users[i]._id]));

  const data: DemoData = { users, polls: [], votes: [], comments: [], reactions: [], live: [] };

  for (const spec of DEMO_POLLS) {
    const pollId = new Types.ObjectId();
    const createdAt = now - spec.createdHoursAgo * HOUR;
    const { status } = spec;

    const closedAt = status.kind === 'open' ? null : createdAt + status.afterHours * HOUR;
    const expiresAt =
      status.kind === 'expired'
        ? new Date(closedAt!)
        : status.kind === 'open' && status.expiresInHours
          ? new Date(now + status.expiresInHours * HOUR)
          : null;
    const activeUntil = closedAt ?? now;
    const windowMs = Math.min(spec.activityHours * HOUR, activeUntil - createdAt);

    // ── Votes ──
    const counts = spec.options.map(() => 0);
    const singleChoices =
      spec.pollType === 'single'
        ? shuffle(allocate(spec.votes, spec.weights).flatMap((n, i) => Array<number>(n).fill(i)), rng)
        : [];
    const ballots = spec.pollType === 'ranked' ? rankedBallots(spec, rng) : [];

    for (let v = 0; v < spec.votes; v++) {
      const at = eventTime(createdAt, windowMs, rng);
      const vote: DemoVote = {
        pollId,
        optionIndex: null,
        voterFingerprint: fingerprint(rng),
        ip: ipAddress(rng),
        createdAt: at,
        updatedAt: at,
      };
      if (spec.pollType === 'single') {
        vote.optionIndex = singleChoices[v];
        counts[vote.optionIndex] += 1;
      } else if (spec.pollType === 'multi') {
        vote.optionIndexes = multiSelection(spec.weights, rng);
        for (const i of vote.optionIndexes) counts[i] += 1;
      } else {
        // Ranked ballots also record the first preference in optionIndex and
        // the live counts, mirroring the vote controller.
        const [firstChoice] = ballots[v];
        vote.rankings = ballots[v];
        vote.optionIndex = firstChoice;
        counts[firstChoice] += 1;
      }
      data.votes.push(vote);
    }

    // ── Comments — spaced through the activity window, oldest first ──
    const comments = spec.comments ?? [];
    comments.forEach(([authorName, body], i) => {
      const at = new Date(
        createdAt + ((i + 0.5 + (rng() - 0.5) * 0.6) / comments.length) * windowMs
      );
      data.comments.push({ pollId, authorName, body, createdAt: at, updatedAt: at });
    });

    // ── Reactions ──
    const reactionCounts: Record<string, number> = {};
    (spec.reactions ?? []).forEach((n, i) => {
      const emoji = REACTION_EMOJIS[i];
      if (!n) return;
      reactionCounts[emoji] = n;
      for (let r = 0; r < n; r++) {
        const at = eventTime(createdAt, windowMs, rng);
        data.reactions.push({
          pollId,
          emoji,
          voterFingerprint: fingerprint(rng),
          ip: ipAddress(rng),
          createdAt: at,
          updatedAt: at,
        });
      }
    });

    data.polls.push({
      _id: pollId,
      creatorId: userIdByKey.get(spec.creator)!,
      question: spec.question,
      options: spec.options.map((text) => ({ text })),
      pollType: spec.pollType,
      isPublic: spec.isPublic,
      isOpen: status.kind === 'open',
      expiresAt,
      totalVotesCache: spec.votes,
      // Closed ranked polls cache their authoritative result, like finalizePollClose
      finalResult:
        spec.pollType === 'ranked' && status.kind !== 'open'
          ? computeIRV(ballots, spec.options.length)
          : null,
      createdAt: new Date(createdAt),
      updatedAt: new Date(closedAt ?? createdAt),
    });

    data.live.push({
      pollId: pollId.toString(),
      counts,
      ballots: spec.votes,
      reactions: reactionCounts,
      activeUntil: new Date(activeUntil),
    });
  }

  return data;
};
