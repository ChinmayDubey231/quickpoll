import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import confetti from "canvas-confetti";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { isAxiosError } from "axios";
import api from "../utils/api";
import socket from "../utils/socket";
import LiveBarChart from "../components/LiveBarChart";
import CountdownTimer from "../components/CountdownTimer";
import Spinner from "../components/shared/Spinner";
import ErrorState from "../components/shared/ErrorState";
import Logo from "../components/Logo";
import ReactionBar from "../components/ReactionBar";
import CommentSection from "../components/CommentSection";
import RankedChoiceVoter from "../components/RankedChoiceVoter";
import IrvRoundsChart from "../components/IrvRoundsChart";
import { seriesColors } from "../utils/chartTheme";
import type { PollDTO, OptionCountDTO, IrvResultDTO } from "../types/api";

const fpPromise = FingerprintJS.load();

const fireConfetti = () => {
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.65 },
    colors: ["#cdbdff", "#44ddc1", "#f59e0b", "#bdc2ff"],
  });
};

const OPTION_COLORS = [
  "border-primary/40 hover:border-primary hover:bg-primary/10",
  "border-secondary/40 hover:border-secondary hover:bg-secondary/10",
  "border-tertiary/40 hover:border-tertiary hover:bg-tertiary/10",
  "border-error/40 hover:border-error hover:bg-error/10",
  "border-primary/40 hover:border-primary hover:bg-primary/10",
  "border-secondary/40 hover:border-secondary hover:bg-secondary/10",
];
const SELECTED_COLORS = [
  "border-primary bg-primary/20 text-primary",
  "border-secondary bg-secondary/20 text-secondary",
  "border-tertiary bg-tertiary/20 text-tertiary",
  "border-error bg-error/20 text-error",
  "border-primary bg-primary/20 text-primary",
  "border-secondary bg-secondary/20 text-secondary",
];

