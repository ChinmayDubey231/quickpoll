import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import api from "../utils/api";
import RollingNumber from "../components/motion/RollingNumber";
import QpToast, { useQpToast } from "../components/QpToast";
import { fadeUp, springy, staggerContainer } from "../components/motion/variants";
import type { PollDTO } from "../types/api";

type PollStatus = "live" | "expired" | "closed";
type FilterKey = "all" | "live" | "ended";

// Deleting removes the row at once; the request is held back this long so Undo can cancel it
const UNDO_MS = 5000;
const COPIED_MS = 1600;

const easeOut = [0.2, 0.8, 0.2, 1] as const;
const rowExit: Transition = { duration: 0.28, ease: easeOut };

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-qp-bg";

const FILTERS: Array<{ key: FilterKey; label: string; match: (s: PollStatus) => boolean }> = [
  { key: "all", label: "All", match: () => true },
  { key: "live", label: "Live", match: (s) => s === "live" },
  { key: "ended", label: "Ended", match: (s) => s !== "live" },
];

const statusOf = (poll: PollDTO): PollStatus => {
  if (!poll.isOpen) return "closed";
  if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) return "expired";
  return "live";
};

const errorMessage = (err: unknown, fallback: string): string =>
  (isAxiosError(err) && err.response?.data?.message) || fallback;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/* ---------------------------------- icons ---------------------------------- */

// Hover flourishes are keyed to the nearest named group — `group/icon` on the row
// actions, `group/btn` on the header buttons — so they play from the whole button.

const svgProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const iconMotion = "transition-transform duration-300 ease-out";
// SVG children rotate/scale around their own box rather than the viewBox origin
const ownBox = "[transform-box:fill-box]";

function LinkIcon() {
  return (
    <svg {...svgProps} className={`${iconMotion} motion-safe:group-hover/icon:-rotate-12`}>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...svgProps} strokeWidth={2.2}>
      <motion.path
        d="M20 6 9 17l-5-5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </svg>
  );
}

