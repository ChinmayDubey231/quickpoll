import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { AnimatePresence, motion } from "framer-motion";
import api from "../utils/api";
import socket from "../utils/socket";
import QRCode from "../components/QRCode";
import RollingNumber from "../components/motion/RollingNumber";
import QpToast, { useQpToast } from "../components/QpToast";
import RunoffResult from "../components/RunoffResult";
import VoteTimeline, { seriesColor } from "../components/VoteTimeline";
import { fadeUp, staggerContainer } from "../components/motion/variants";
import { durationParts, formatDay, formatMoment, formatTime, isSameDay } from "../utils/time";
import type { AnalyticsDTO, IrvResultDTO, OptionCountDTO, PollDTO, PollType } from "../types/api";

const POLL_TYPE_LABEL: Record<PollType, string> = {
  single: "Single choice",
  multi: "Multi-select",
  ranked: "Ranked choice",
};

// Live votes come in one at a time; the timeline and voter count are refetched
// once things go quiet for this long rather than after every vote
const REFRESH_MS = 1500;
const COPIED_MS = 1800;

const easeOut = [0.2, 0.8, 0.2, 1] as const;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-qp-bg";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const toCounts = (list: OptionCountDTO[] | undefined, length: number) =>
  Array.from({ length }, (_, i) => list?.find((c) => c.optionIndex === i)?.count ?? 0);

const errorMessage = (err: unknown, fallback: string): string =>
  (isAxiosError(err) && err.response?.data?.message) || fallback;

/* ------------------------------- building blocks ------------------------------- */

function Spinner() {
  return <span aria-hidden="true" className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-current border-r-transparent" />;
}

function MetaItem({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden="true">·</span>
      {children}
    </span>
  );
}

