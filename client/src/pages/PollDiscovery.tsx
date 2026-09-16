import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../utils/api";
import Layout from "../components/Layout";
import SkeletonCard from "../components/shared/SkeletonCard";
import EmptyState from "../components/shared/EmptyState";
import ErrorMsg from "../components/shared/ErrorMsg";
import { fadeUp, listItem, staggerContainer } from "../components/motion/variants";
import type { DiscoverResponseDTO, PollDTO } from "../types/api";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const POLL_TYPE_LABEL: Record<PollDTO["pollType"], string> = {
  single: "Single choice",
  multi: "Multi-select",
  ranked: "Ranked choice",
};

export default function PollDiscovery() {
  const [polls, setPolls] = useState<PollDTO[]>([]);
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .get<DiscoverResponseDTO>("/polls/discover", { params: { page, sort, limit: 12 } })
      .then(({ data }) => {
        setPolls(data.polls);
        setTotalPages(data.totalPages);
      })
      .catch(() => setError("Failed to load public polls"))
      .finally(() => setLoading(false));
  }, [page, sort]);

  const changeSort = (next: "recent" | "popular") => {
    setSort(next);
    setPage(1);
  };

  return (
    <Layout>
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6 py-6">
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-3xl text-on-surface">Discover</h1>
            <p className="text-on-surface-variant text-sm mt-1">
              Public polls anyone can vote on
            </p>
          </div>
          <div className="flex gap-1 bg-surface-container rounded-xl p-1 border border-outline-variant self-start">
            {(["recent", "popular"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => changeSort(opt)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wide transition-colors ${focusRing} ${
                  sort === opt ? "text-on-primary-container" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {sort === opt && (
                  <motion.span
                    layoutId="discover-sort-pill"
                    className="absolute inset-0 bg-primary-container rounded-lg"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{opt}</span>
              </button>
            ))}
          </div>
        </motion.div>

        <ErrorMsg message={error} />

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} lines={2} />
            ))}
          </div>
        ) : polls.length === 0 ? (
          <EmptyState
            title="No public polls yet"
            description="When creators list a poll on Discover, it'll show up here."
          />
        ) : (
          <>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {polls.map((poll) => (
                  <motion.div key={poll._id} variants={listItem} layout whileHover={{ y: -3 }}>
                    <Link
                      to={`/poll/${poll._id}`}
                      className={`glass-card rounded-xl p-5 hover:border-outline transition-colors block h-full ${focusRing}`}
                    >
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-secondary-container/20 text-secondary rounded-full border border-secondary/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                          Live
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full border border-outline-variant">
                          {POLL_TYPE_LABEL[poll.pollType]}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-on-surface line-clamp-3">
                        {poll.question}
                      </p>
                      <div className="flex items-center gap-2 mt-3 text-xs font-mono text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]">how_to_vote</span>
                        {poll.totalVotes ?? 0} vote{poll.totalVotes !== 1 ? "s" : ""}
                        <span>·</span>
                        {poll.options.length} options
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {totalPages > 1 && (
              <motion.div variants={fadeUp} className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className={`p-2 text-on-surface-variant hover:text-on-surface disabled:opacity-30 rounded-lg hover:bg-surface-container-high transition-all ${focusRing}`}
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <span className="text-xs font-mono text-on-surface-variant">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className={`p-2 text-on-surface-variant hover:text-on-surface disabled:opacity-30 rounded-lg hover:bg-surface-container-high transition-all ${focusRing}`}
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </Layout>
  );
}
