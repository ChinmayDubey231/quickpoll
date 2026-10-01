import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import api from "../utils/api";
import RollingNumber from "../components/motion/RollingNumber";
import QpToast, { useQpToast } from "../components/QpToast";
import { fadeUp, springy, staggerContainer } from "../components/motion/variants";
import type { DiscoverResponseDTO, PollDTO } from "../types/api";

type Sort = "recent" | "popular";

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 250;
// Vote counts are re-read this often while the tab is visible
const REFRESH_MS = 15_000;
// The server caps a single request at 50 polls
const MAX_LIMIT = 50;

const SORTS: Array<{ key: Sort; label: string }> = [
  { key: "recent", label: "Recent" },
  { key: "popular", label: "Popular" },
];

const POLL_TYPE_LABEL: Record<PollDTO["pollType"], string> = {
  single: "Single choice",
  multi: "Multi-select",
  ranked: "Ranked choice",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-qp-bg";
const easeOut = [0.2, 0.8, 0.2, 1] as const;
const collapse: Transition = { duration: 0.24, ease: easeOut };

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/* ------------------------------- building blocks ------------------------------- */

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function Spinner() {
  return <span aria-hidden="true" className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-current border-r-transparent" />;
}

interface PollRowProps {
  poll: PollDTO;
  rank: number;
  share: number;
  top: boolean;
  delay: number;
}

// The whole row is one link; "Vote" is a visual affordance inside it, not a
// second control. Polls open in a new tab so the list stays where it was.
function PollRow({ poll, rank, share, top, delay }: PollRowProps) {
  const votes = poll.totalVotes ?? 0;

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { ...springy, delay } }}
      // Collapses in place so the rows below slide up rather than jump
      exit={{ opacity: 0, height: 0, transition: collapse }}
      className="-mx-3 overflow-hidden"
    >
      <Link
        to={`/poll/${poll._id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative grid grid-cols-[28px_minmax(0,1fr)] items-start gap-x-3 gap-y-4 rounded-[10px] px-3 py-5 text-qp-ink transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-qp-line hover:bg-qp-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-qp-accent md:flex md:items-center md:gap-6 md:py-6"
      >
        <span className="pt-1 font-brand-mono text-[13px] tabular-nums text-qp-muted md:w-7 md:flex-none md:pt-0">
          {String(rank).padStart(2, "0")}
        </span>

        <div className="flex min-w-0 flex-col gap-2 md:flex-[1_1_320px]">
          <span className="line-clamp-3 text-[17px] font-medium leading-[1.3] tracking-[-0.015em] [text-wrap:pretty] sm:text-[19px]">
            {poll.question}
          </span>
          <span className="flex flex-wrap items-center gap-2 font-brand-mono text-xs text-qp-muted">
            <span className="flex items-center gap-1.5 text-qp-accent-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-qp-pulse" />
              LIVE
            </span>
            <span aria-hidden="true">·</span>
            <span>{POLL_TYPE_LABEL[poll.pollType]}</span>
            <span aria-hidden="true">·</span>
            <span>{poll.options.length} options</span>
          </span>
        </div>

        {/* A second grid row on phones; its children join the flex row from md up */}
        <div className="col-start-2 flex items-center gap-4 md:contents">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-[240px] md:max-w-[200px] md:flex-[1_0_150px]">
            <span className="flex items-baseline gap-1.5 text-[15px]">
              <RollingNumber value={votes} className="font-semibold" />
              <span className="text-sm text-qp-muted">{plural(votes, "vote", "votes")}</span>
            </span>
            <span className="h-[3px] overflow-hidden rounded-sm bg-qp-track">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${share}%` }}
                transition={{ duration: 1, ease: easeOut, delay: delay + 0.2 }}
                className={`block h-full rounded-sm transition-colors duration-500 ${top ? "bg-qp-accent" : "bg-qp-muted"}`}
              />
            </span>
          </div>

          <span className="ml-auto flex h-10 flex-none items-center gap-2 whitespace-nowrap rounded-[10px] border border-qp-fieldline px-4 text-[15px] font-semibold transition-colors group-hover:border-qp-ink">
            Vote
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="transition-transform duration-300 ease-out motion-safe:group-hover:translate-x-0.5"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <span className="sr-only">(opens in a new tab)</span>
          </span>
        </div>
      </Link>
    </motion.li>
  );
}

function ListMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springy}
      className="flex flex-col items-center gap-1.5 px-4 py-14 text-center"
    >
      <span className="text-[17px] font-medium">{title}</span>
      {children}
    </motion.div>
  );
}