function Stat({ label, value, note, className }: { label: string; value: ReactNode; note: string; className: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-3 py-5 sm:py-6 ${className}`}>
      <dt className="font-brand-mono text-[11px] uppercase tracking-[.06em] text-qp-muted sm:text-xs">{label}</dt>
      <dd className="flex min-w-0 flex-col gap-2">
        <span className="text-[clamp(28px,3.2vw,40px)] font-medium leading-none tracking-[-0.03em]">{value}</span>
        <span className="line-clamp-2 text-sm text-qp-muted [overflow-wrap:anywhere]">{note}</span>
      </dd>
    </div>
  );
}

function SectionHeading({ id, title, aside }: { id: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="text-[22px] font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      {aside && <span className="text-sm text-qp-muted [overflow-wrap:anywhere]">{aside}</span>}
    </div>
  );
}

interface ResultRowProps {
  text: string;
  index: number;
  count: number;
  pct: number;
  badge?: string;
  dimmed: boolean;
  focused: boolean;
  onFocusChange: (option: number) => void;
}

function ResultRow({ text, index, count, pct, badge, dimmed, focused, onFocusChange }: ResultRowProps) {
  return (
    <li
      onMouseEnter={() => onFocusChange(index)}
      onMouseLeave={() => onFocusChange(-1)}
      className={`relative min-h-[64px] overflow-hidden rounded-xl border bg-qp-panel [transition:background-color_.4s,border-color_.2s,opacity_.2s] ${
        focused ? "border-qp-muted" : "border-qp-line"
      } ${dimmed ? "opacity-55" : ""}`}
    >
      <motion.div
        aria-hidden="true"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.2, ease: easeOut, delay: Math.min(index, 6) * 0.05 }}
        className="absolute inset-y-0 left-0"
        style={{ backgroundColor: `color-mix(in srgb, ${seriesColor(index)} 22%, transparent)` }}
      />
      <div className="relative flex min-h-[64px] items-center gap-3.5 px-[18px] py-2.5">
        {/* Matches this option's colour in the timeline below */}
        <span aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ backgroundColor: seriesColor(index) }} />
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          <span className="text-lg font-medium leading-snug [overflow-wrap:anywhere]">{text}</span>
          {badge && (
            <span className="flex h-6 items-center whitespace-nowrap rounded-full bg-qp-accent px-[9px] font-brand-mono text-[11px] font-bold uppercase tracking-[.04em] text-qp-accent-fg">
              {badge}
            </span>
          )}
        </span>
        <span className="flex items-baseline gap-3 whitespace-nowrap tabular-nums">
          <span className="font-brand-mono text-[13px] text-qp-muted">
            {count.toLocaleString("en-US")}
            <span className="sr-only"> {plural(count, "vote", "votes")},</span>
          </span>
          <span className="min-w-[52px] text-right text-2xl font-medium tracking-[-0.02em]">{pct}%</span>
        </span>
      </div>
    </li>
  );
}

/* ----------------------------------- aside ----------------------------------- */

interface StatusCardProps {
  poll: PollDTO;
  isOpen: boolean;
  closedAt: number | null;
  closing: boolean;
  onClose: () => void;
  onExpired: () => void;
}

// Ticks on its own so the countdown doesn't re-render the rest of the page every second
function StatusCard({ poll, isOpen, closedAt, closing, onClose, onExpired }: StatusCardProps) {
  const [now, setNow] = useState(() => Date.now());
  const created = Date.parse(poll.createdAt);
  const expires = poll.expiresAt ? Date.parse(poll.expiresAt) : null;

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && expires !== null && now >= expires) onExpired();
  }, [isOpen, expires, now, onExpired]);

  let label: string;
  let parts: ReturnType<typeof durationParts>;
  let progress: number | null;
  let note: string;
  let ends: string | null;

  if (!isOpen) {
    const end = closedAt ?? now;
    label = "Ran for";
    parts = durationParts(end - created);
    progress = 100;
    ends = `Closed ${formatMoment(end)}`;
    const automatic = expires !== null && end >= expires - 60_000;
    note = automatic
      ? "Voting closed automatically at the scheduled time. These results are final."
      : "This poll was closed by hand. These results are final.";
  } else if (expires !== null) {
    label = "Closes in";
    parts = durationParts(expires - now);
    progress = Math.min(100, Math.max(0, ((now - created) / Math.max(1, expires - created)) * 100));
    ends = `Closes ${formatMoment(expires)}`;
    note = "Results update live. Voting stops on its own when the timer runs out.";
  } else {
    label = "Open for";
    parts = durationParts(now - created);
    progress = null;
    ends = null;
    note = "Results update live. There's no closing time, so close the poll when you have the votes you need.";
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-qp-line p-6 [transition:border-color_.4s]">
      <div className="flex items-center justify-between">
        <span className="font-brand-mono text-xs uppercase tracking-[.06em] text-qp-muted">Status</span>
        <span className={`flex items-center gap-2 text-sm font-semibold ${isOpen ? "text-qp-accent-ink" : ""}`}>
          <span className={`h-[7px] w-[7px] rounded-full ${isOpen ? "bg-qp-accent motion-safe:animate-qp-pulse" : "bg-qp-muted"}`} />
          {isOpen ? "Live" : "Closed"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-qp-muted">{label}</span>
        {/* Not a live region: a value that changes every second would be read out every second */}
        <div className="flex gap-1.5">
          {parts.map((p) => (
            <div key={p.unit} className="flex flex-1 flex-col items-center gap-1.5 rounded-[10px] bg-qp-panel pb-2.5 pt-3 [transition:background-color_.4s]">
              <span className="text-[28px] font-medium leading-none tracking-[-0.03em] tabular-nums">{p.value}</span>
              <span className="font-brand-mono text-[10px] uppercase tracking-[.06em] text-qp-muted">{p.unit}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {progress !== null && (
          <div
            role="progressbar"
            aria-label="Voting window used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            className="h-1 overflow-hidden rounded-sm bg-qp-track"
          >
            <div
              className={`h-full rounded-sm motion-safe:[transition:width_1s_linear,background-color_.4s] ${isOpen ? "bg-qp-accent" : "bg-qp-muted"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 font-brand-mono text-xs text-qp-muted">
          <span>Opened {formatMoment(created)}</span>
          {ends && <span>{ends}</span>}
        </div>
      </div>

      <p className="text-sm leading-[1.45] text-qp-muted">{note}</p>

      {isOpen && (
        <button
          type="button"
          onClick={onClose}
          disabled={closing}
          className={`flex h-11 items-center justify-center gap-2 rounded-[10px] border border-qp-fieldline text-[15px] font-semibold [transition:background-color_.2s,border-color_.2s,color_.2s,transform_.12s] enabled:hover:border-qp-error enabled:hover:bg-qp-errbg enabled:hover:text-qp-error enabled:active:scale-[.985] disabled:cursor-wait disabled:opacity-60 ${focusRing}`}
        >
          {closing && <Spinner />}
          {closing ? "Closing" : "Close poll now"}
        </button>
      )}
    </div>
  );
}

function ShareCard({ url, isOpen, onCopyError }: { url: string; isOpen: boolean; onCopyError: () => void }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      onCopyError();
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-qp-line bg-qp-panel p-6 [transition:background-color_.4s,border-color_.4s]">
      <span className="font-brand-mono text-xs uppercase tracking-[.06em] text-qp-muted">Share</span>
      <div className="flex items-center gap-4">
        <div className="flex-none rounded-xl bg-white p-2">
          <QRCode url={url} size={96} />
        </div>
        <p className="text-sm leading-[1.45] text-qp-muted">
          {isOpen ? "Scan to open the poll and vote." : "Scan to open the poll. Voting has closed, so visitors see these results."}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="qp-share-link" className="text-sm font-medium">
          Poll link
        </label>
        <input
          id="qp-share-link"
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-full min-w-0 text-ellipsis rounded-[9px] border border-qp-fieldline bg-qp-field px-3 font-brand-mono text-[13px] text-qp-ink outline-none [transition:border-color_.2s,box-shadow_.2s,background-color_.4s] focus:border-qp-accent focus:shadow-[0_0_0_3px_var(--qp-ring)]"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copy}
          className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] bg-qp-accent text-[15px] font-semibold text-qp-accent-fg [transition:filter_.2s,transform_.12s] hover:brightness-110 active:scale-[.985] ${focusRing}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? "copied" : "copy"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              className="flex items-center gap-2"
            >
              {copied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
                  <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
                </svg>
              )}
              {copied ? "Copied" : "Copy link"}
            </motion.span>
          </AnimatePresence>
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={`flex h-11 flex-none items-center gap-2 rounded-[10px] border border-qp-fieldline px-4 text-[15px] font-semibold text-qp-ink [transition:background-color_.2s,border-color_.2s] hover:border-qp-ink hover:bg-qp-track hover:no-underline ${focusRing}`}
        >
          Open
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17 17 7M8 7h9v9" />
          </svg>
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
      <span className="sr-only" role="status">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}

