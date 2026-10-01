import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import confetti from "canvas-confetti";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { isAxiosError } from "axios";
import { AnimatePresence, MotionConfig, motion, type Transition } from "framer-motion";
import api from "../utils/api";
import socket from "../utils/socket";
import Logo from "../components/Logo";
import ThemeButton from "../components/ThemeButton";
import CountdownTimer from "../components/CountdownTimer";
import RollingNumber from "../components/motion/RollingNumber";
import QpToast, { useQpToast } from "../components/QpToast";
import ReactionBar from "../components/ReactionBar";
import CommentSection from "../components/CommentSection";
import RankedChoiceVoter from "../components/RankedChoiceVoter";
import { fadeUp, springy, staggerContainer } from "../components/motion/variants";
import type { IrvResultDTO, OptionCountDTO, OptionDTO, PollDTO, PollType } from "../types/api";

const fpPromise = FingerprintJS.load();

const POLL_TYPE_LABEL: Record<PollType, string> = {
  single: "Single choice",
  multi: "Multi-select",
  ranked: "Ranked choice",
};

const LEGEND: Record<PollType, string> = {
  single: "Pick one",
  multi: "Pick as many as you like",
  ranked: "Drag to rank, most preferred first",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-qp-bg";
// Options are visually hidden inputs inside a label, so the label shows the focus
const optionFocus =
  "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-qp-accent";
const easeOut = [0.2, 0.8, 0.2, 1] as const;
const swap: Transition = { duration: 0.25, ease: easeOut };

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const fireConfetti = () => {
  confetti({
    particleCount: 110,
    spread: 75,
    origin: { y: 0.6 },
    colors: ["#ff5b1f", "#ff8f66", "#c2410c", "#9b9ba2"],
    disableForReducedMotion: true,
  });
};

// Per-option counts as a plain array indexed by option
const toCounts = (list: OptionCountDTO[] | undefined, length: number) =>
  Array.from({ length }, (_, i) => list?.find((c) => c.optionIndex === i)?.count ?? 0);

// The options this browser voted for, so a return visit can still mark them.
// The server decides who has voted; this is display only.
const voteKey = (pollId: string) => `qp:vote:${pollId}`;

const readMyVote = (pollId: string): number[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(voteKey(pollId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
};

const saveMyVote = (pollId: string, picks: number[]) => {
  try {
    localStorage.setItem(voteKey(pollId), JSON.stringify(picks));
  } catch {
    // Private mode or storage full — the "Your vote" badge just won't survive a reload
  }
};

/* ------------------------------- building blocks ------------------------------- */

function Spinner() {
  return <span aria-hidden="true" className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-current border-r-transparent" />;
}

// A meta-row item with its leading separator, so a wrapped line never starts with a dot
function MetaItem({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden="true">·</span>
      {children}
    </span>
  );
}

function PageHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="flex h-[76px] flex-none items-center justify-between gap-4 border-b border-qp-line px-[clamp(16px,2.5vw,32px)] [transition:border-color_.4s]">
      <Link to="/" className={`flex items-center gap-2.5 rounded-lg ${focusRing}`}>
        <motion.span whileHover={{ rotate: -6, scale: 1.05 }} transition={{ type: "spring", stiffness: 300, damping: 15 }} className="flex">
          <Logo size={28} />
        </motion.span>
        <span className="text-xl font-semibold tracking-[-0.02em]">QuickPoll</span>
      </Link>
      <div className="flex items-center gap-2.5">
        {children}
        <ThemeButton />
      </div>
    </header>
  );
}

function ShareButton({ onError }: { onError: () => void }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onError();
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={`flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] border border-qp-fieldline px-3.5 text-sm font-semibold [transition:background-color_.2s,border-color_.2s] hover:border-qp-ink hover:bg-qp-track ${focusRing}`}
    >
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
        </svg>
      )}
      {copied ? "Copied" : "Share"}
      <span className="sr-only" role="status">
        {copied ? "Link copied" : ""}
      </span>
    </button>
  );
}

