import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { formatDay, formatTime, formatTimeShort, formatWeekday, isSameDay } from "../utils/time";
import type { AnalyticsTimelinePointDTO, OptionDTO, PollType } from "../types/api";

const MINUTE = 60_000;
// Past this many columns a bar gets too thin to hover or read
const MAX_COLUMNS = 48;
const easeOut = [0.2, 0.8, 0.2, 1] as const;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-qp-bg";

// The table view slides open to its natural height and fades in; closing
// fades out a beat ahead of the collapse so rows never sit on a sliver of panel.
// Height eases in and out: a sharp ease-out front-loads the motion and pops.
const panelEase = [0.4, 0, 0.2, 1] as const;
const tablePanel: Variants = {
  closed: {
    height: 0,
    opacity: 0,
    transition: { height: { duration: 0.3, ease: panelEase }, opacity: { duration: 0.16, ease: "easeOut" } },
  },
  open: {
    height: "auto",
    opacity: 1,
    transition: { height: { duration: 0.38, ease: panelEase }, opacity: { duration: 0.26, ease: "easeOut", delay: 0.08 } },
  },
};

// For anyone who prefers reduced motion: same states, no tween
const tablePanelInstant: Variants = {
  closed: { height: 0, opacity: 0, transition: { duration: 0 } },
  open: { height: "auto", opacity: 1, transition: { duration: 0 } },
};

// Option i is drawn in --qp-s{i+1} (index.css); polls have at most six options
export const seriesColor = (i: number) => `var(--qp-s${(i % 6) + 1})`;

interface Interval {
  minutes: number;
  label: string;
}

const INTERVALS: Interval[] = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 180, label: "3 hours" },
  { minutes: 360, label: "6 hours" },
  { minutes: 1440, label: "1 day" },
  { minutes: 10080, label: "1 week" },
];

/* --------------------------------- grouping --------------------------------- */

// Start of the local window containing `t`. Weeks start on Monday.
const floorLocal = (t: number, minutes: number) => {
  const d = new Date(t);
  if (minutes >= 10080) return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime();
  if (minutes >= 1440) return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const m = d.getHours() * 60 + d.getMinutes();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, Math.floor(m / minutes) * minutes).getTime();
};

// Start of the next window. Days and weeks step by calendar date, and sub-day
// steps re-floor, so a daylight-saving change can't skip or repeat a window.
const nextLocal = (t: number, minutes: number) => {
  if (minutes >= 1440) {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + minutes / 1440).getTime();
  }
  const next = floorLocal(t + minutes * MINUTE, minutes);
  return next > t ? next : floorLocal(t + 2 * minutes * MINUTE, minutes);
};

const countColumns = (first: number, last: number, minutes: number) => {
  let n = 0;
  for (let t = floorLocal(first, minutes); t <= last && n <= MAX_COLUMNS; t = nextLocal(t, minutes)) n++;
  return n;
};

interface Column {
  start: number;
  end: number;
  votes: number;
  byOption: number[];
}

// Every window from the first vote to the last, quiet ones included, so the
// x-axis is real time rather than a list of the busy moments
const toColumns = (timeline: AnalyticsTimelinePointDTO[], minutes: number, optionCount: number): Column[] => {
  if (timeline.length === 0) return [];
  const last = floorLocal(Date.parse(timeline[timeline.length - 1].time), minutes);
  const columns: Column[] = [];
  const byStart = new Map<number, Column>();
  for (let t = floorLocal(Date.parse(timeline[0].time), minutes); t <= last && columns.length < 1000; t = nextLocal(t, minutes)) {
    const column = { start: t, end: nextLocal(t, minutes), votes: 0, byOption: new Array<number>(optionCount).fill(0) };
    columns.push(column);
    byStart.set(t, column);
  }
  for (const point of timeline) {
    const column = byStart.get(floorLocal(Date.parse(point.time), minutes));
    if (!column) continue;
    column.votes += point.votes;
    point.byOption.forEach((n, i) => {
      if (i < optionCount) column.byOption[i] += n;
    });
  }
  return columns;
};