function SkeletonRows() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-6 border-b border-qp-line py-6" style={{ opacity: 1 - i * 0.2 }}>
          <span className="h-3 w-6 flex-none animate-pulse rounded bg-qp-track" />
          <span className="flex flex-1 flex-col gap-2.5">
            <span className="h-4 w-3/5 animate-pulse rounded bg-qp-track" />
            <span className="h-3 w-48 animate-pulse rounded bg-qp-track" />
          </span>
          <span className="hidden h-8 w-40 animate-pulse rounded bg-qp-track md:block" />
          <span className="hidden h-10 w-20 animate-pulse rounded-[10px] bg-qp-track sm:block" />
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------- page ----------------------------------- */

export default function PollDiscovery() {
  const { toast, showToast } = useQpToast();

  const [polls, setPolls] = useState<PollDTO[]>([]);
  const [stats, setStats] = useState<DiscoverResponseDTO["stats"] | null>(null);
  const [sort, setSort] = useState<Sort>("recent");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  // A new sort or search is loading while the previous results are still shown
  const [fetching, setFetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retry, setRetry] = useState(0);

  // Bumped for every new sort/search, so late responses for an older one are dropped
  const seq = useRef(0);
  const shownRef = useRef(0);
  shownRef.current = polls.length;

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const id = ++seq.current;
    setFetching(true);
    api
      .get<DiscoverResponseDTO>("/polls/discover", { params: { page: 1, limit: PAGE_SIZE, sort, q: query || undefined } })
      .then(({ data }) => {
        if (id !== seq.current) return;
        setPolls(data.polls);
        setPage(1);
        setTotalCount(data.totalCount);
        setStats(data.stats);
        setStatus("ready");
      })
      .catch(() => {
        if (id === seq.current) setStatus("error");
      })
      .finally(() => {
        if (id === seq.current) setFetching(false);
      });
  }, [sort, query, retry]);

  // Keeps the vote counts (and the header total) current without touching the
  // order or which polls are listed, so nothing jumps while someone is reading
  const refresh = useCallback(() => {
    if (document.hidden) return;
    const id = seq.current;
    const limit = Math.min(MAX_LIMIT, Math.max(PAGE_SIZE, shownRef.current));
    api
      .get<DiscoverResponseDTO>("/polls/discover", { params: { page: 1, limit, sort, q: query || undefined } })
      .then(({ data }) => {
        if (id !== seq.current) return;
        const latest = new Map(data.polls.map((p) => [p._id, p.totalVotes]));
        setPolls((prev) =>
          prev.map((p) => {
            const votes = latest.get(p._id);
            return votes === undefined || votes === p.totalVotes ? p : { ...p, totalVotes: votes };
          }),
        );
        setStats(data.stats);
        setTotalCount(data.totalCount);
      })
      .catch(() => {
        // A missed refresh is harmless; the next one catches up
      });
  }, [sort, query]);

  useEffect(() => {
    if (status !== "ready") return;
    const timer = window.setInterval(refresh, REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, refresh]);

  const loadMore = () => {
    const id = seq.current;
    const next = page + 1;
    setLoadingMore(true);
    api
      .get<DiscoverResponseDTO>("/polls/discover", { params: { page: next, limit: PAGE_SIZE, sort, q: query || undefined } })
      .then(({ data }) => {
        if (id !== seq.current) return;
        setPolls((prev) => {
          const seen = new Set(prev.map((p) => p._id));
          return [...prev, ...data.polls.filter((p) => !seen.has(p._id))];
        });
        setPage(next);
        setTotalCount(data.totalCount);
        setStats(data.stats);
      })
      .catch(() => {
        if (id === seq.current) showToast("Couldn't load more polls.");
      })
      .finally(() => setLoadingMore(false));
  };

  const maxVotes = polls.reduce((max, p) => Math.max(max, p.totalVotes ?? 0), 0);
  const topId = maxVotes > 0 ? polls.find((p) => (p.totalVotes ?? 0) === maxVotes)?._id : undefined;

  let list: ReactNode;
  if (status === "loading") {
    list = <SkeletonRows />;
  } else if (status === "error") {
    list = (
      <ListMessage title="Couldn't load public polls">
        <span className="text-[15px] text-qp-muted">The server may be waking up.</span>
        <button
          type="button"
          onClick={() => {
            setStatus("loading");
            setRetry((n) => n + 1);
          }}
          className={`mt-3 h-10 rounded-[10px] border border-qp-fieldline px-4 text-[15px] font-semibold transition-colors hover:border-qp-ink hover:bg-qp-track ${focusRing}`}
        >
          Try again
        </button>
      </ListMessage>
    );
  } else if (polls.length === 0) {
    list = query ? (
      <ListMessage title={`No polls match “${query}”`}>
        <span className="text-[15px] text-qp-muted">
          Try a different search, or{" "}
          <Link to="/create" className={`rounded font-medium text-qp-accent-ink underline-offset-2 hover:underline ${focusRing}`}>
            create your own poll
          </Link>
          .
        </span>
      </ListMessage>
    ) : (
      <ListMessage title="No public polls yet">
        <span className="text-[15px] text-qp-muted">When creators list a poll on Discover, it'll show up here.</span>
        <Link
          to="/create"
          className={`mt-3 flex h-10 items-center rounded-[10px] bg-qp-accent px-4 text-[15px] font-semibold text-qp-accent-fg [transition:filter_.2s] hover:brightness-110 ${focusRing}`}
        >
          Create a poll
        </Link>
      </ListMessage>
    );
  } else {
    list = (
      <ul>
        <AnimatePresence initial={true}>
          {polls.map((poll, i) => (
            <PollRow
              key={poll._id}
              poll={poll}
              rank={i + 1}
              share={maxVotes ? Math.round(((poll.totalVotes ?? 0) / maxVotes) * 100) : 0}
              top={poll._id === topId}
              // Each batch of rows staggers in, including ones added by "Show more"
              delay={Math.min(i % PAGE_SIZE, 8) * 0.04}
            />
          ))}
        </AnimatePresence>
      </ul>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="pt-3 font-brand text-qp-ink md:pt-6 lg:pt-8">
      <motion.div variants={fadeUp} className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-[36px] font-medium leading-none tracking-[-0.035em] sm:text-[44px]">Discover</h1>
          <p className="text-base text-qp-muted">Public polls anyone can vote on</p>
        </div>
        {stats ? (
          <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <RollingNumber value={stats.votes} className="text-[36px] font-medium leading-none tracking-[-0.035em] sm:text-[44px]" />
            <span className="flex items-center gap-2 text-[15px] text-qp-muted">
              <span className="h-[7px] w-[7px] rounded-full bg-qp-accent motion-safe:animate-qp-pulse" />
              {plural(stats.votes, "vote", "votes")} across {stats.polls} live {plural(stats.polls, "poll", "polls")}
            </span>
          </p>
        ) : (
          <span aria-hidden="true" className="h-9 w-56 animate-pulse rounded-md bg-qp-track sm:h-11" />
        )}
      </motion.div>

      <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center justify-between gap-3 sm:mt-10">
        <label className="relative block min-w-0 flex-[1_1_280px] sm:max-w-[420px]">
          <span className="sr-only">Search polls</span>
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-qp-muted">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search polls"
            maxLength={100}
            enterKeyHint="search"
            className="h-12 w-full rounded-[10px] border border-qp-fieldline bg-qp-field pl-[42px] pr-10 text-base text-qp-ink outline-none [transition:border-color_.2s,box-shadow_.2s] placeholder:text-qp-muted placeholder:opacity-70 focus:border-qp-accent focus:shadow-[0_0_0_3px_var(--qp-ring)]"
          />
          {/* Shows while a search is on its way */}
          <AnimatePresence>
            {fetching && status === "ready" && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute right-3.5 top-1/2 flex -translate-y-1/2 text-qp-muted"
              >
                <Spinner />
              </motion.span>
            )}
          </AnimatePresence>
        </label>

        <div role="group" aria-label="Sort polls" className="flex w-full gap-1 rounded-[10px] bg-qp-panel p-1 sm:w-auto">
          {SORTS.map((s) => {
            const selected = sort === s.key;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setSort(s.key)}
                className={`relative h-9 flex-1 rounded-[7px] px-4 text-sm font-medium transition-colors sm:flex-none ${
                  selected ? "text-qp-ink" : "text-qp-muted hover:text-qp-ink"
                } ${focusRing}`}
              >
                {selected && (
                  <motion.span
                    layoutId="discover-sort"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-[7px] bg-qp-bg shadow-[0_1px_2px_rgba(0,0,0,.12)]"
                  />
                )}
                <span className="relative">{s.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        variants={fadeUp}
        aria-busy={fetching}
        className={`mt-6 border-t border-qp-line transition-opacity duration-200 ${fetching && status === "ready" ? "opacity-50" : ""}`}
      >
        {list}
      </motion.div>

      <AnimatePresence initial={false}>
        {status === "ready" && polls.length < totalCount && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 flex flex-col items-center gap-3"
          >
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className={`flex h-11 min-w-[148px] items-center justify-center gap-2 rounded-[10px] border border-qp-fieldline px-[18px] text-[15px] font-semibold [transition:background-color_.2s,border-color_.2s,transform_.12s] enabled:hover:border-qp-ink enabled:hover:bg-qp-track enabled:active:scale-[.985] disabled:cursor-default ${focusRing}`}
            >
              {loadingMore && <Spinner />}
              {loadingMore ? "Loading" : "Show more"}
            </button>
            <span className="font-brand-mono text-xs text-qp-muted">
              Showing {polls.length} of {totalCount}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <span className="sr-only" role="status">
        {status === "ready" && query ? `${totalCount} ${plural(totalCount, "poll matches", "polls match")} “${query}”` : ""}
      </span>
      <QpToast toast={toast} />
    </motion.div>
  );
}
