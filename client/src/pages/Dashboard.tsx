import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import api from "../utils/api";
import Layout from "../components/Layout";
import ConfirmModal from "../components/ConfirmModal";
import EmptyState from "../components/shared/EmptyState";
import SkeletonCard from "../components/shared/SkeletonCard";
import ErrorMsg from "../components/shared/ErrorMsg";
import { useToast } from "../context/ToastContext";
import type { PollDTO } from "../types/api";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const StatusBadge = ({ poll }: { poll: PollDTO }) => {
  if (!poll.isOpen)
    return (
      <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-surface-container text-on-surface-variant rounded-full border border-outline-variant">
        Closed
      </span>
    );
  if (poll.expiresAt && new Date(poll.expiresAt) < new Date())
    return (
      <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-error-container/20 text-error rounded-full border border-error/30">
        Expired
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-secondary-container/20 text-secondary rounded-full border border-secondary/30">
      <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
      Live
    </span>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [polls, setPolls] = useState<PollDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PollDTO[]>("/polls")
      .then((r) => setPolls(r.data))
      .catch(() => setError("Failed to load polls"))
      .finally(() => setLoading(false));
  }, []);

  const handleClose = async (pollId: string) => {
    setClosing(pollId);
    try {
      await api.patch(`/polls/${pollId}/close`);
      setPolls((prev) =>
        prev.map((p) => (p._id === pollId ? { ...p, isOpen: false } : p)),
      );
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message || "Failed to close poll");
    } finally {
      setClosing(null);
    }
  };

  const handleDelete = async (pollId: string) => {
    setConfirmId(null);
    setDeleting(pollId);
    try {
      await api.delete(`/polls/${pollId}`);
      setPolls((prev) => prev.filter((p) => p._id !== pollId));
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message || "Failed to delete poll");
    } finally {
      setDeleting(null);
    }
  };

  const copyLink = (pollId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/poll/${pollId}`);
    showToast("Link copied to clipboard", "success");
  };

  const totalVotes = loading
    ? null
    : polls.reduce((s, p) => s + (p.totalVotes || 0), 0);
  const livePolls = loading ? null : polls.filter((p) => p.isOpen).length;

  return (
    <Layout>
      <div className="space-y-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-3xl text-on-surface">
              Dashboard
            </h1>
            <p className="text-on-surface-variant text-sm mt-1">
              Manage and monitor your polls
            </p>
          </div>
          <Link
            to="/create"
            className={`inline-flex items-center gap-2 px-5 py-2.5 bg-primary-container text-on-primary-container font-display font-bold rounded-xl hover:scale-[0.98] transition-transform text-sm ${focusRing}`}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Poll
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Total Polls",
              value: loading ? null : polls.length,
              icon: "ballot",
              color: "text-primary",
              span: "",
            },
            {
              label: "Live Now",
              value: livePolls,
              icon: "sensors",
              color: "text-secondary",
              span: "",
            },
            {
              label: "Total Votes",
              value: totalVotes,
              icon: "how_to_vote",
              color: "text-tertiary",
              span: "sm:col-span-1 col-span-2",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`glass-card accent-glow rounded-xl p-5 ${s.span}`}
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-mono tracking-widest text-on-surface-variant uppercase">
                  {s.label}
                </span>
                <span className={`material-symbols-outlined text-[20px] ${s.color}`}>
                  {s.icon}
                </span>
              </div>
              <span className="font-display font-bold text-4xl text-on-surface">
                {s.value === null ? (
                  <span className="inline-block w-12 h-8 bg-surface-container-high rounded animate-pulse" />
                ) : (
                  s.value
                )}
              </span>
            </div>
          ))}
        </div>

        <ErrorMsg message={error} />

        {/* Polls list */}
        <div>
          <h2 className="font-display font-semibold text-lg text-on-surface mb-4">
            My Polls
          </h2>
          {loading ? (
            <div className="space-y-3">
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
            </div>
          ) : polls.length === 0 ? (
            <EmptyState
              title="No polls yet"
              description="Create your first poll and share it with anyone."
              action={
                <Link
                  to="/create"
                  className={`px-5 py-2.5 bg-primary-container text-on-primary-container font-display font-bold rounded-xl hover:scale-[0.98] transition-transform text-sm inline-block mt-2 ${focusRing}`}
                >
                  Create a poll
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {polls.map((poll) => (
                <div
                  key={poll._id}
                  className="glass-card rounded-xl p-5 hover:border-outline transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <StatusBadge poll={poll} />
                        <span className="text-[10px] font-mono text-on-surface-variant">
                          {poll.totalVotes || 0} vote
                          {poll.totalVotes !== 1 ? "s" : ""}
                        </span>
                        <span className="text-[10px] font-mono text-on-surface-variant">
                          ·
                        </span>
                        <span className="text-[10px] font-mono text-on-surface-variant">
                          {poll.options.length} options
                        </span>
                        {poll.isPublic && (
                          <span className="text-[10px] font-mono text-on-surface-variant flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[12px]">public</span>
                            Public
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-on-surface truncate">
                        {poll.question}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1 font-mono">
                        {new Date(poll.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => copyLink(poll._id)}
                        title="Copy share link"
                        className={`p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-lg transition-all ${focusRing}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          content_copy
                        </span>
                      </button>
                      <button
                        onClick={() => navigate(`/polls/${poll._id}/analytics`)}
                        title="Analytics"
                        className={`p-2 text-on-surface-variant hover:text-secondary hover:bg-surface-container-high rounded-lg transition-all ${focusRing}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          leaderboard
                        </span>
                      </button>
                      {poll.isOpen &&
                        (!poll.expiresAt ||
                          new Date(poll.expiresAt) > new Date()) && (
                          <button
                            onClick={() => handleClose(poll._id)}
                            disabled={closing === poll._id}
                            title="Close poll"
                            className={`p-2 text-on-surface-variant hover:text-error hover:bg-surface-container-high rounded-lg transition-all disabled:opacity-40 ${focusRing}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              block
                            </span>
                          </button>
                        )}
                      <button
                        onClick={() => setConfirmId(poll._id)}
                        disabled={deleting === poll._id}
                        title="Delete"
                        className={`p-2 text-on-surface-variant hover:text-error hover:bg-surface-container-high rounded-lg transition-all disabled:opacity-40 ${focusRing}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          delete
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {confirmId && (
        <ConfirmModal
          title="Delete Poll"
          message="This will permanently delete the poll and all its votes. This cannot be undone."
          onConfirm={() => handleDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </Layout>
  );
}