// A clean top for a 0 / half / top axis: whole numbers while small, then
// steps of 5, 50, 500…
const niceMax = (v: number) => {
  const half = Math.max(1, v / 2);
  if (half <= 10) return Math.ceil(half) * 2;
  const step = 10 ** Math.floor(Math.log10(half)) / 2;
  return Math.ceil(half / step) * step * 2;
};

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const tickNumber = (n: number) => (n >= 10_000 ? compact.format(n) : n.toLocaleString("en-US"));

/* --------------------------------- labels --------------------------------- */

const windowLabel = (c: Column, minutes: number, multiDay: boolean) => {
  if (minutes >= 10080) return `Week of ${formatDay(c.start)}`;
  if (minutes >= 1440) return formatWeekday(c.start);
  const range = `${formatTime(c.start)} – ${formatTime(c.end)}`;
  return multiDay ? `${formatDay(c.start)} · ${range}` : range;
};

const tickLabel = (t: number, minutes: number, multiDay: boolean) => {
  if (minutes >= 1440) return formatDay(t);
  return multiDay ? `${formatDay(t)}, ${formatTimeShort(t)}` : formatTimeShort(t);
};

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

// Advance width of an 11px Space Mono character, for sizing axis labels
const TICK_CHAR_PX = 6.7;

// Width of an element, kept current as it resizes. A callback ref, so it
// starts measuring whenever the element appears (the plot only renders once
// there are enough votes).
function useWidth() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [setEl, width] as const;
}

/* ---------------------------------- chart ---------------------------------- */

interface VoteTimelineProps {
  timeline: AnalyticsTimelinePointDTO[];
  options: OptionDTO[];
  pollType: PollType;
  // Option highlighted from elsewhere on the page (-1 for none)
  focus: number;
  onFocusChange: (option: number) => void;
}

