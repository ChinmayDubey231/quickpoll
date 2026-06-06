import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import confetti from "canvas-confetti";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import api from "../utils/api.js";
import socket from "../utils/socket.js";
import LiveBarChart from "../components/LiveBarChart.jsx";
import CountdownTimer from "../components/CountdownTimer.jsx";
import Spinner from "../components/shared/Spinner.jsx";
import Logo from "../components/Logo.jsx";

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
  const { id: pollId } = useParams();
  const [poll, setPoll] = useState(null);
  const [counts, setCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [voted, setVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [voting, setVoting] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const fingerprintRef = useRef(null);

  useEffect(() => {
    fpPromise
      .then((fp) => fp.get())
      .then((r) => {
        fingerprintRef.current = r.visitorId;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [pollRes, countRes] = await Promise.all([
          api.get(`/polls/${pollId}`),
          api.get(`/votes/${pollId}`),
        ]);
        setPoll(pollRes.data);
        setCounts(countRes.data.counts);
        setIsClosed(!pollRes.data.isOpen);
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
    const onVoteUpdate = ({ counts: c }) => setCounts(c);
    const onPollClosed = () => setIsClosed(true);
    socket.on("vote-update", onVoteUpdate);
    socket.on("poll-closed", onPollClosed);
    return () => {
      socket.off("vote-update", onVoteUpdate);
      socket.off("poll-closed", onPollClosed);
      socket.disconnect();
    };
  }, [pollId]);

  const handleVote = async () => {
    if (selectedOption === null || voting || voted) return;
    setVoting(true);
    try {
      const { data } = await api.post(`/votes/${pollId}`, {
        optionIndex: selectedOption,
        fingerprint: fingerprintRef.current,
      });
      setCounts(data.counts);
      setVoted(true);
      fireConfetti();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cast vote");
    } finally {
      setVoting(false);
    }
  };

  const handleExpired = useCallback(() => setIsClosed(true), []);
  const totalVotes = counts.reduce((s, c) => s + c.count, 0);

  if (loading)
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <Spinner />
      </div>
    );

  if (error && !poll)
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center px-4">
        <div className="text-center glass-card rounded-2xl p-10">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">
            link_off
          </span>
          <p className="text-on-surface font-display font-bold text-lg mb-1">
            Poll not found
          </p>
          <p className="text-on-surface-variant text-sm">{error}</p>
        </div>
      </div>
    );

  const canVote = !voted && !isClosed;

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
            {poll?.question}
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
          {poll?.expiresAt && !isClosed && (
            <CountdownTimer
              expiresAt={poll.expiresAt}
              onExpired={handleExpired}
            />
          )}
        </div>
      </header>

      <main className="pt-24 pb-12 px-4 max-w-2xl mx-auto relative">
        {/* Poll card */}
        <div className="glass-card rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-mono text-on-surface-variant">
              {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
            </span>
          </div>

          <h1 className="font-display font-bold text-xl text-on-surface mb-6 leading-snug">
            {poll?.question}
          </h1>

          {/* Voting options */}
          {canVote && (
            <div className="space-y-2.5 mb-6">
              {poll.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedOption(i)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all ${
                    selectedOption === i
                      ? SELECTED_COLORS[i]
                      : `border-outline-variant text-on-surface-variant ${OPTION_COLORS[i]}`
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        selectedOption === i
                          ? "border-current bg-current"
                          : "border-outline"
                      }`}
                    >
                      {selectedOption === i && (
                        <div className="w-1.5 h-1.5 rounded-full bg-surface" />
                      )}
                    </div>
                    {opt.text}
                  </div>
                </button>
              ))}
            </div>
          )}

          {canVote && (
            <button
              onClick={handleVote}
              disabled={selectedOption === null || voting}
              className="w-full py-3 bg-primary-container text-on-primary-container font-display font-bold rounded-xl transition-all hover:scale-[0.99] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {voting ? "Submitting…" : "Submit Vote"}
            </button>
          )}

          {voted && (
            <div className="px-4 py-3 bg-secondary-container/20 border border-secondary/30 rounded-xl text-sm text-secondary font-medium text-center flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                check_circle
              </span>
              Your vote has been recorded
            </div>
          )}

          {isClosed && !voted && (
            <div className="px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface-variant text-center flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                lock
              </span>
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
        {(voted || isClosed) && poll && (
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold text-on-surface">
                Live Results
              </h2>
              <span className="text-xs font-mono text-on-surface-variant">
                {totalVotes} total
              </span>
            </div>

            <LiveBarChart options={poll.options} counts={counts} />

            <ul className="mt-5 space-y-3">
              {poll.options.map((opt, i) => {
                const count =
                  counts.find((c) => c.optionIndex === i)?.count ?? 0;
                const pct =
                  totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                return (
                  <li key={i}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-on-surface font-medium">
                        {opt.text}
                      </span>
                      <span className="text-on-surface-variant font-mono text-xs">
                        {count} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-surface-container rounded-full overflow-hidden border border-outline-variant/30">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: [
                            "#cdbdff",
                            "#44ddc1",
                            "#bdc2ff",
                            "#ffb4ab",
                            "#cdbdff",
                            "#44ddc1",
                          ][i % 6],
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
