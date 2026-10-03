import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline } from './timeline.js';

const at = (iso: string) => new Date(iso);

test('groups votes into 15-minute windows, oldest first', () => {
  const timeline = buildTimeline(
    [
      { createdAt: at('2026-10-03T09:31:00Z'), optionIndex: 1 },
      { createdAt: at('2026-10-03T09:02:00Z'), optionIndex: 0 },
      { createdAt: at('2026-10-03T09:14:59Z'), optionIndex: 1 },
      { createdAt: at('2026-10-03T09:15:00Z'), optionIndex: 1 },
    ],
    'single',
    2,
  );
  assert.deepEqual(timeline, [
    { time: '2026-10-03T09:00:00.000Z', votes: 2, byOption: [1, 1] },
    { time: '2026-10-03T09:15:00.000Z', votes: 1, byOption: [0, 1] },
    { time: '2026-10-03T09:30:00.000Z', votes: 1, byOption: [0, 1] },
  ]);
});

test('skips windows with no votes', () => {
  const timeline = buildTimeline(
    [
      { createdAt: at('2026-10-03T09:00:00Z'), optionIndex: 0 },
      { createdAt: at('2026-10-03T11:00:00Z'), optionIndex: 0 },
    ],
    'single',
    2,
  );
  assert.deepEqual(timeline.map((b) => b.time), ['2026-10-03T09:00:00.000Z', '2026-10-03T11:00:00.000Z']);
});

test('multi-select counts every pick but one ballot', () => {
  const [bucket] = buildTimeline([{ createdAt: at('2026-10-03T09:00:00Z'), optionIndexes: [0, 2] }], 'multi', 3);
  assert.equal(bucket.votes, 1);
  assert.deepEqual(bucket.byOption, [1, 0, 1]);
});

test('ranked counts only the first preference', () => {
  const [bucket] = buildTimeline([{ createdAt: at('2026-10-03T09:00:00Z'), rankings: [2, 0, 1] }], 'ranked', 3);
  assert.deepEqual(bucket.byOption, [0, 0, 1]);
});

test('ignores option indexes that are out of range', () => {
  const [bucket] = buildTimeline([{ createdAt: at('2026-10-03T09:00:00Z'), optionIndex: 5 }], 'single', 2);
  assert.equal(bucket.votes, 1);
  assert.deepEqual(bucket.byOption, [0, 0]);
});