function ResultsIcon() {
  const bar = `origin-bottom ${ownBox} ${iconMotion}`;
  return (
    <svg {...svgProps}>
      <path d="M5 20V10" className={`${bar} motion-safe:group-hover/icon:scale-y-[1.3]`} />
      <path d="M12 20V4" className={`${bar} delay-75 motion-safe:group-hover/icon:scale-y-[.7]`} />
      <path d="M19 20v-7" className={`${bar} delay-150 motion-safe:group-hover/icon:scale-y-[1.5]`} />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...svgProps} className="transition-transform duration-500 ease-out motion-safe:group-hover/icon:rotate-90">
      <circle cx="12" cy="12" r="9" />
      <path d="m5.7 5.7 12.6 12.6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...svgProps}>
      {/* The lid tips open on hover */}
      <g
        className={`origin-bottom-left ${ownBox} ${iconMotion} motion-safe:group-hover/icon:-translate-y-px motion-safe:group-hover/icon:-rotate-[8deg]`}
      >
        <path d="M4 7h16" />
        <path d="M9 7V4h6v3" />
      </g>
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg {...svgProps} width={17} height={17}>
      <path d="M12 3v12m0 0-4-4m4 4 4-4" className={`${iconMotion} motion-safe:group-hover/btn:translate-y-[2px]`} />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg {...svgProps} width={17} height={17} strokeWidth={2} className={`${iconMotion} motion-safe:group-hover/btn:rotate-90`}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/* ------------------------------- building blocks ------------------------------- */

const actionClass = (danger = false) =>
  `group/icon grid h-9 w-9 place-items-center rounded-[9px] text-qp-muted transition-colors disabled:pointer-events-none disabled:opacity-40 sm:h-10 sm:w-10 ${
    danger ? "hover:bg-qp-errbg hover:text-qp-error" : "hover:bg-qp-track hover:text-qp-ink"
  } ${focusRing}`;

function Stat({ label, value, live = false, className }: { label: string; value: number | null; live?: boolean; className: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-3.5 pb-7 pt-6 ${className}`}>
      <dt className="flex items-center gap-2 truncate font-brand-mono text-[11px] uppercase tracking-[.06em] text-qp-muted sm:text-xs">
        {live && <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-qp-accent motion-safe:animate-qp-pulse" />}
        {label}
      </dt>
      <dd className="text-[clamp(32px,4.5vw,56px)] font-medium leading-none tracking-[-0.04em]">
        {value === null ? (
          <span className="block h-[1em] w-16 animate-pulse rounded-md bg-qp-track" />
        ) : (
          <RollingNumber value={value} />
        )}
      </dd>
    </div>
  );
}

const BADGE_STYLES: Record<PollStatus, string> = {
  live: "border-[color:color-mix(in_srgb,var(--qp-accent)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--qp-accent)_12%,transparent)] text-qp-accent-ink",
  expired: "border-[color:color-mix(in_srgb,var(--qp-error)_40%,transparent)] text-qp-error",
  closed: "border-qp-fieldline text-qp-muted",
};

function StatusBadge({ status }: { status: PollStatus }) {
  return (
    <span className="flex h-[26px] w-24 flex-none">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.18 }}
          className={`flex h-full w-full items-center justify-center gap-[7px] rounded-full border font-brand-mono text-[11px] font-bold uppercase tracking-[.06em] ${BADGE_STYLES[status]}`}
        >
          {status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-qp-pulse" />}
          {status}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

interface PollRowProps {
  poll: PollDTO;
  status: PollStatus;
  share: number;
  index: number;
  copied: boolean;
  closing: boolean;
  onCopy: () => void;
  onClose: () => void;
  onDelete: () => void;
}

function PollRow({ poll, status, share, index, copied, closing, onCopy, onClose, onDelete }: PollRowProps) {
  const votes = poll.totalVotes ?? 0;
  const live = status === "live";

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { ...springy, delay: Math.min(index, 6) * 0.05 } }}
      // Collapses in place so the rows below slide up rather than jump
      exit={{ opacity: 0, x: -16, height: 0, paddingTop: 0, paddingBottom: 0, transition: rowExit }}
      // The hover fill bleeds 12px past the list; the divider (::after) stays flush with it
      className="relative -mx-3 flex flex-wrap items-center gap-x-4 gap-y-3.5 overflow-hidden rounded-[10px] px-3 py-[22px] transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-qp-line hover:bg-qp-panel sm:gap-x-6"
    >
      <StatusBadge status={status} />

      <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5 sm:flex-[1_1_280px]">
        <Link
          to={`/poll/${poll._id}`}
          className={`rounded text-[17px] font-medium sm:truncate tracking-[-0.01em] text-qp-ink hover:underline ${focusRing}`}
        >
          {poll.question}
        </Link>
        <span className="flex flex-wrap items-center gap-2 font-brand-mono text-xs text-qp-muted">
          <span>{formatDate(poll.createdAt)}</span>
          <span aria-hidden="true">·</span>
          <span>{poll.options.length} options</span>
          {poll.isPublic && (
            <>
              <span aria-hidden="true">·</span>
              <span>Public</span>
            </>
          )}
        </span>
      </div>

      <div className="flex max-w-[220px] flex-[1_0_140px] flex-col gap-2 sm:flex-[1_0_160px]">
        <span className="flex items-baseline justify-between text-[15px] tabular-nums">
          <span className="flex items-baseline gap-1.5">
            <RollingNumber value={votes} className="font-semibold" />
            <span className="text-sm text-qp-muted">{votes === 1 ? "vote" : "votes"}</span>
          </span>
          <span className="font-brand-mono text-xs text-qp-muted" title="Share of all your votes">
            {share}%
          </span>
        </span>
        <span className="h-[3px] overflow-hidden rounded-sm bg-qp-track">
          <motion.span
            initial={{ width: 0 }}
            animate={{ width: `${share}%` }}
            transition={{ duration: 1, ease: easeOut, delay: 0.2 + Math.min(index, 6) * 0.05 }}
            className={`block h-full rounded-sm ${live ? "bg-qp-accent" : "bg-qp-muted"}`}
          />
        </span>
      </div>

      {/* Sized for four buttons so the columns line up whether or not "Close poll" is shown */}
      <div className="ml-auto flex w-[156px] flex-none justify-end gap-1 sm:w-[172px]">
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? "Link copied" : "Copy share link"}
          title={copied ? "Copied" : "Copy share link"}
          className={`${actionClass()} ${copied ? "text-qp-accent-ink" : ""}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? "copied" : "copy"}
              initial={{ opacity: 0, scale: 0.5, rotate: -30 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5, rotate: 30 }}
              transition={{ duration: 0.16 }}
              className="grid place-items-center"
            >
              {copied ? <CheckIcon /> : <LinkIcon />}
            </motion.span>
          </AnimatePresence>
        </button>
        <Link to={`/polls/${poll._id}/analytics`} aria-label="View results" title="View results" className={actionClass()}>
          <ResultsIcon />
        </Link>
        {live && (
          <button
            type="button"
            onClick={onClose}
            disabled={closing}
            aria-label="Close poll"
            title="Close poll"
            className={actionClass()}
          >
            <CloseIcon />
          </button>
        )}
        <button type="button" onClick={onDelete} aria-label="Delete poll" title="Delete poll" className={actionClass(true)}>
          <TrashIcon />
        </button>
      </div>
    </motion.div>
  );
}

function ListMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={springy}
      className="flex flex-col items-center gap-1.5 py-14 text-center"
    >
      <span className="text-[17px] font-medium">{title}</span>
      {children}
    </motion.div>
  );
}

function SkeletonRows() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-6 border-b border-qp-line py-[22px]" style={{ opacity: 1 - i * 0.25 }}>
          <span className="h-[26px] w-24 flex-none animate-pulse rounded-full bg-qp-track" />
          <span className="flex flex-1 flex-col gap-2.5">
            <span className="h-4 w-3/5 animate-pulse rounded bg-qp-track" />
            <span className="h-3 w-40 animate-pulse rounded bg-qp-track" />
          </span>
          <span className="hidden h-8 w-40 animate-pulse rounded bg-qp-track sm:block" />
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------- page ----------------------------------- */

interface PendingDelete {
  poll: PollDTO;
  index: number;
  timer: number;
}

export default function Dashboard() {
  const [polls, setPolls] = useState<PollDTO[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { toast, showToast, hideToast } = useQpToast();
  const pendingDelete = useRef<PendingDelete | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  const loadPolls = useCallback(() => {
    setLoadState("loading");
    api
      .get<PollDTO[]>("/polls")
      .then((r) => {
        setPolls(r.data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, []);

  useEffect(loadPolls, [loadPolls]);

  // Leaving the page inside the undo window still goes through with the delete
  useEffect(
    () => () => {
      window.clearTimeout(copyTimer.current);
      const pending = pendingDelete.current;
      if (pending) {
        window.clearTimeout(pending.timer);
        api.delete(`/polls/${pending.poll._id}`).catch(() => {});
      }
    },
    [],
  );

  const restorePoll = (poll: PollDTO, index: number) =>
    setPolls((prev) =>
      prev.some((p) => p._id === poll._id) ? prev : [...prev.slice(0, index), poll, ...prev.slice(index)],
    );

  const commitDelete = (poll: PollDTO, index: number) =>
    api.delete(`/polls/${poll._id}`).catch((err) => {
      restorePoll(poll, index);
      showToast(errorMessage(err, "Couldn't delete that poll."));
    });

  // Sends a held-back delete right away, when a newer delete takes over the toast
  const flushDelete = () => {
    const pending = pendingDelete.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pendingDelete.current = null;
    commitDelete(pending.poll, pending.index);
  };

  const undoDelete = () => {
    const pending = pendingDelete.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pendingDelete.current = null;
    restorePoll(pending.poll, pending.index);
    hideToast();
  };

  const deletePoll = (poll: PollDTO) => {
    flushDelete();
    const index = polls.findIndex((p) => p._id === poll._id);
    setPolls((prev) => prev.filter((p) => p._id !== poll._id));
    const timer = window.setTimeout(() => {
      pendingDelete.current = null;
      commitDelete(poll, index);
    }, UNDO_MS);
    pendingDelete.current = { poll, index, timer };
    showToast("Poll deleted", { action: { label: "Undo", onClick: undoDelete }, duration: UNDO_MS, countdown: true });
  };

  const closePoll = async (poll: PollDTO) => {
    setClosingId(poll._id);
    try {
      await api.patch(`/polls/${poll._id}/close`);
      setPolls((prev) => prev.map((p) => (p._id === poll._id ? { ...p, isOpen: false } : p)));
      showToast("Poll closed");
    } catch (err) {
      showToast(errorMessage(err, "Couldn't close that poll."));
    } finally {
      setClosingId(null);
    }
  };

  const copyLink = async (poll: PollDTO) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/poll/${poll._id}`);
    } catch {
      showToast("Couldn't copy the link.");
      return;
    }
    setCopiedId(poll._id);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedId(null), COPIED_MS);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { data } = await api.get("/polls/export/csv", { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quickpoll-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("CSV exported");
    } catch {
      showToast("Couldn't export the CSV.");
    } finally {
      setExporting(false);
    }
  };

  const loaded = loadState === "ready";
  const rows = polls.map((poll) => ({ poll, status: statusOf(poll) }));
  const totalVotes = polls.reduce((sum, p) => sum + (p.totalVotes ?? 0), 0);
  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const visibleRows = rows.filter((r) => activeFilter.match(r.status));

  let list: ReactNode;
  if (loadState === "loading") {
    list = <SkeletonRows />;
  } else if (loadState === "error") {
    list = (
      <ListMessage title="Couldn't load your polls">
        <span className="text-[15px] text-qp-muted">The server may be waking up.</span>
        <button
          type="button"
          onClick={loadPolls}
          className={`mt-3 h-10 rounded-[10px] border border-qp-fieldline px-4 text-[15px] font-semibold transition-colors hover:border-qp-ink hover:bg-qp-track ${focusRing}`}
        >
          Try again
        </button>
      </ListMessage>
    );
  } else {
    list = (
      <AnimatePresence>
        {visibleRows.map(({ poll, status }, i) => (
          <PollRow
            key={poll._id}
            poll={poll}
            status={status}
            index={i}
            share={totalVotes ? Math.round(((poll.totalVotes ?? 0) / totalVotes) * 100) : 0}
            copied={copiedId === poll._id}
            closing={closingId === poll._id}
            onCopy={() => copyLink(poll)}
            onClose={() => closePoll(poll)}
            onDelete={() => deletePoll(poll)}
          />
        ))}
        {visibleRows.length === 0 &&
          (polls.length === 0 ? (
            <ListMessage key="no-polls" title="No polls yet">
              <span className="text-[15px] text-qp-muted">Create your first poll and share it with anyone.</span>
              <Link
                to="/create"
                className={`mt-3 flex h-10 items-center rounded-[10px] bg-qp-accent px-4 text-[15px] font-semibold text-qp-accent-fg [transition:filter_.2s] hover:brightness-110 ${focusRing}`}
              >
                Create a poll
              </Link>
            </ListMessage>
          ) : (
            <ListMessage key="no-matches" title="No polls here">
              <span className="text-[15px] text-qp-muted">Try another filter or create a new poll.</span>
            </ListMessage>
          ))}
      </AnimatePresence>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="pt-3 font-brand text-qp-ink md:pt-6 lg:pt-8"
    >
      <motion.div variants={fadeUp} className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-[36px] font-medium leading-none tracking-[-0.035em] sm:text-[44px]">Dashboard</h1>
          <p className="text-base text-qp-muted">Manage and monitor your polls</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting || !loaded || polls.length === 0}
            className={`group/btn flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-[10px] border border-qp-fieldline px-[18px] text-[15px] font-semibold [transition:background-color_.2s,border-color_.2s,transform_.12s] enabled:hover:border-qp-ink enabled:hover:bg-qp-track enabled:active:scale-[.985] disabled:cursor-default disabled:opacity-40 ${focusRing}`}
          >
            <DownloadIcon />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          <Link
            to="/create"
            className={`group/btn flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-[10px] bg-qp-accent px-[18px] text-[15px] font-semibold text-qp-accent-fg [transition:filter_.2s,transform_.12s] hover:brightness-110 active:scale-[.985] ${focusRing}`}
          >
            <PlusIcon />
            New Poll
          </Link>
        </div>
      </motion.div>

      <motion.dl variants={fadeUp} className="mt-10 grid grid-cols-3 border-y border-qp-line">
        <Stat label="Total polls" value={loaded ? polls.length : null} className="pr-3 sm:pr-6" />
        <Stat
          label="Live now"
          live
          value={loaded ? rows.filter((r) => r.status === "live").length : null}
          className="border-l border-qp-line px-3 sm:px-6"
        />
        <Stat label="Total votes" value={loaded ? totalVotes : null} className="border-l border-qp-line pl-3 sm:pl-6" />
      </motion.dl>

      <motion.div variants={fadeUp} className="mt-12 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">My polls</h2>
        <div role="group" aria-label="Filter polls" className="flex gap-1 rounded-[10px] bg-qp-panel p-1">
          {FILTERS.map((f) => {
            const selected = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(f.key)}
                className={`relative flex h-8 items-center gap-1.5 rounded-[7px] px-3.5 text-sm font-medium transition-colors ${
                  selected ? "text-qp-ink" : "text-qp-muted hover:text-qp-ink"
                } ${focusRing}`}
              >
                {selected && (
                  <motion.span
                    layoutId="poll-filter"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-[7px] bg-qp-bg shadow-[0_1px_2px_rgba(0,0,0,.12)]"
                  />
                )}
                <span className="relative">{f.label}</span>
                {loaded && (
                  <span className="relative font-brand-mono text-xs opacity-70">
                    {rows.filter((r) => f.match(r.status)).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="mt-4 flex flex-col border-t border-qp-line">
        {list}
      </motion.div>

      <span className="sr-only" role="status">
        {copiedId ? "Link copied" : ""}
      </span>
      <QpToast toast={toast} />
    </motion.div>
  );
}
