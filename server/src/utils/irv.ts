import type { IrvResult, IrvRound, IrvRoundTally } from '../types/socket.js';

/**
 * Computes an instant-runoff (ranked-choice) result from a set of full-ranking
 * ballots. Each ballot is an ordered array of option indices, index 0 = first
 * preference. Eliminates the lowest-tallied active option each round (ties
 * broken by lowest option index, for determinism) until one option holds a
 * strict majority of the votes still in play, or only one option remains.
 */
export const computeIRV = (ballots: number[][], optionCount: number): IrvResult => {
  if (optionCount <= 0) {
    return { winnerIndex: null, rounds: [] };
  }

  let active = new Set<number>(Array.from({ length: optionCount }, (_, i) => i));
  const rounds: IrvRound[] = [];

  if (ballots.length === 0) {
    return { winnerIndex: null, rounds: [] };
  }

  while (active.size > 0) {
    const tallyMap = new Map<number, number>();
    for (const optionIndex of active) tallyMap.set(optionIndex, 0);

    for (const ballot of ballots) {
      const firstActiveChoice = ballot.find((optionIndex) => active.has(optionIndex));
      if (firstActiveChoice !== undefined) {
        tallyMap.set(firstActiveChoice, (tallyMap.get(firstActiveChoice) ?? 0) + 1);
      }
    }

    const tallies: IrvRoundTally[] = Array.from(tallyMap.entries())
      .map(([optionIndex, votes]) => ({ optionIndex, votes }))
      .sort((a, b) => b.votes - a.votes || a.optionIndex - b.optionIndex);

    const totalVotes = tallies.reduce((sum, t) => sum + t.votes, 0);

    if (active.size === 1) {
      rounds.push({ round: rounds.length + 1, tallies, eliminated: null });
      return { winnerIndex: tallies[0]?.optionIndex ?? null, rounds };
    }

    if (totalVotes === 0) {
      rounds.push({ round: rounds.length + 1, tallies, eliminated: null });
      return { winnerIndex: null, rounds };
    }

    const leader = tallies[0];
    if (leader.votes > totalVotes / 2) {
      rounds.push({ round: rounds.length + 1, tallies, eliminated: null });
      return { winnerIndex: leader.optionIndex, rounds };
    }

    // Eliminate the lowest-tallied option (last in the sorted list, since
    // ties are already broken by lowest index above).
    const eliminated = tallies[tallies.length - 1].optionIndex;
    rounds.push({ round: rounds.length + 1, tallies, eliminated });
    active = new Set([...active].filter((i) => i !== eliminated));
  }

  return { winnerIndex: null, rounds };
};
