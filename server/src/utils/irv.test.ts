import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeIRV } from './irv.js';

test('majority winner in round 1', () => {
  const ballots = [[0, 1], [0, 2], [0, 1], [1, 0], [2, 0]];
  const result = computeIRV(ballots, 3);
  assert.equal(result.winnerIndex, 0);
  assert.equal(result.rounds.length, 1);
});

test('eliminates the lowest option and redistributes votes', () => {
  // 3 options: A=2 first-choice, B=1, C=2 -> no majority round 1 (2/5)
  // B is eliminated (lowest), its ballot's next choice goes to A -> A gets 3/5, majority
  const ballots = [
    [0, 1], // A
    [0, 2], // A
    [1, 0], // B, then A
    [2, 0], // C
    [2, 1], // C
  ];
  const result = computeIRV(ballots, 3);
  assert.equal(result.rounds.length, 2);
  assert.equal(result.rounds[0].eliminated, 1);
  assert.equal(result.winnerIndex, 0);
});

test('ties are broken by lowest option index', () => {
  const ballots = [
    [0, 2],
    [1, 2],
  ];
  const result = computeIRV(ballots, 3);
  // round 1: option 0=1, option1=1, option2=0 -> option2 eliminated (lowest tally)
  assert.equal(result.rounds[0].eliminated, 2);
});

test('no ballots yields no winner', () => {
  const result = computeIRV([], 3);
  assert.equal(result.winnerIndex, null);
  assert.deepEqual(result.rounds, []);
});

test('single option always wins', () => {
  const result = computeIRV([[0], [0]], 1);
  assert.equal(result.winnerIndex, 0);
});