interface ResultRowProps {
  text: string;
  count: number;
  pct: number;
  leading: boolean;
  mine: boolean;
  mineLabel: string;
  bump?: { n: number; key: number };
  delay: number;
}

function ResultRow({ text, count, pct, leading, mine, mineLabel, bump, delay }: ResultRowProps) {
  return (
    <li
      className={`relative min-h-[64px] overflow-hidden rounded-xl border bg-qp-panel [transition:background-color_.4s,border-color_.3s] ${
        mine ? "border-qp-accent" : "border-qp-line"
      }`}
    >
      <motion.div
        aria-hidden="true"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.2, ease: easeOut, delay }}
        className={`absolute inset-y-0 left-0 transition-colors duration-500 ${
          leading ? "bg-[color-mix(in_srgb,var(--qp-accent)_32%,transparent)]" : "bg-qp-track"
        }`}
      />
      <div className="relative flex min-h-[64px] items-center gap-3.5 px-[18px] py-2.5">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          <span className="text-lg font-medium leading-snug [overflow-wrap:anywhere]">{text}</span>
          {mine && (
            <span className="flex h-6 items-center gap-[5px] whitespace-nowrap rounded-full bg-qp-accent px-[9px] font-brand-mono text-[11px] font-bold uppercase tracking-[.04em] text-qp-accent-fg">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {mineLabel}
            </span>
          )}
        </span>
        <span className="flex items-baseline gap-3 whitespace-nowrap tabular-nums">
          <span className="font-brand-mono text-[13px] text-qp-muted">
            {bump && (
              <span key={bump.key} aria-hidden="true" className="mr-2 inline-block text-qp-accent-ink motion-safe:animate-qp-plus motion-reduce:opacity-0">
                +{bump.n}
              </span>
            )}
            {count.toLocaleString("en-US")}
            <span className="sr-only"> {plural(count, "vote", "votes")},</span>
          </span>
          <span className="min-w-[52px] text-right text-2xl font-medium tracking-[-0.02em]">{pct}%</span>
        </span>
      </div>
    </li>
  );
}