export default function VoteTimeline({ timeline, options, pollType, focus, onFocusChange }: VoteTimelineProps) {
  const uid = useId();
  const [chosenMinutes, setChosenMinutes] = useState<number | null>(null);
  const [hidden, setHidden] = useState<boolean[]>(() => options.map(() => false));
  const [hover, setHover] = useState(-1);
  const [plotRef, plotWidth] = useWidth();
  const [tableOpen, setTableOpen] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // Offer the intervals that fit, finest first, skipping any that would fold
  // everything into one column; at most three
  const intervals = useMemo(() => {
    if (timeline.length === 0) return [INTERVALS[0]];
    const first = Date.parse(timeline[0].time);
    const last = Date.parse(timeline[timeline.length - 1].time);
    const sized = INTERVALS.map((iv) => ({ iv, n: countColumns(first, last, iv.minutes) }));
    const fitting = sized.filter((s) => s.n <= MAX_COLUMNS);
    const usable = fitting.length > 0 ? fitting : sized.slice(-1);
    return usable.filter((s, i) => i === 0 || s.n > 1).slice(0, 3).map((s) => s.iv);
  }, [timeline]);

  // Keeps the chosen interval while it's still on offer (live votes can widen the range)
  const interval = intervals.find((iv) => iv.minutes === chosenMinutes) ?? intervals[0];
  const minutes = interval.minutes;
  const columns = useMemo(() => toColumns(timeline, minutes, options.length), [timeline, minutes, options.length]);

  const isHidden = (i: number) => hidden[i] ?? false;
  const toggle = (i: number) =>
    setHidden((prev) => {
      const next = options.map((_, j) => (j === i ? !(prev[j] ?? false) : (prev[j] ?? false)));
      // Hiding the last one shows everything again rather than an empty chart
      return next.every(Boolean) ? options.map(() => false) : next;
    });

  if (columns.length === 0) {
    return <p className="rounded-xl border border-dashed border-qp-line px-5 py-10 text-center text-[15px] text-qp-muted">No votes yet. The timeline fills in as votes come in.</p>;
  }

  if (columns.length === 1) {
    const c = columns[0];
    return (
      <p className="rounded-xl border border-qp-line px-5 py-6 text-[15px] text-qp-muted">
        All {plural(c.votes, "vote", "votes")} came in between {formatTime(c.start)} and {formatTime(c.end)}
        {isSameDay(c.start, Date.now()) ? "" : ` on ${formatDay(c.start)}`}. The timeline needs votes spread over more than one 15-minute window.
      </p>
    );
  }

  const n = columns.length;
  const multiDay = !isSameDay(columns[0].start, columns[n - 1].end - 1);
  const stackOf = (c: Column) => c.byOption.reduce((sum, v, i) => sum + (isHidden(i) ? 0 : v), 0);
  const yMax = niceMax(Math.max(...columns.map(stackOf)));
  const peak = columns.reduce((best, c, i) => (c.votes > columns[best].votes ? i : best), 0);
  const hv = hover >= 0 && hover < n ? hover : -1;
  const unit = pollType === "multi" ? "pick" : "vote";

  // As many labels as fit. The outer two hug the plot edges and the rest are
  // centred, so neighbours need about one and a half label widths between them.
  const labelPx = Math.max(...columns.map((c) => tickLabel(c.start, minutes, multiDay).length)) * TICK_CHAR_PX;
  const fits = plotWidth > 0 ? Math.floor(plotWidth / (1.5 * labelPx + 12)) + 1 : 5;
  const tickCount = Math.max(2, Math.min(n, fits, minutes < 1440 && multiDay ? 3 : 5));
  const ticks =Array.from(new Set(Array.from({ length: tickCount }, (_, k) => Math.round((k * (n - 1)) / Math.max(1, tickCount - 1)))));

  // Cumulative ballots up to the end of each column, for the tooltip footer
  const running: number[] = [];
  columns.reduce((sum, c, i) => (running[i] = sum + c.votes), 0);
  const totalVotes = running[n - 1];

  const summary = (i: number) => {
    const c = columns[i];
    const parts = options.map((o, j) => `${o.text} ${c.byOption[j]}`).join(", ");
    return `${windowLabel(c, minutes, multiDay)}: ${plural(c.votes, "vote", "votes")}. ${parts}.`;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const from = hv >= 0 ? hv : peak;
    const to = { ArrowRight: from + 1, ArrowLeft: from - 1, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) {
      if (e.key === "Escape") setHover(-1);
      return;
    }
    e.preventDefault();
    setHover(Math.max(0, Math.min(n - 1, to)));
  };

  const gap = n > 30 ? "gap-[2px]" : n > 14 ? "gap-1" : "gap-2";
  const tip = hv >= 0 ? columns[hv] : null;
  const tipCenter = ((hv + 0.5) / n) * 100;

  return (
    <div className="flex flex-col gap-5">
      {/* Controls: interval, then the legend, which also hides options */}
      <div className="flex flex-col gap-4">
        {intervals.length > 1 && (
          <div role="group" aria-label="Group votes by" className="flex w-fit gap-1 rounded-[10px] bg-qp-panel p-1 [transition:background-color_.4s]">
            {intervals.map((iv) => {
              const selected = iv.minutes === minutes;
              return (
                <button
                  key={iv.minutes}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setChosenMinutes(iv.minutes);
                    setHover(-1);
                  }}
                  className={`relative h-8 whitespace-nowrap rounded-[7px] px-3 text-[13px] font-medium transition-colors ${
                    selected ? "text-qp-ink" : "text-qp-muted hover:text-qp-ink"
                  } ${focusRing}`}
                >
                  {selected && (
                    <motion.span
                      layoutId={`${uid}-interval`}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-[7px] bg-qp-bg shadow-[0_1px_2px_rgba(0,0,0,.12)]"
                    />
                  )}
                  <span className="relative">{iv.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div role="group" aria-label="Options shown" className="flex flex-wrap gap-2">
          {options.map((o, i) => {
            const off = isHidden(i);
            return (
              <button
                key={i}
                type="button"
                aria-pressed={!off}
                onClick={() => toggle(i)}
                onMouseEnter={() => onFocusChange(i)}
                onMouseLeave={() => onFocusChange(-1)}
                onFocus={() => onFocusChange(i)}
                onBlur={() => onFocusChange(-1)}
                className={`flex h-8 max-w-full items-center gap-2 rounded-full border px-3 text-[13px] font-medium [transition:border-color_.2s,color_.2s,opacity_.2s] hover:border-qp-muted ${
                  off ? "border-qp-line text-qp-muted opacity-70" : "border-qp-fieldline text-qp-ink"
                } ${focusRing}`}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 flex-none rounded-[3px] border-[1.5px] [transition:background-color_.2s]"
                  style={{ borderColor: seriesColor(i), backgroundColor: off ? "transparent" : seriesColor(i) }}
                />
                <span className="truncate">{o.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Plot: y-axis, columns, x-axis. The x-axis band is part of the height. */}
      <div className="flex gap-3">
        <div aria-hidden="true" className="relative h-[180px] w-9 flex-none font-brand-mono text-[11px] tabular-nums text-qp-muted sm:h-[220px]">
          {[yMax, yMax / 2, 0].map((v, k) => (
            <span key={k} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${k * 50}%` }}>
              {tickNumber(v)}
            </span>
          ))}
        </div>

        <div ref={plotRef} className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div
            tabIndex={0}
            role="group"
            aria-roledescription="chart"
            aria-label={`Votes over time, ${interval.label} windows. Use the arrow keys to step through them.`}
            onKeyDown={onKeyDown}
            onFocus={() => setHover((h) => (h >= 0 ? h : peak))}
            onBlur={() => setHover(-1)}
            onMouseLeave={() => setHover(-1)}
            className={`relative h-[180px] rounded-sm sm:h-[220px] ${focusRing}`}
          >
            {/* Recessive grid: hairlines at the top and halfway, a firmer baseline */}
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-qp-line" />
            <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-qp-line" />
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-qp-fieldline" />

            <div aria-hidden="true" className={`absolute inset-0 flex items-end ${gap}`}>
              {columns.map((c, i) => {
                const stack = stackOf(c);
                // Bottom-up, in option order, so every column stacks the same way
                const visible = c.byOption.map((v, j) => ({ v, j })).filter(({ v, j }) => v > 0 && !isHidden(j));
                return (
                  <div
                    key={`${minutes}:${c.start}`}
                    onMouseEnter={() => setHover(i)}
                    onClick={() => setHover(i)}
                    className={`flex h-full min-w-0 flex-1 cursor-default items-end justify-center rounded-t-[4px] [transition:background-color_.15s] ${
                      hv === i ? "bg-qp-track" : ""
                    }`}
                  >
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(stack / yMax) * 100}%` }}
                      transition={{ duration: 0.9, ease: easeOut, delay: Math.min(i, 24) * 0.012 }}
                      style={{ minHeight: stack > 0 ? 3 : 0 }}
                      className="flex w-full max-w-6 flex-col-reverse overflow-hidden rounded-t-[4px]"
                    >
                      {c.byOption.map((v, j) => {
                        const pos = visible.findIndex((s) => s.j === j);
                        const shown = pos >= 0;
                        return (
                          <span
                            key={j}
                            className="block min-h-0 basis-0 motion-safe:[transition:flex-grow_.5s_cubic-bezier(.2,.8,.2,1),margin_.5s,opacity_.2s]"
                            style={{
                              flexGrow: shown ? v : 0,
                              // A 2px gap of page colour between stacked segments
                              marginTop: shown && pos < visible.length - 1 ? 2 : 0,
                              backgroundColor: seriesColor(j),
                              opacity: !shown ? 0 : focus >= 0 && focus !== j ? 0.25 : 1,
                            }}
                          />
                        );
                      })}
                    </motion.div>
                  </div>
                );
              })}
            </div>

            {tip && (
              <motion.div
                role="presentation"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="pointer-events-none absolute bottom-[calc(100%+10px)] z-10 flex w-[240px] max-w-full flex-col gap-2.5 rounded-xl border border-qp-line bg-qp-card px-4 py-3.5 text-qp-ink shadow-[var(--qp-shadow)] motion-safe:[transition:left_.15s_ease-out]"
                // Centred on its column, but never past either edge of the plot
                style={{ left: `clamp(0px, calc(${tipCenter}% - 120px), calc(100% - 240px))` }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-brand-mono text-xs font-bold">{windowLabel(tip, minutes, multiDay)}</span>
                  <span className="whitespace-nowrap text-sm font-semibold tabular-nums">{plural(tip.votes, "vote", "votes")}</span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {options.map((o, j) => (
                    <li key={j} className={`flex items-center gap-2.5 text-[13px] ${isHidden(j) ? "opacity-40" : ""}`}>
                      <span aria-hidden="true" className="h-[3px] w-3 flex-none rounded-full" style={{ backgroundColor: seriesColor(j) }} />
                      <span className="min-w-0 flex-1 truncate text-qp-muted">{o.text}</span>
                      <span className="font-semibold tabular-nums">{tip.byOption[j].toLocaleString("en-US")}</span>
                    </li>
                  ))}
                </ul>
                <span className="text-xs text-qp-muted">
                  {running[hv].toLocaleString("en-US")} of {plural(totalVotes, "vote", "votes")} in by {formatTime(tip.end)}
                  {hv === peak && tip.votes > 0 ? " · busiest window" : ""}
                </span>
              </motion.div>
            )}
          </div>

          {/* X-axis: labels sit under their columns; the outer two hug the edges */}
          <div aria-hidden="true" className="relative h-4 font-brand-mono text-[11px] tabular-nums text-qp-muted">
            {ticks.map((i, k) => {
              const edge = k === 0 ? "start" : k === ticks.length - 1 ? "end" : "mid";
              const left = edge === "start" ? (i / n) * 100 : edge === "end" ? ((i + 1) / n) * 100 : ((i + 0.5) / n) * 100;
              return (
                <span
                  key={i}
                  className={`absolute top-0 whitespace-nowrap leading-none ${edge === "mid" ? "-translate-x-1/2" : edge === "end" ? "-translate-x-full" : ""}`}
                  style={{ left: `${left}%` }}
                >
                  {tickLabel(columns[i].start, minutes, multiDay)}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {hv >= 0 ? summary(hv) : ""}
      </span>

      <p className="text-sm text-qp-muted">
        {pollType === "multi"
          ? "Columns stack every pick, so a ballot with two picks counts twice. "
          : pollType === "ranked"
            ? "Columns show first choices. "
            : ""}
        Hover, tap or arrow through a column for its breakdown; use the legend to hide an option.
      </p>

      {/* The same numbers as a table, for anyone who'd rather not read them off the chart */}
      <div className="rounded-xl border border-qp-line [transition:border-color_.4s]">
        <button
          type="button"
          aria-expanded={tableOpen}
          aria-controls={`${uid}-table`}
          onClick={() => setTableOpen((open) => !open)}
          className={`flex h-11 w-full items-center justify-between gap-3 rounded-xl px-4 text-left text-sm font-medium [transition:background-color_.2s] hover:bg-qp-track ${focusRing}`}
        >
          View as table
          <motion.svg
            animate={{ rotate: tableOpen ? 180 : 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: easeOut }}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-qp-muted"
          >
            <path d="m6 9 6 6 6-6" />
          </motion.svg>
        </button>
        <AnimatePresence initial={false}>
          {tableOpen && (
            <motion.div
              key="table"
              id={`${uid}-table`}
              ref={tableRef}
              variants={reduceMotion ? tablePanelInstant : tablePanel}
              initial="closed"
              animate="open"
              exit="closed"
              // Once open, bring the bottom of the table into view if it unfolded below the fold
              onAnimationComplete={(definition) => {
                if (definition === "open") tableRef.current?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
              }}
              className="overflow-hidden"
            >
              <div className="max-h-[320px] overflow-auto border-t border-qp-line">
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">Votes per {interval.label} window. Windows with no votes are left out.</caption>
                  <thead className="sticky top-0 bg-qp-bg font-brand-mono text-[11px] uppercase tracking-[.04em] text-qp-muted">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-normal">Window</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-normal">Votes</th>
                      {options.map((o, j) => (
                        <th key={j} scope="col" title={o.text} className="max-w-[9rem] truncate px-3 py-2.5 text-right font-normal normal-case tracking-normal">
                          {o.text}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {columns
                      .filter((c) => c.votes > 0)
                      .map((c) => (
                        <tr key={c.start} className="border-t border-qp-line">
                          <th scope="row" className="whitespace-nowrap px-4 py-2 font-normal">
                            {windowLabel(c, minutes, multiDay)}
                          </th>
                          <td className="px-3 py-2 text-right font-semibold">{c.votes}</td>
                          {c.byOption.map((v, j) => (
                            <td key={j} className="px-3 py-2 text-right text-qp-muted">
                              {v}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {pollType === "multi" && <p className="border-t border-qp-line px-4 py-2.5 text-xs text-qp-muted">Option columns count {unit}s, so they can add up to more than the votes.</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