export default function PollView() {
  const { id: pollId } = useParams<{ id: string }>();
  const [poll, setPoll] = useState<PollDTO | null>(null);
  const [counts, setCounts] = useState<OptionCountDTO[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [finalResult, setFinalResult] = useState<IrvResultDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [voted, setVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [rankedOrder, setRankedOrder] = useState<number[]>([]);
  const [voting, setVoting] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [checkingVoteStatus, setCheckingVoteStatus] = useState(true);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [fingerprintReady, setFingerprintReady] = useState(false);
  const fingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    fpPromise
      .then((fp) => fp.get())
      .then((r) => {
        fingerprintRef.current = r.visitorId;
        setFingerprint(r.visitorId);
      })
      .catch(() => {})
      .finally(() => setFingerprintReady(true));
  }, []);

  // Once the poll has loaded and we know the visitor's fingerprint, check
  // whether they've already voted (fingerprint/IP dedup) so we can show
  // results directly instead of the ballot on a repeat visit.
  useEffect(() => {
    if (!pollId || !poll || !fingerprintReady) return;
    api
      .get<{ voted: boolean }>(`/votes/${pollId}/status`, { params: { fingerprint } })
      .then(({ data }) => {
        if (data.voted) setVoted(true);
      })
      .catch(() => {})
      .finally(() => setCheckingVoteStatus(false));
  }, [pollId, poll, fingerprintReady, fingerprint]);

  useEffect(() => {
    if (!pollId) return;
    const load = async () => {
      try {
        const { data } = await api.get<PollDTO>(`/polls/${pollId}`);
        setPoll(data);
        setCounts(data.counts ?? []);
        setTotalVotes(data.totalVotes ?? 0);
        setFinalResult(data.finalResult ?? null);
        setIsClosed(!data.isOpen);
        if (data.pollType === "ranked") {
          setRankedOrder(data.options.map((_, i) => i));
        }
      } catch {
        setError("Poll not found or unavailable");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pollId]);

  useEffect(() => {
    if (!pollId) return;
    socket.connect();
    socket.emit("join-poll", { pollId });
    const onVoteUpdate = ({ counts: c, totalVotes: t }: { counts: OptionCountDTO[]; totalVotes: number }) => {
      setCounts(c);
      setTotalVotes(t);
    };
    const onPollClosed = ({ finalResult: fr }: { finalResult?: IrvResultDTO | null }) => {
      setIsClosed(true);
      if (fr) setFinalResult(fr);
    };
    socket.on("vote-update", onVoteUpdate);
    socket.on("poll-closed", onPollClosed);
    return () => {
      socket.off("vote-update", onVoteUpdate);
      socket.off("poll-closed", onPollClosed);
      socket.disconnect();
    };
  }, [pollId]);

  const toggleMultiOption = (i: number) => {
    setSelectedOptions((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );
  };

  const handleVote = async () => {
    if (!poll || voting || voted) return;

    let body: { optionIndex?: number; optionIndexes?: number[]; rankings?: number[]; fingerprint: string | null };
    if (poll.pollType === "multi") {
      if (selectedOptions.length === 0) return;
      body = { optionIndexes: selectedOptions, fingerprint: fingerprintRef.current };
    } else if (poll.pollType === "ranked") {
      body = { rankings: rankedOrder, fingerprint: fingerprintRef.current };
    } else {
      if (selectedOption === null) return;
      body = { optionIndex: selectedOption, fingerprint: fingerprintRef.current };
    }

    setVoting(true);
    try {
      const { data } = await api.post(`/votes/${pollId}`, body);
      setCounts(data.counts);
      setTotalVotes(data.totalVotes);
      setVoted(true);
      fireConfetti();
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message || "Failed to cast vote");
    } finally {
      setVoting(false);
    }
  };

  const handleExpired = useCallback(() => setIsClosed(true), []);

  if (loading)
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <Spinner />
      </div>
    );

  if (error && !poll)
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center px-4">
        <ErrorState icon="link_off" title="Poll not found" description={error} backTo="/" backLabel="Go home" />
      </div>
    );

  if (!poll) return null;

  const canVote = !voted && !isClosed && !checkingVoteStatus;
  const canSubmit =
    poll.pollType === "multi" ? selectedOptions.length > 0 : poll.pollType === "ranked" ? rankedOrder.length > 0 : selectedOption !== null;

  return (
    <div className="min-h-screen bg-[#0B0E14]">
      {/* Background glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-secondary-container/8 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant">
        {/* Left — logo + wordmark */}
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="font-display font-bold text-xl text-primary tracking-tight">
            QuickPoll
          </span>
        </div>

        {/* Center — poll question preview (hidden on mobile) */}
        <div className="hidden md:block flex-1 mx-8 min-w-0">
          <p className="text-sm text-on-surface-variant font-medium truncate text-center">
            {poll.question}
          </p>
        </div>

        {/* Right — status + vote count + timer */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-xs font-mono text-on-surface-variant">
            {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
          </span>
          {isClosed ? (
            <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-surface-container text-on-surface-variant rounded-full border border-outline-variant">
              Closed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-secondary-container/20 text-secondary rounded-full border border-secondary/30">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              Live
            </span>
          )}
          {poll.expiresAt && !isClosed && (
            <CountdownTimer expiresAt={poll.expiresAt} onExpired={handleExpired} />
          )}
        </div>
      </header>

      <main className="pt-24 pb-12 px-4 max-w-2xl mx-auto relative space-y-4">
        {/* Poll card */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-mono text-on-surface-variant">
              {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
            </span>
            {poll.pollType !== "single" && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full border border-outline-variant">
                {poll.pollType === "multi" ? "Pick multiple" : "Ranked choice"}
              </span>
            )}
          </div>

          <h1 className="font-display font-bold text-xl text-on-surface mb-4 leading-snug">
            {poll.question}
          </h1>

          <div className="mb-6">
            <ReactionBar pollId={poll._id} fingerprint={fingerprintRef.current} />
          </div>

          {checkingVoteStatus && !isClosed && !voted && (
            <div className="flex items-center justify-center py-6 mb-6">
              <Spinner />
            </div>
          )}

          {/* Voting options */}
          {canVote && poll.pollType === "single" && (
            <div className="space-y-2.5 mb-6">
              {poll.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedOption(i)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    selectedOption === i
                      ? SELECTED_COLORS[i]
                      : `border-outline-variant text-on-surface-variant ${OPTION_COLORS[i]}`
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        selectedOption === i ? "border-current bg-current" : "border-outline"
                      }`}
                    >
                      {selectedOption === i && <div className="w-1.5 h-1.5 rounded-full bg-surface" />}
                    </div>
                    {opt.text}
                  </div>
                </button>
              ))}
            </div>
          )}

          {canVote && poll.pollType === "multi" && (
            <div className="space-y-2.5 mb-6">
              {poll.options.map((opt, i) => {
                const isSelected = selectedOptions.includes(i);
                return (
                  <button
                    key={i}
                    onClick={() => toggleMultiOption(i)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isSelected ? SELECTED_COLORS[i] : `border-outline-variant text-on-surface-variant ${OPTION_COLORS[i]}`
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all ${
                          isSelected ? "border-current bg-current" : "border-outline"
                        }`}
                      >
                        {isSelected && (
                          <span className="material-symbols-outlined text-[12px] text-surface">check</span>
                        )}
                      </div>
                      {opt.text}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {canVote && poll.pollType === "ranked" && (
            <div className="mb-6">
              <p className="text-xs text-on-surface-variant font-mono mb-3">
                Drag to rank from most to least preferred
              </p>
              <RankedChoiceVoter options={poll.options} order={rankedOrder} onChange={setRankedOrder} />
            </div>
          )}

          {canVote && (
            <button
              onClick={handleVote}
              disabled={!canSubmit || voting}
              className="w-full py-3 bg-primary-container text-on-primary-container font-display font-bold rounded-xl transition-all hover:scale-[0.99] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {voting ? "Submitting…" : "Submit Vote"}
            </button>
          )}

          {voted && (
            <div className="px-4 py-3 bg-secondary-container/20 border border-secondary/30 rounded-xl text-sm text-secondary font-medium text-center flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Your vote has been recorded
            </div>
          )}

          {isClosed && !voted && (
            <div className="px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface-variant text-center flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">lock</span>
              This poll is closed
            </div>
          )}

          {error && (
            <div className="mt-3 px-4 py-3 bg-error-container/20 border border-error/30 rounded-xl text-sm text-error">
              {error}
            </div>
          )}
        </div>

        {/* Live results */}
        {(voted || isClosed) && (
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold text-on-surface">
                {poll.pollType === "ranked" ? (isClosed ? "Final Result" : "First-Choice Votes — Live") : "Live Results"}
              </h2>
              <span className="text-xs font-mono text-on-surface-variant">{totalVotes} total</span>
            </div>

            {poll.pollType === "ranked" && isClosed && finalResult ? (
              <IrvRoundsChart result={finalResult} options={poll.options} />
            ) : (
              <>
                <LiveBarChart options={poll.options} counts={counts} />

                <ul className="mt-5 space-y-3">
                  {poll.options.map((opt, i) => {
                    const count = counts.find((c) => c.optionIndex === i)?.count ?? 0;
                    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    return (
                      <li key={i}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-on-surface font-medium">{opt.text}</span>
                          <span className="text-on-surface-variant font-mono text-xs">
                            {count} · {pct}%
                          </span>
                        </div>
                        <div className="h-2 bg-surface-container rounded-full overflow-hidden border border-outline-variant/30">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: seriesColors[i % seriesColors.length] }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        <CommentSection pollId={poll._id} />
      </main>
    </div>
  );
}