/* ------------------------------- loading / error ------------------------------- */

function AnalyticsSkeleton() {
  const block = "animate-pulse rounded-md bg-qp-track";
  return (
    <div aria-busy="true" className="pt-3 font-brand md:pt-6 lg:pt-8">
      <span role="status" className="sr-only">
        Loading results
      </span>
      <div aria-hidden="true">
        <span className={`block h-4 w-56 ${block}`} />
        <span className={`mt-[18px] block h-11 w-4/5 max-w-[640px] ${block}`} />
        <div className="mt-10 grid grid-cols-1 border-y border-qp-line sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`flex flex-col gap-3 py-5 sm:py-6 ${i > 0 ? "border-t border-qp-line sm:border-l sm:border-t-0 sm:pl-6" : "sm:pr-6"}`}>
              <span className={`h-3 w-24 ${block}`} />
              <span className={`h-9 w-28 ${block}`} />
              <span className={`h-3.5 w-36 ${block}`} />
            </div>
          ))}
        </div>
        <div className="mt-12 grid gap-12 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-14">
          <div className="flex flex-col gap-2.5">
            <span className={`mb-2 h-6 w-36 ${block}`} />
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-16 animate-pulse rounded-xl bg-qp-track" style={{ opacity: 1 - i * 0.15 }} />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <span className="h-[300px] animate-pulse rounded-2xl bg-qp-track" />
            <span className="h-[300px] animate-pulse rounded-2xl bg-qp-track" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className="pt-3 font-brand text-qp-ink md:pt-6 lg:pt-8">
      <div className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-2 text-center">
        <h1 className="text-[28px] font-medium tracking-[-0.03em]">Couldn't load the results</h1>
        <p className="text-[15px] text-qp-muted">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={`mt-4 h-11 rounded-[10px] border border-qp-fieldline px-5 text-[15px] font-semibold transition-colors hover:border-qp-ink hover:bg-qp-track ${focusRing}`}
          >
            Try again
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ----------------------------------- page ----------------------------------- */

