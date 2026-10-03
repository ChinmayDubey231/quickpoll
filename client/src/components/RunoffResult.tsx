import { motion } from "framer-motion";
import type { IrvResultDTO, OptionDTO } from "../types/api";

const easeOut = [0.2, 0.8, 0.2, 1] as const;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

interface RunoffResultProps {
  result: IrvResultDTO;
  options: OptionDTO[];
  // "Winner" once the poll has closed; "Leading" for a runoff run on the votes so far
  winnerLabel?: string;
}

// Instant-runoff result for a ranked-choice poll: the winner, then every round
// with the option knocked out in it. Styled for the .qp-ui palette.
export default function RunoffResult({ result, options, winnerLabel = "Winner" }: RunoffResultProps) {
  if (result.rounds.length === 0) {
    return <p className="text-[15px] text-qp-muted">No ranked ballots were cast.</p>;
  }
  const winner = result.winnerIndex !== null ? options[result.winnerIndex]?.text : undefined;

  return (
    <div className="flex flex-col gap-7">
      {winner && (
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-xl border border-qp-accent bg-[color-mix(in_srgb,var(--qp-accent)_12%,transparent)] px-[18px] py-4">
          <span className="font-brand-mono text-xs font-bold uppercase tracking-[.04em] text-qp-accent-ink">{winnerLabel}</span>
          <span className="text-lg font-medium [overflow-wrap:anywhere]">{winner}</span>
          <span className="ml-auto font-brand-mono text-xs text-qp-muted">
            after {result.rounds.length} {plural(result.rounds.length, "round", "rounds")}
          </span>
        </div>
      )}
      {result.rounds.map((round) => {
        const roundTotal = round.tallies.reduce((sum, t) => sum + t.votes, 0);
        const roundMax = Math.max(0, ...round.tallies.map((t) => t.votes));
        return (
          <div key={round.round} className="flex flex-col gap-3">
            <h3 className="font-brand-mono text-xs uppercase tracking-[.04em] text-qp-muted">Round {round.round}</h3>
            <ul className="flex flex-col gap-3">
              {[...round.tallies]
                .sort((a, b) => b.votes - a.votes)
                .map((t) => {
                  const pct = roundTotal > 0 ? Math.round((t.votes / roundTotal) * 100) : 0;
                  const out = t.optionIndex === round.eliminated;
                  return (
                    <li key={t.optionIndex} className="flex flex-col gap-1.5">
                      <span className="flex items-baseline justify-between gap-4 text-[15px]">
                        <span className={`[overflow-wrap:anywhere] ${out ? "text-qp-muted line-through" : ""}`}>
                          {options[t.optionIndex]?.text}
                          {out && <span className="sr-only"> (eliminated)</span>}
                        </span>
                        <span className="flex items-baseline gap-3 whitespace-nowrap font-brand-mono text-xs text-qp-muted">
                          {out && <span aria-hidden="true" className="uppercase tracking-[.04em] text-qp-error">Eliminated</span>}
                          <span className="tabular-nums">
                            {t.votes} · {pct}%
                          </span>
                        </span>
                      </span>
                      <span className="h-1 overflow-hidden rounded-sm bg-qp-track">
                        <motion.span
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, ease: easeOut }}
                          className={`block h-full rounded-sm ${!out && t.votes === roundMax && roundMax > 0 ? "bg-qp-accent" : "bg-qp-muted"}`}
                        />
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
