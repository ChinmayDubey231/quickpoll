import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { motion } from "framer-motion";
import api from "../utils/api";
import VoteTimelineChart from "../components/VoteTimelineChart";
import LiveBarChart from "../components/LiveBarChart";
import IrvRoundsChart from "../components/IrvRoundsChart";
import QRCode from "../components/QRCode";
import SkeletonCard from "../components/shared/SkeletonCard";
import ErrorState from "../components/shared/ErrorState";
import AnimatedNumber from "../components/motion/AnimatedNumber";
import { fadeUp, staggerContainer } from "../components/motion/variants";
import { getSeriesColors } from "../utils/chartTheme";
import { useTheme } from "../context/ThemeContext";
import type { PollDTO, AnalyticsDTO, OptionCountDTO } from "../types/api";

export default function PollAnalytics() {
  const { theme } = useTheme();
  const seriesColors = getSeriesColors(theme);
  const { id: pollId } = useParams<{ id: string }>();
  const [poll, setPoll] = useState<PollDTO | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsDTO | null>(null);
  const [counts, setCounts] = useState<OptionCountDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!pollId) return;
    const load = async () => {
      try {
        const [pollRes, analyticsRes, countsRes] = await Promise.all([
          api.get<PollDTO>(`/polls/${pollId}`),
          api.get<AnalyticsDTO>(`/polls/${pollId}/analytics`),
          api.get(`/votes/${pollId}`),
        ]);
        setPoll(pollRes.data);
        setAnalytics(analyticsRes.data);
        setCounts(countsRes.data.counts);
      } catch (err) {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        if (status === 403) setError("You don't have access to this poll's analytics.");
        else if (status === 404) setError("Poll not found.");
        else setError("Failed to load analytics.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pollId]);

  const handleClose = async () => {
    setClosing(true);
    try {
      await api.patch(`/polls/${pollId}/close`);
      setPoll((p) => (p ? { ...p, isOpen: false } : p));
    } finally {
      setClosing(false);
    }
  };

  const shareUrl = `${window.location.origin}/poll/${pollId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading)
    return (
      <div className="space-y-6 py-6">
        <SkeletonCard lines={1} className="h-16" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonCard lines={4} className="h-52" />
          <SkeletonCard lines={4} className="h-52" />
        </div>
      </div>
    );

  if (error)
    return (
      <ErrorState icon="error" title="Couldn't load analytics" description={error} backTo="/dashboard" backLabel="Back to dashboard" />
    );

  if (!poll || !analytics) return null;

  const isOpen = poll.isOpen && (!poll.expiresAt || new Date(poll.expiresAt) > new Date());

  return (
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6 py-6">
        {/* Header */}
        <motion.section variants={fadeUp} className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Link
                to="/dashboard"
                className="p-1 text-on-surface-variant hover:text-on-surface transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </Link>
              {isOpen ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-secondary-container/20 text-secondary rounded-full border border-secondary/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                  Live
                </span>
              ) : (
                <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-surface-container text-on-surface-variant rounded-full border border-outline-variant">
                  Closed
                </span>
              )}
              {poll.pollType !== "single" && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full border border-outline-variant">
                  {poll.pollType === "multi" ? "Multi-select" : "Ranked choice"}
                </span>
              )}
            </div>
            <h1 className="font-display font-bold text-2xl md:text-3xl text-on-surface leading-snug">
              {poll.question}
            </h1>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={copyLink}
              className="flex items-center gap-2 px-4 py-2 border border-outline text-on-surface rounded-xl hover:bg-surface-container-high transition-colors text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-[18px]">share</span>
              Share
            </motion.button>
            {isOpen && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleClose}
                disabled={closing}
                className="flex items-center gap-2 px-5 py-2 bg-error-container/20 text-error border border-error/30 rounded-xl hover:bg-error-container/40 transition-colors text-sm font-medium disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
              >
                <span className="material-symbols-outlined text-[18px]">block</span>
                Close Poll
              </motion.button>
            )}
          </div>
        </motion.section>

        {/* QR + Share */}
        <motion.section variants={fadeUp} className="glass-card rounded-xl p-5 flex flex-col md:flex-row items-center gap-6">
          <div className="bg-white p-3 rounded-xl flex-shrink-0">
            <QRCode url={shareUrl} size={120} />
          </div>
          <div className="flex-1 min-w-0 space-y-3 w-full">
            <div>
              <label className="text-[10px] font-mono tracking-widest text-on-surface-variant uppercase mb-2 block">
                Share Link
              </label>
              <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant p-1 rounded-xl">
                <span className="text-sm text-on-surface-variant px-3 py-1.5 font-mono truncate flex-1">
                  {shareUrl}
                </span>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={copyLink}
                  className="bg-primary-container text-on-primary-container px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {copied ? "check" : "content_copy"}
                  </span>
                  {copied ? "Copied!" : "Copy"}
                </motion.button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:flex items-center gap-1 px-3 py-2 text-on-surface-variant hover:text-on-surface transition-colors text-xs font-mono rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Open <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                </a>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Stat cards */}
        <motion.section variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Total Votes",
              value: analytics.totalVotes,
              icon: "poll",
              color: "text-primary",
              sub: "Updates in real-time",
            },
            {
              label: "Unique Voters",
              value: analytics.uniqueVoters,
              icon: "group",
              color: "text-secondary",
              sub: "Tracked via fingerprinting",
            },
            {
              label: "Peak Activity",
              value: analytics.peakMinute,
              icon: "bolt",
              color: "text-tertiary",
              sub: "Busiest 15-min window",
            },
          ].map((s) => (
            <div key={s.label} className="glass-card accent-glow rounded-xl p-6 group">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-mono tracking-widest text-on-surface-variant uppercase">
                  {s.label}
                </span>
                <span className={`material-symbols-outlined text-[22px] ${s.color} group-hover:scale-110 transition-transform`}>
                  {s.icon}
                </span>
              </div>
              <div className="font-display font-bold text-4xl text-on-surface mb-1">
                {typeof s.value === "number" ? <AnimatedNumber value={s.value} /> : s.value ?? "—"}
              </div>
              <p className="text-xs text-on-surface-variant">{s.sub}</p>
            </div>
          ))}
        </motion.section>

        {/* Charts row */}
        <motion.section variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Vote distribution */}
          <div className="glass-card rounded-xl p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-lg text-on-surface">
                Vote Distribution
              </h3>
              <div className="flex gap-1">
                {seriesColors.slice(0, 3).map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm" style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {poll.options.map((opt, i) => {
                const count = counts.find((c) => c.optionIndex === i)?.count ?? 0;
                const pct = analytics.totalVotes > 0 ? Math.round((count / analytics.totalVotes) * 100) : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-on-surface">{opt.text}</span>
                      <span className="text-on-surface-variant font-mono text-xs">
                        {count} votes · {pct}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-surface-container rounded-full overflow-hidden border border-outline-variant/30">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: seriesColors[i % seriesColors.length] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ type: "spring", stiffness: 100, damping: 20, delay: i * 0.05 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline */}
          <div className="glass-card rounded-xl p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-lg text-on-surface">
                Vote Timeline
              </h3>
              <span className="text-xs font-mono text-on-surface-variant">15-min buckets</span>
            </div>
            <VoteTimelineChart timeline={analytics.timeline} />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary-container" />
              <span className="text-xs text-on-surface-variant font-mono">New Votes</span>
            </div>
          </div>
        </motion.section>

        {/* Ranked-choice round breakdown */}
        {poll.pollType === "ranked" && analytics.irv && (
          <motion.div variants={fadeUp} className="glass-card rounded-xl p-6">
            <h3 className="font-display font-semibold text-lg text-on-surface mb-5">
              Instant-Runoff Rounds
            </h3>
            <IrvRoundsChart result={analytics.irv} options={poll.options} />
          </motion.div>
        )}

        {/* Bar chart */}
        <motion.div variants={fadeUp} className="glass-card rounded-xl p-6">
          <h3 className="font-display font-semibold text-lg text-on-surface mb-5">
            Results Chart
          </h3>
          <LiveBarChart options={poll.options} counts={counts} />
        </motion.div>

        {/* Footer CTA */}
        {isOpen && (
          <motion.footer
            variants={fadeUp}
            className="bg-primary/5 border border-primary/20 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4 text-center md:text-left">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary">campaign</span>
              </div>
              <div>
                <h4 className="font-display font-bold text-on-surface">Poll is still live</h4>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  Close it manually when you're done collecting responses.
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleClose}
              disabled={closing}
              className="bg-primary-container text-on-primary-container font-display font-bold px-8 py-3 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Close poll
            </motion.button>
          </motion.footer>
        )}
      </motion.div>
  );
}
