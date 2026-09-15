import type { IrvResultDTO, OptionDTO } from '../types/api';

interface IrvRoundsChartProps {
  result: IrvResultDTO;
  options: OptionDTO[];
}

// Round-by-round instant-runoff breakdown for ranked-choice polls: each round
// shows every still-active option's tally, with the eliminated option (or the
// winner, in the final round) called out.
export default function IrvRoundsChart({ result, options }: IrvRoundsChartProps) {
  if (result.rounds.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant font-mono">No ranked ballots yet</p>
    );
  }

  return (
    <div className="space-y-5">
      {result.rounds.map((round) => {
        const totalVotes = round.tallies.reduce((s, t) => s + t.votes, 0);
        const isFinalRound = round.round === result.rounds.length;

        return (
          <div key={round.round}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wide">
                Round {round.round}
              </h4>
              {isFinalRound && result.winnerIndex !== null && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-container/20 border border-secondary/30 text-secondary">
                  <span className="material-symbols-outlined text-[12px]">emoji_events</span>
                  Winner: {options[result.winnerIndex]?.text}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {round.tallies.map((tally) => {
                const pct = totalVotes > 0 ? Math.round((tally.votes / totalVotes) * 100) : 0;
                const isEliminated = tally.optionIndex === round.eliminated;
                return (
                  <div key={tally.optionIndex} className="flex items-center gap-2 text-sm">
                    <span
                      className={`w-28 shrink-0 truncate ${
                        isEliminated ? 'text-on-surface-variant/50 line-through' : 'text-on-surface'
                      }`}
                    >
                      {options[tally.optionIndex]?.text}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isEliminated ? 'bg-outline-variant' : 'bg-primary-container'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-xs text-on-surface-variant">
                      {tally.votes} ({pct}%)
                    </span>
                    {isEliminated && (
                      <span className="text-[10px] font-bold text-error shrink-0">eliminated</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