// Final instant-runoff result for a closed ranked-choice poll
function RunoffResult({ result, options }: { result: IrvResultDTO; options: OptionDTO[] }) {
  if (result.rounds.length === 0) {
    return <p className="text-[15px] text-qp-muted">No ranked ballots were cast.</p>;
  }
  const winner = result.winnerIndex !== null ? options[result.winnerIndex]?.text : undefined;

  return (
    <div className="flex flex-col gap-7">
      {winner && (
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-xl border border-qp-accent bg-[color-mix(in_srgb,var(--qp-accent)_12%,transparent)] px-[18px] py-4">
          <span className="font-brand-mono text-xs font-bold uppercase tracking-[.04em] text-qp-accent-ink">Winner</span>
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

function BallotSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden="true" className="mt-9 flex flex-col gap-2.5">
      <span className="mb-1.5 h-4 w-20 animate-pulse rounded bg-qp-track" />
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="h-[60px] animate-pulse rounded-xl bg-qp-track" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

/* ----------------------------------- page ----------------------------------- */

export default function PollView() {
  const { id: pollId } = useParams<{ id: string }>();
  const { toast, showToast } = useQpToast();

  const [poll, setPoll] = useState<PollDTO | null>(null);
  const [counts, setCounts] = useState<number[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [finalResult, setFinalResult] = useState<IrvResultDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [rankedOrder, setRankedOrder] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [voteError, setVoteError] = useState("");
  const [voted, setVoted] = useState(false);
  const [myVote, setMyVote] = useState<number[]>([]);
  // Showing the results before voting; reactions and the discussion stay hidden
  const [peeking, setPeeking] = useState(false);

  const [checkingVoteStatus, setCheckingVoteStatus] = useState(true);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [fingerprintReady, setFingerprintReady] = useState(false);

  // Options whose count just went up, for the "+1" flash beside the count
  const [bumps, setBumps] = useState<Record<number, { n: number; key: number }>>({});
  const countsRef = useRef<number[]>([]);
  const bumpSeq = useRef(0);

  // New counts from the vote response or a live update. Rises against the
  // previous counts flash beside the option that got them.
  const applyCounts = useCallback((list: OptionCountDTO[], total: number) => {
    const prev = countsRef.current;
    const next = toCounts(list, Math.max(list.length, prev.length));
    const risen: Record<number, { n: number; key: number }> = {};
    next.forEach((count, i) => {
      const diff = count - (prev[i] ?? 0);
      if (diff > 0) risen[i] = { n: diff, key: ++bumpSeq.current };
    });
    countsRef.current = next;
    setCounts(next);
    setTotalVotes(total);
    if (Object.keys(risen).length > 0) setBumps((b) => ({ ...b, ...risen }));
  }, []);

  useEffect(() => {
    fpPromise
      .then((fp) => fp.get())
      .then((r) => setFingerprint(r.visitorId))
      .catch(() => {})
      .finally(() => setFingerprintReady(true));
  }, []);

  useEffect(() => {
    if (!pollId) return;
    api
      .get<PollDTO>(`/polls/${pollId}`)
      .then(({ data }) => {
        const initial = toCounts(data.counts, data.options.length);
        countsRef.current = initial;
        setPoll(data);
        setCounts(initial);
        setTotalVotes(data.totalVotes ?? 0);
        setFinalResult(data.finalResult ?? null);
        setIsClosed(!data.isOpen);
        if (data.pollType === "ranked") setRankedOrder(data.options.map((_, i) => i));
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [pollId]);

  // Once the poll has loaded and we know the visitor's fingerprint, check
  // whether they've already voted (fingerprint/IP dedup) so a repeat visit
  // goes straight to the results, reactions and discussion.
  useEffect(() => {
    if (!pollId || !poll || !fingerprintReady) return;
    api
      .get<{ voted: boolean }>(`/votes/${pollId}/status`, { params: { fingerprint } })
      .then(({ data }) => {
        if (data.voted) {
          setVoted(true);
          setMyVote(readMyVote(pollId));
        }
      })
      .catch(() => {})
      .finally(() => setCheckingVoteStatus(false));
  }, [pollId, poll, fingerprintReady, fingerprint]);

  useEffect(() => {
    if (!pollId) return;
    // Rejoin the poll's room after a reconnect, since rooms don't survive it
    const join = () => socket.emit("join-poll", { pollId });
    const onVoteUpdate = ({ counts: c, totalVotes: t }: { counts: OptionCountDTO[]; totalVotes: number }) => applyCounts(c, t);
    const onPollClosed = ({ finalResult: fr }: { finalResult?: IrvResultDTO | null }) => {
      setIsClosed(true);
      if (fr) setFinalResult(fr);
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
  }, [pollId, applyCounts]);

  useEffect(() => {
    if (!poll) return;
    const previous = document.title;
    document.title = `${poll.question} · QuickPoll`;
    return () => {
      document.title = previous;
    };
  }, [poll]);

  const handleExpired = useCallback(() => setIsClosed(true), []);

  const toggleMultiOption = (i: number) =>
    setSelectedOptions((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  const canSubmit =
    poll?.pollType === "multi"
      ? selectedOptions.length > 0
      : poll?.pollType === "ranked"
        ? rankedOrder.length > 0
        : selectedOption !== null;

  const handleVote = async (e: FormEvent) => {
    e.preventDefault();
    if (!poll || !pollId || submitting || voted || !canSubmit) return;

    let body: { optionIndex?: number; optionIndexes?: number[]; rankings?: number[]; fingerprint: string | null };
    let picks: number[];
    if (poll.pollType === "multi") {
      picks = selectedOptions;
      body = { optionIndexes: picks, fingerprint };
    } else if (poll.pollType === "ranked") {
      picks = [rankedOrder[0]];
      body = { rankings: rankedOrder, fingerprint };
    } else {
      picks = [selectedOption as number];
      body = { optionIndex: selectedOption as number, fingerprint };
    }

    setSubmitting(true);
    setVoteError("");
    try {
      const { data } = await api.post<{ counts: OptionCountDTO[]; totalVotes: number }>(`/votes/${pollId}`, body);
      applyCounts(data.counts, data.totalVotes);
      setMyVote(picks);
      saveMyVote(pollId, picks);
      setPeeking(false);
      setVoted(true);
      fireConfetti();
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      const message: string | undefined = isAxiosError(err) ? err.response?.data?.message : undefined;
      if (status === 409) {
        // Voted before (another tab, or the status check missed it)
        setPeeking(false);
        setVoted(true);
        showToast("You've already voted on this poll.");
      } else if (message === "This poll is closed") {
        setIsClosed(true);
        showToast("This poll closed before your vote went in.");
      } else {
        setVoteError(message || "Couldn't submit your vote. Check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || loadError || !poll) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="qp-ui flex min-h-screen flex-col bg-qp-bg font-brand text-qp-ink">
          <PageHeader />
          <main className="grid flex-1 place-items-center px-5 py-16">
            {loading ? (
              <span role="status" className="flex items-center gap-3 text-[15px] text-qp-muted">
                <Spinner />
                Loading poll
              </span>
            ) : (
              <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex max-w-sm flex-col items-center gap-2 text-center">
                <h1 className="text-[28px] font-medium tracking-[-0.03em]">Poll not found</h1>
                <p className="text-[15px] text-qp-muted">It may have been deleted, or the link is incomplete.</p>
                <Link
                  to="/"
                  className={`mt-4 flex h-11 items-center rounded-[10px] bg-qp-accent px-5 text-[15px] font-semibold text-qp-accent-fg [transition:filter_.2s] hover:brightness-110 ${focusRing}`}
                >
                  Go to QuickPoll
                </Link>
              </motion.div>
            )}
          </main>
        </div>
      </MotionConfig>
    );
  }

  const showResults = voted || isClosed || peeking;
  const stage = showResults ? "results" : checkingVoteStatus ? "checking" : "ballot";

  const maxCount = Math.max(0, ...counts);
  const showRunoff = poll.pollType === "ranked" && isClosed && finalResult !== null;
  const mineLabel = poll.pollType === "ranked" ? "Your #1" : "Your vote";

  let resultsNote: string;
  if (isClosed) resultsNote = voted ? "This poll is closed. Thanks for voting." : "This poll is closed. These are the final results.";
  else if (voted) resultsNote = "Your vote has been recorded. Results update live.";
  else resultsNote = "Results update live.";

  return (
    <MotionConfig reducedMotion="user">
      <div className="qp-ui flex min-h-screen flex-col bg-qp-bg font-brand text-qp-ink [transition:background-color_.4s,color_.4s]">
        <PageHeader>
          <ShareButton onError={() => showToast("Couldn't copy the link. Copy it from the address bar.")} />
        </PageHeader>

        <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center gap-14 px-[clamp(20px,4vw,48px)] pb-20 pt-[clamp(32px,5vw,64px)] lg:flex-row lg:items-start lg:justify-center lg:gap-[clamp(40px,5vw,72px)]">
          <motion.section
            layout="position"
            transition={springy}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            aria-labelledby="poll-question"
            className="flex w-full min-w-0 max-w-[720px] flex-col lg:flex-1"
          >
            <motion.div
              variants={fadeUp}
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-brand-mono text-[13px] uppercase tracking-[.04em] text-qp-muted"
            >
              {isClosed ? (
                <span className="flex items-center gap-2">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                  Closed
                </span>
              ) : (
                <span className="flex items-center gap-2 text-qp-accent-ink">
                  <span className="h-[7px] w-[7px] rounded-full bg-current motion-safe:animate-qp-pulse" />
                  Live
                </span>
              )}
              <MetaItem>{POLL_TYPE_LABEL[poll.pollType]}</MetaItem>
              {poll.isPublic && <MetaItem>Public</MetaItem>}
              {poll.expiresAt && !isClosed && (
                <MetaItem>
                  <CountdownTimer expiresAt={poll.expiresAt} onExpired={handleExpired} />
                </MetaItem>
              )}
            </motion.div>

            <motion.h1
              id="poll-question"
              variants={fadeUp}
              className="mt-[18px] text-[clamp(34px,4vw,52px)] font-medium leading-[1.05] tracking-[-0.035em] [overflow-wrap:anywhere] [text-wrap:balance]"
            >
              {poll.question}
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-5 flex items-baseline gap-2.5">
              <RollingNumber value={totalVotes} className="text-2xl font-medium tracking-[-0.02em]" />
              <span className="text-base text-qp-muted">{plural(totalVotes, "vote", "votes")}</span>
            </motion.p>

            <motion.div variants={fadeUp}>
              <AnimatePresence mode="wait" initial={false}>
                {stage === "checking" && (
                  <motion.div key="checking" exit={{ opacity: 0, transition: swap }}>
                    <BallotSkeleton rows={poll.options.length} />
                  </motion.div>
                )}

                {stage === "ballot" && (
                  <motion.form
                    key="ballot"
                    onSubmit={handleVote}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: swap }}
                    exit={{ opacity: 0, y: -6, transition: swap }}
                    className="mt-9 flex flex-col"
                  >
                    <fieldset className="m-0 min-w-0 border-0 p-0">
                      <legend className="mb-4 p-0 text-[15px] text-qp-muted">{LEGEND[poll.pollType]}</legend>

                      {poll.pollType === "ranked" ? (
                        <RankedChoiceVoter options={poll.options} order={rankedOrder} onChange={setRankedOrder} />
                      ) : (
                        <div className="flex flex-col gap-2.5">
                          {poll.options.map((opt, i) => {
                            const multi = poll.pollType === "multi";
                            const on = multi ? selectedOptions.includes(i) : selectedOption === i;
                            return (
                              <label
                                key={i}
                                className={`relative flex min-h-[60px] cursor-pointer items-center gap-3.5 rounded-xl border px-[18px] py-3 [transition:border-color_.2s,background-color_.2s,box-shadow_.2s] ${optionFocus} ${
                                  on
                                    ? "border-qp-accent bg-[color-mix(in_srgb,var(--qp-accent)_8%,transparent)] shadow-[0_0_0_1px_var(--qp-accent)]"
                                    : "border-qp-line hover:border-qp-muted"
                                }`}
                              >
                                <input
                                  type={multi ? "checkbox" : "radio"}
                                  name="qp-vote"
                                  value={i}
                                  checked={on}
                                  onChange={() => (multi ? toggleMultiOption(i) : setSelectedOption(i))}
                                  className="sr-only"
                                />
                                {multi ? (
                                  <span
                                    aria-hidden="true"
                                    className={`grid h-5 w-5 flex-none place-items-center rounded-[6px] border-[1.5px] [transition:background-color_.2s,border-color_.2s] ${
                                      on ? "border-qp-accent bg-qp-accent text-qp-accent-fg" : "border-qp-muted"
                                    }`}
                                  >
                                    {on && (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 6 9 17l-5-5" />
                                      </svg>
                                    )}
                                  </span>
                                ) : (
                                  <span
                                    aria-hidden="true"
                                    className={`box-border h-5 w-5 flex-none rounded-full [transition:border_.2s] ${
                                      on ? "border-[6px] border-qp-accent" : "border-[1.5px] border-qp-muted"
                                    }`}
                                  />
                                )}
                                <span className="text-lg font-medium leading-snug [overflow-wrap:anywhere]">{opt.text}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </fieldset>

                    {voteError && (
                      <p role="alert" className="mt-4 text-[15px] text-qp-error">
                        {voteError}
                      </p>
                    )}

                    <div className="mt-6 flex flex-wrap items-center gap-4">
                      <button
                        type="submit"
                        disabled={!canSubmit || submitting}
                        className={`flex h-[52px] min-w-[180px] items-center justify-center gap-2.5 rounded-[10px] bg-qp-accent px-6 text-base font-semibold text-qp-accent-fg [transition:filter_.2s,transform_.12s,opacity_.2s] enabled:hover:brightness-110 enabled:active:scale-[.985] disabled:cursor-not-allowed ${
                          canSubmit ? "" : "opacity-[.45]"
                        } ${focusRing}`}
                      >
                        {submitting && <Spinner />}
                        {submitting ? "Submitting" : "Submit vote"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPeeking(true)}
                        className={`h-11 rounded px-1 text-[15px] font-medium text-qp-muted underline underline-offset-[3px] transition-colors hover:text-qp-ink ${focusRing}`}
                      >
                        See results first
                      </button>
                    </div>
                  </motion.form>
                )}

                {stage === "results" && (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: swap }}
                    exit={{ opacity: 0, y: -6, transition: swap }}
                    className="mt-9 flex flex-col gap-2.5"
                  >
                    {showRunoff && finalResult ? (
                      <RunoffResult result={finalResult} options={poll.options} />
                    ) : (
                      <>
                        {poll.pollType === "ranked" && (
                          <p className="mb-1.5 text-[15px] text-qp-muted">
                            First-choice votes so far. The winner is decided by instant runoff when the poll closes.
                          </p>
                        )}
                        {poll.pollType === "multi" && (
                          <p className="mb-1.5 text-[15px] text-qp-muted">Share of voters who picked each option.</p>
                        )}
                        <ul className="flex flex-col gap-2.5">
                          {poll.options.map((opt, i) => {
                            const count = counts[i] ?? 0;
                            return (
                              <ResultRow
                                key={i}
                                text={opt.text}
                                count={count}
                                pct={totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0}
                                leading={maxCount > 0 && count === maxCount}
                                mine={voted && myVote.includes(i)}
                                mineLabel={mineLabel}
                                bump={bumps[i]}
                                delay={Math.min(i, 6) * 0.05}
                              />
                            );
                          })}
                        </ul>
                      </>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-qp-muted">
                      <span>{resultsNote}</span>
                      {peeking && !voted && !isClosed && (
                        <button
                          type="button"
                          onClick={() => setPeeking(false)}
                          className={`h-11 rounded px-1 text-[15px] font-medium text-qp-accent-ink underline-offset-[3px] hover:underline ${focusRing}`}
                        >
                          Back to voting
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Reactions and the discussion open up only once you've voted */}
            <AnimatePresence>
              {voted && (
                <motion.div
                  key="reactions"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { ...springy, delay: 0.2 } }}
                  className="mt-10 border-t border-qp-line pt-6 [transition:border-color_.4s]"
                >
                  <ReactionBar pollId={poll._id} fingerprint={fingerprint} onError={() => showToast("Couldn't save your reaction. Try again.")} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>

          <AnimatePresence>
            {voted && (
              <motion.aside
                key="discussion"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { ...springy, delay: 0.3 } }}
                className="w-full min-w-0 max-w-[720px] lg:w-[clamp(320px,34%,420px)] lg:flex-none"
              >
                <CommentSection pollId={poll._id} />
              </motion.aside>
            )}
          </AnimatePresence>
        </main>

        <QpToast toast={toast} className="bottom-6" />
      </div>
    </MotionConfig>
  );
}
