import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoData } from './generate.js';
import { DEMO_POLLS } from './content.js';
import { computeIRV } from '../utils/irv.js';
import { REACTION_EMOJIS } from '../config/features.js';

const NOW = Date.UTC(2026, 8, 24, 12, 0, 0);
const data = buildDemoData(NOW);

const votesFor = (pollId: string) => data.votes.filter((v) => v.pollId.toString() === pollId);

test('is deterministic apart from ObjectIds', () => {
  const again = buildDemoData(NOW);
  assert.deepEqual(
    again.votes.map((v) => [v.optionIndex, v.optionIndexes, v.rankings, v.createdAt]),
    data.votes.map((v) => [v.optionIndex, v.optionIndexes, v.rankings, v.createdAt])
  );
});

test('polls respect schema limits', () => {
  assert.equal(data.polls.length, DEMO_POLLS.length);
  for (const poll of data.polls) {
    assert.ok(poll.options.length >= 2 && poll.options.length <= 6, poll.question);
    assert.ok(poll.question.length <= 300, poll.question);
  }
  for (const c of data.comments) {
    assert.ok(c.authorName.length <= 40, c.authorName);
    assert.ok(c.body.length <= 500, c.body);
  }
  for (const r of data.reactions) {
    assert.ok((REACTION_EMOJIS as readonly string[]).includes(r.emoji));
  }
});

test('every ballot is valid for its poll type', () => {
  for (const poll of data.polls) {
    const n = poll.options.length;
    for (const v of votesFor(poll._id.toString())) {
      if (poll.pollType === 'single') {
        assert.ok(v.optionIndex! >= 0 && v.optionIndex! < n);
      } else if (poll.pollType === 'multi') {
        assert.ok(v.optionIndexes!.length >= 1);
        assert.equal(new Set(v.optionIndexes).size, v.optionIndexes!.length);
        assert.ok(v.optionIndexes!.every((i) => i >= 0 && i < n));
      } else {
        assert.deepEqual([...v.rankings!].sort((a, b) => a - b), [...Array(n).keys()]);
        assert.equal(v.optionIndex, v.rankings![0]);
      }
    }
  }
});

test('activity happens between poll creation and close (never in the future)', () => {
  const byId = new Map(data.live.map((l) => [l.pollId, l]));
  const inWindow = (pollId: string, at: Date) => {
    const poll = data.polls.find((p) => p._id.toString() === pollId)!;
    const until = byId.get(pollId)!.activeUntil.getTime();
    return at.getTime() > poll.createdAt.getTime() && at.getTime() <= until && until <= NOW;
  };
  for (const v of data.votes) assert.ok(inWindow(v.pollId.toString(), v.createdAt));
  for (const c of data.comments) assert.ok(inWindow(c.pollId.toString(), c.createdAt));
  for (const r of data.reactions) assert.ok(inWindow(r.pollId.toString(), r.createdAt));
});

test('open/closed/expired states are consistent', () => {
  for (const poll of data.polls) {
    if (poll.isOpen && poll.expiresAt) assert.ok(poll.expiresAt.getTime() > NOW, poll.question);
    if (!poll.isOpen && poll.expiresAt) assert.ok(poll.expiresAt.getTime() <= NOW, poll.question);
    if (poll.pollType === 'ranked') {
      assert.equal(poll.finalResult !== null, !poll.isOpen, poll.question);
    } else {
      assert.equal(poll.finalResult, null);
    }
  }
});

test('live counters match the stored votes', () => {
  for (const poll of data.polls) {
    const id = poll._id.toString();
    const live = data.live.find((l) => l.pollId === id)!;
    const votes = votesFor(id);
    assert.equal(live.ballots, votes.length);
    assert.equal(poll.totalVotesCache, votes.length);
    const counts = poll.options.map(() => 0);
    for (const v of votes) for (const i of v.optionIndexes ?? [v.optionIndex!]) counts[i] += 1;
    assert.deepEqual(live.counts, counts);
  }
});

test('pizza poll showcases an instant-runoff upset', () => {
  const pizza = data.polls.find((p) => p.question.startsWith('Rank your favorite pizza'))!;
  const ballots = votesFor(pizza._id.toString()).map((v) => v.rankings!);
  const result = computeIRV(ballots, pizza.options.length);
  const roundOneLeader = result.rounds[0].tallies[0].optionIndex;
  assert.equal(roundOneLeader, 3); // Pineapple leads on first preferences…
  assert.notEqual(result.winnerIndex, roundOneLeader); // …but loses the runoff
  assert.ok(result.rounds.length >= 3);
});

test('includes a mix of poll shapes for the UI', () => {
  const types = new Set(data.polls.map((p) => p.pollType));
  assert.deepEqual([...types].sort(), ['multi', 'ranked', 'single']);
  assert.ok(data.polls.filter((p) => p.isPublic && p.isOpen).length >= 6); // Discover page
  assert.ok(data.polls.some((p) => !p.isOpen && p.expiresAt)); // auto-expired
  assert.ok(data.polls.some((p) => !p.isOpen && !p.expiresAt)); // closed manually
  assert.ok(data.polls.some((p) => p.totalVotesCache === 0)); // empty state
});
