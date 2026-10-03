import type { PollType } from '../types/models.js';

// Votes are bucketed into 15-minute windows aligned to UTC. Every time zone in
// use is offset from UTC by a whole number of quarter hours, so these windows
// also line up with the viewer's local clock, and the client can regroup them
// into longer local windows (hours, days) without splitting a bucket.
export const BUCKET_MS = 15 * 60 * 1000;

export interface TimelineVote {
  createdAt: Date;
  optionIndex?: number | null;
  optionIndexes?: number[] | null;
  rankings?: number[] | null;
}

export interface TimelineBucket {
  // Start of the window, as an ISO timestamp; the client formats it in local time
  time: string;
  // Ballots cast in the window
  votes: number;
  // Per option, the same way the live counts are kept: every pick of a
  // multi-select ballot, and only the first preference of a ranked one
  byOption: number[];
}

const picksOf = (vote: TimelineVote, pollType: PollType): number[] => {
  if (pollType === 'multi') return vote.optionIndexes ?? [];
  if (pollType === 'ranked') {
    const first = vote.rankings?.[0] ?? vote.optionIndex;
    return first == null ? [] : [first];
  }
  return vote.optionIndex == null ? [] : [vote.optionIndex];
};

// Only windows that received votes are returned, oldest first; the client
// fills the quiet stretches in between.
export const buildTimeline = (votes: TimelineVote[], pollType: PollType, optionCount: number): TimelineBucket[] => {
  const buckets = new Map<number, { votes: number; byOption: number[] }>();

  for (const vote of votes) {
    const start = Math.floor(vote.createdAt.getTime() / BUCKET_MS) * BUCKET_MS;
    let bucket = buckets.get(start);
    if (!bucket) {
      bucket = { votes: 0, byOption: new Array(optionCount).fill(0) };
      buckets.set(start, bucket);
    }
    bucket.votes += 1;
    for (const i of picksOf(vote, pollType)) {
      if (Number.isInteger(i) && i >= 0 && i < optionCount) bucket.byOption[i] += 1;
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, b]) => ({ time: new Date(start).toISOString(), ...b }));
};