export default function PollAnalytics() {
  const { id: pollId } = useParams<{ id: string }>();
  const { toast, showToast } = useQpToast();

  const [poll, setPoll] = useState<PollDTO | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsDTO | null>(null);
  const [counts, setCounts] = useState<number[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loadError, setLoadError] = useState<{ message: string; retry: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [closing, setClosing] = useState(false);
  // The countdown reached zero; the server closes the poll moments later
  const [expired, setExpired] = useState(false);
  // Option highlighted across the results list and the timeline (-1 for none)
  const [focus, setFocus] = useState(-1);
  const refreshTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!pollId) return;
    let cancelled = false;
    setLoadError(null);
    Promise.all([api.get<PollDTO>(`/polls/${pollId}`), api.get<AnalyticsDTO>(`/polls/${pollId}/analytics`)])
      .then(([pollRes, analyticsRes]) => {
        if (cancelled) return;
        setPoll(pollRes.data);
        setAnalytics(analyticsRes.data);
        setCounts(toCounts(pollRes.data.counts, pollRes.data.options.length));
        setTotalVotes(pollRes.data.totalVotes ?? analyticsRes.data.totalVotes);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = isAxiosError(err) ? err.response?.status : undefined;
        if (status === 403) setLoadError({ message: "Only the person who created this poll can see its results.", retry: false });
        else if (status === 404) setLoadError({ message: "This poll doesn't exist. It may have been deleted.", retry: false });
        else setLoadError({ message: "The server may be waking up. Give it a moment and try again.", retry: true });
      });
    return () => {
      cancelled = true;
    };
  }, [pollId, attempt]);

  const refreshAnalytics = useCallback(() => {
    if (!pollId) return;
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      api
        .get<AnalyticsDTO>(`/polls/${pollId}/analytics`)
        .then(({ data }) => setAnalytics(data))
        .catch(() => {});
    }, REFRESH_MS);
  }, [pollId]);

  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  // Live: counts move with every vote; the timeline and voter count catch up shortly after
  useEffect(() => {
    if (!pollId) return;
    const join = () => socket.emit("join-poll", { pollId });
    const onVoteUpdate = ({ counts: c, totalVotes: t }: { counts: OptionCountDTO[]; totalVotes: number }) => {
      setCounts((prev) => toCounts(c, Math.max(c.length, prev.length)));
      setTotalVotes(t);
      refreshAnalytics();
    };
    const onPollClosed = ({ finalResult }: { finalResult?: IrvResultDTO | null }) => {
      setPoll((p) => (p ? { ...p, isOpen: false, updatedAt: new Date().toISOString(), finalResult: finalResult ?? p.finalResult } : p));
      if (finalResult) setAnalytics((a) => (a ? { ...a, irv: finalResult } : a));
    };
    socket.on("connect", join);
    socket.on("vote-update", onVoteUpdate);
    socket.on("poll-closed", onPollClosed);
    if (socket.connected) join();
    else socket.connect();
    return () => {
      socket.off("connect", join);
      socket.off("vote-update", onVoteUpdate);
      socket.off("poll-closed", onPollClosed);
      socket.disconnect();
    };
  }, [pollId, refreshAnalytics]);

  useEffect(() => {
    if (!poll) return;
    const previous = document.title;
    document.title = `Results: ${poll.question} · QuickPoll`;
    return () => {
      document.title = previous;
    };
  }, [poll]);

  const handleExpired = useCallback(() => setExpired(true), []);

  const handleClose = async () => {
    if (!pollId) return;
    setClosing(true);
    try {
      const { data } = await api.patch<{ poll: PollDTO }>(`/polls/${pollId}/close`);
      setPoll((p) => (p ? { ...p, ...data.poll, isOpen: false } : p));
      if (data.poll.finalResult) {
        const irv = data.poll.finalResult;
        setAnalytics((a) => (a ? { ...a, irv } : a));
      }
      showToast("Poll closed");
    } catch (err) {
      showToast(errorMessage(err, "Couldn't close the poll. Try again."));
    } finally {
      setClosing(false);
    }
  };

  if (loadError) {
    return <AnalyticsError message={loadError.message} onRetry={loadError.retry ? () => setAttempt((n) => n + 1) : undefined} />;
  }
  if (!poll || !analytics) return <AnalyticsSkeleton />;

  /* ------------------------------- derived ------------------------------- */

  const expiresAt = poll.expiresAt ? Date.parse(poll.expiresAt) : null;
  const isOpen = poll.isOpen && !expired && (expiresAt === null || expiresAt > Date.now());
  // When voting stopped: the scheduled time if it got there first, else when it was closed
  const closedAt = isOpen ? null : poll.isOpen ? (expiresAt ?? Date.now()) : Math.min(expiresAt ?? Infinity, Date.parse(poll.updatedAt));

  const shareUrl = `${window.location.origin}/poll/${poll._id}`;
  const optionCount = poll.options.length;
  const ranked = poll.pollType === "ranked";
  const pctOf = (count: number) => (totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0);

  const maxCount = Math.max(0, ...counts);
  const leaders = maxCount > 0 ? counts.flatMap((c, i) => (c === maxCount ? [i] : [])) : [];

  // Ranked polls are decided by the runoff, which may not be the first-choice leader
  const irv = ranked && analytics.irv && analytics.irv.rounds.length > 0 ? analytics.irv : null;
  const runoffWinner = irv?.winnerIndex ?? null;

  let badgeFor: (i: number) => string | undefined;
  let resultsAside: string;
  if (totalVotes === 0) {
    badgeFor = () => undefined;
    resultsAside = "No votes yet";
  } else if (ranked && runoffWinner !== null) {
    badgeFor = (i) => (i === runoffWinner ? (isOpen ? "Runoff leader" : "Runoff winner") : undefined);
    resultsAside = `${poll.options[runoffWinner]?.text} ${isOpen ? "leads the runoff" : "won the runoff"}`;
  } else if (leaders.length > 1) {
    badgeFor = (i) => (leaders.includes(i) ? "Tied" : undefined);
    resultsAside = `${leaders.length} options tied for the lead`;
  } else {
    badgeFor = (i) => (i === leaders[0] ? (isOpen ? "Leading" : "Winner") : undefined);
    resultsAside = `${poll.options[leaders[0]]?.text} ${isOpen ? "leads" : "won"}`;
  }

  // Busiest 15-minute window, in the viewer's time
  const peakPoint = analytics.timeline.reduce<AnalyticsDTO["timeline"][number] | null>(
    (best, p) => (p.votes > (best?.votes ?? 0) ? p : best),
    null,
  );
  const peakStart = peakPoint ? Date.parse(peakPoint.time) : null;

  let leadLabel = isOpen ? "Leading option" : "Top option";
  let leadValue: ReactNode = "—";
  let leadNote = "No votes yet";
  if (ranked && irv && runoffWinner !== null) {
    const finalRound = irv.rounds[irv.rounds.length - 1];
    const finalTotal = finalRound.tallies.reduce((s, t) => s + t.votes, 0);
    const winnerVotes = finalRound.tallies.find((t) => t.optionIndex === runoffWinner)?.votes ?? 0;
    leadLabel = isOpen ? "Runoff leader" : "Runoff winner";
    leadValue = `${finalTotal > 0 ? Math.round((winnerVotes / finalTotal) * 100) : 0}%`;
    leadNote = `${poll.options[runoffWinner]?.text} · final round`;
  } else if (leaders.length === 1) {
    leadValue = `${pctOf(maxCount)}%`;
    leadNote = poll.options[leaders[0]]?.text ?? "";
  } else if (leaders.length > 1) {
    leadValue = `${pctOf(maxCount)}%`;
    leadNote = `Tied: ${leaders.map((i) => poll.options[i]?.text).join(", ")}`;
  }

  const resultsNote =
    poll.pollType === "multi"
      ? "Share of voters who picked each option, so the total can pass 100%."
      : ranked
        ? isOpen
          ? "First choices so far. The winner is decided by instant runoff when the poll closes."
          : "First choices. The winner was decided by instant runoff."
        : null;

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="pt-3 font-brand text-qp-ink md:pt-6 lg:pt-8">
      <motion.header variants={fadeUp} className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-[18px]">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-brand-mono text-[13px] uppercase tracking-[.04em] text-qp-muted">
            {isOpen ? (
              <span className="flex items-center gap-2 text-qp-accent-ink">
                <span className="h-[7px] w-[7px] rounded-full bg-current motion-safe:animate-qp-pulse" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                Closed
              </span>
            )}
            <MetaItem>{POLL_TYPE_LABEL[poll.pollType]}</MetaItem>
            <MetaItem>
              {optionCount} {plural(optionCount, "option", "options")}
            </MetaItem>
            {poll.isPublic && <MetaItem>Public</MetaItem>}
          </div>
          <h1 className="text-[clamp(30px,4vw,48px)] font-medium leading-[1.08] tracking-[-0.035em] [overflow-wrap:anywhere] [text-wrap:balance]">
            {poll.question}
          </h1>
        </div>
        <p className="flex items-baseline gap-2.5">
          <RollingNumber value={totalVotes} className="text-[clamp(40px,4.5vw,56px)] font-medium leading-none tracking-[-0.04em]" />
          <span className="text-base text-qp-muted">{plural(totalVotes, "vote", "votes")}</span>
        </p>
      </motion.header>

      <motion.dl variants={fadeUp} className="mt-10 grid grid-cols-1 border-y border-qp-line sm:grid-cols-3">
        <Stat
          label="Unique voters"
          value={<RollingNumber value={analytics.uniqueVoters} />}
          note="Counted by browser fingerprint"
          className="sm:pr-6"
        />
        <Stat
          label="Peak activity"
          value={peakStart !== null ? formatTime(peakStart) : "—"}
          note={
            peakStart === null
              ? "No votes yet"
              : `Busiest 15-min window${isSameDay(peakStart, Date.now()) ? "" : ` · ${formatDay(peakStart)}`}`
          }
          className="border-t border-qp-line sm:border-l sm:border-t-0 sm:px-6"
        />
        <Stat label={leadLabel} value={leadValue} note={leadNote} className="border-t border-qp-line sm:border-l sm:border-t-0 sm:pl-6" />
      </motion.dl>

      {/* Two columns on wide screens. Narrower, the wrapper drops out (display:
          contents) so the status and share cards can sit between the results
          and the longer sections below them. */}
      <motion.div variants={fadeUp} className="mt-12 flex flex-col gap-12 xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-14">
        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-12">
          <section aria-labelledby="results-heading" className="order-1 flex min-w-0 flex-col gap-[18px]">
            <SectionHeading id="results-heading" title={isOpen ? "Live results" : "Final results"} aside={resultsAside} />
            {resultsNote && <p className="-mt-1.5 text-[15px] text-qp-muted">{resultsNote}</p>}
            <ul className="flex flex-col gap-2.5">
              {poll.options.map((opt, i) => (
                <ResultRow
                  key={i}
                  text={opt.text}
                  index={i}
                  count={counts[i] ?? 0}
                  pct={pctOf(counts[i] ?? 0)}
                  badge={badgeFor(i)}
                  dimmed={focus >= 0 && focus !== i}
                  focused={focus === i}
                  onFocusChange={setFocus}
                />
              ))}
            </ul>
          </section>

          {ranked && irv && (
            <section aria-labelledby="runoff-heading" className="order-3 flex min-w-0 flex-col gap-[18px]">
              <SectionHeading
                id="runoff-heading"
                title="Instant-runoff rounds"
                aside={isOpen ? "What would happen if the poll closed now" : "How the winner was decided"}
              />
              <RunoffResult result={irv} options={poll.options} winnerLabel={isOpen ? "Leading" : "Winner"} />
            </section>
          )}

          <section aria-labelledby="timeline-heading" className="order-4 flex min-w-0 flex-col gap-[18px]">
            <SectionHeading id="timeline-heading" title="Votes over time" />
            <VoteTimeline timeline={analytics.timeline} options={poll.options} pollType={poll.pollType} focus={focus} onFocusChange={setFocus} />
          </section>
        </div>

        <aside aria-label="Poll status and sharing" className="order-2 grid min-w-0 gap-4 sm:grid-cols-2 sm:items-start xl:sticky xl:top-[100px] xl:order-none xl:grid-cols-1">
          <StatusCard poll={poll} isOpen={isOpen} closedAt={closedAt} closing={closing} onClose={handleClose} onExpired={handleExpired} />
          <ShareCard url={shareUrl} isOpen={isOpen} onCopyError={() => showToast("Couldn't copy the link. Copy it from the box instead.")} />
        </aside>
      </motion.div>

      <QpToast toast={toast} />
    </motion.div>
  );
}
