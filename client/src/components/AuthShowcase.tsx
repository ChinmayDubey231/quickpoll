import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Logo from "./Logo";
import CountdownTimer from "./CountdownTimer";
import AnimatedNumber from "./motion/AnimatedNumber";
import { fadeUp, springy, staggerContainer } from "./motion/variants";

// Decorative preview of the product shown beside the login form on wide
// screens: a fake live poll that keeps receiving votes and reactions, and a
// ranked-choice ballot that reorders itself. Nothing here talks to the API.

// Tailwind's `lg` breakpoint — below it the auth page is a single column and
// the showcase isn't mounted at all, so phones don't run its timers.
const DESKTOP_QUERY = "(min-width: 1024px)";

const POLL_QUESTION = "Best stack for a new side project?";

// Bar colors follow getSeriesColors() order so the preview matches PollView
const POLL_OPTIONS = [
  { text: "Next.js + Postgres", bar: "bg-primary", weight: 0.31 },
  { text: "SvelteKit + Supabase", bar: "bg-secondary", weight: 0.29 },
  { text: "Remix + SQLite", bar: "bg-tertiary", weight: 0.22 },
  { text: "Rails 8 or Laravel", bar: "bg-error", weight: 0.18 },
];
const INITIAL_COUNTS = [41, 36, 24, 17];

const VOTERS = ["Alice", "Bob", "Carol", "Priya", "Marcus", "Aiko", "Diego", "Nina", "Sam", "Leo"];

// Same palette as the server's REACTION_EMOJIS
const REACTIONS = ["👍", "🎉", "🤔", "❤️", "😂"];
const INITIAL_REACTIONS = [24, 12, 5, 18, 7];

const BALLOT = [
  { id: "pepperoni", label: "Pepperoni", emoji: "🍕" },
  { id: "margherita", label: "Margherita", emoji: "🍅" },
  { id: "mushroom", label: "Mushroom", emoji: "🍄" },
  { id: "pineapple", label: "Pineapple", emoji: "🍍" },
];

const FEATURES = [
  { icon: "how_to_vote", label: "3 poll types" },
  { icon: "bolt", label: "Live results" },
  { icon: "timer", label: "Auto-close" },
  { icon: "qr_code_2", label: "QR sharing" },
];

const randomIndex = (length: number) => Math.floor(Math.random() * length);

const pickWeighted = (weights: number[]) => {
  let r = Math.random() * weights.reduce((sum, w) => sum + w, 0);
  const index = weights.findIndex((w) => (r -= w) < 0);
  return index === -1 ? weights.length - 1 : index;
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

// setInterval that skips ticks while the tab is hidden, so nothing piles up
// (e.g. floating emojis) while the page isn't being looked at.
function useTicker(tick: () => void, ms: number, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (!document.hidden) tick();
    }, ms);
    return () => clearInterval(id);
    // `tick` only uses state setters and module constants, so it never goes stale
  }, [ms, enabled]);
}

/* -------------------------------- live poll ------------------------------- */

interface LastVote {
  id: number;
  option: number;
  voter: string;
}

interface FloatingReaction {
  id: number;
  index: number;
  drift: number;
}

function LivePollCard({ animate }: { animate: boolean }) {
  const [counts, setCounts] = useState(INITIAL_COUNTS);
  const [lastVote, setLastVote] = useState<LastVote | null>(null);
  const [reactions, setReactions] = useState(INITIAL_REACTIONS);
  const [floaters, setFloaters] = useState<FloatingReaction[]>([]);
  // Fixed deadline a couple of hours out so the real countdown pill ticks
  const [expiresAt] = useState(() => new Date(Date.now() + (2 * 3600 + 14 * 60 + 9) * 1000).toISOString());

  useTicker(
    () => {
      const option = pickWeighted(POLL_OPTIONS.map((o) => o.weight));
      setCounts((c) => c.map((n, i) => (i === option ? n + 1 : n)));
      setLastVote((v) => ({ id: (v?.id ?? 0) + 1, option, voter: VOTERS[randomIndex(VOTERS.length)] }));
    },
    1400,
    animate
  );

  useTicker(
    () => {
      const index = randomIndex(REACTIONS.length);
      setReactions((r) => r.map((n, i) => (i === index ? n + 1 : n)));
      setFloaters((f) => [...f.slice(-5), { id: Date.now(), index, drift: Math.random() * 24 - 12 }]);
    },
    1900,
    animate
  );

  const total = counts.reduce((sum, n) => sum + n, 0);

  return (
    <div className="glass-card rounded-2xl p-6 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-secondary-container/20 text-secondary rounded-full border border-secondary/30">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
          Live
        </span>
        <CountdownTimer expiresAt={expiresAt} />
      </div>

      <p className="font-display font-semibold text-lg leading-snug text-on-surface">{POLL_QUESTION}</p>
      <div className="mt-1.5 flex items-center gap-1.5 h-4 text-xs font-mono text-on-surface-variant overflow-hidden">
        <AnimatedNumber value={total} className="text-on-surface" />
        votes
        <span aria-hidden="true">·</span>
        {/* Keyed remount slides each new voter in; no exit, so no presence bookkeeping to get stuck */}
        <motion.span
          key={lastVote?.id ?? 0}
          initial={lastVote ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {lastVote ? `${lastVote.voter} just voted` : "updating live"}
        </motion.span>
      </div>

      <ul className="mt-5 space-y-3">
        {POLL_OPTIONS.map((opt, i) => {
          const pct = Math.round((counts[i] / total) * 100);
          return (
            <li key={opt.text}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-on-surface font-medium">{opt.text}</span>
                <span className="relative text-on-surface-variant font-mono text-xs">
                  <AnimatePresence>
                    {lastVote?.option === i && (
                      <motion.span
                        key={lastVote.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25 }}
                        className="absolute right-full mr-2 text-secondary font-bold"
                      >
                        +1
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {counts[i]} · {pct}%
                </span>
              </div>
              <div className="h-2 bg-surface-container rounded-full overflow-hidden border border-outline-variant/30">
                <motion.div
                  className={`h-full rounded-full ${opt.bar}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 pt-4 border-t border-outline-variant/60 flex gap-1.5">
        {REACTIONS.map((emoji, i) => (
          <span
            key={emoji}
            className="relative flex items-center gap-1 px-2.5 py-1 rounded-full border border-outline-variant bg-surface-container text-xs"
          >
            {floaters
              .filter((f) => f.index === i)
              .map((f) => (
                <motion.span
                  key={f.id}
                  initial={{ opacity: 0, y: 0, scale: 0.6 }}
                  animate={{ opacity: [0, 1, 1, 0], y: -64, x: f.drift, scale: 1.25 }}
                  transition={{ duration: 1.6, ease: "easeOut" }}
                  onAnimationComplete={() => setFloaters((all) => all.filter((x) => x.id !== f.id))}
                  className="absolute inset-x-0 bottom-full text-center text-base pointer-events-none"
                >
                  {emoji}
                </motion.span>
              ))}
            <span>{emoji}</span>
            <span className="font-mono text-on-surface-variant">{reactions[i]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ ranked ballot ----------------------------- */

function RankedBallotCard({ animate }: { animate: boolean }) {
  const [{ order, lifted }, setBallot] = useState({ order: BALLOT, lifted: null as string | null });

  // Swap a random adjacent pair, lifting the item that moves up as if it
  // were being dragged — mirrors the drag-to-rank voter UI.
  useTicker(
    () => {
      const i = randomIndex(BALLOT.length - 1);
      setBallot(({ order }) => {
        const next = [...order];
        [next[i], next[i + 1]] = [next[i + 1], next[i]];
        return { order: next, lifted: next[i].id };
      });
      setTimeout(() => setBallot((b) => ({ ...b, lifted: null })), 650);
    },
    2600,
    animate
  );

  return (
    <motion.div
      animate={animate ? { y: [0, -8, 0] } : undefined}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      className="glass-card rounded-2xl p-4 w-56 shadow-2xl shadow-black/30"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
          Ranked choice
        </span>
        <span className="material-symbols-outlined text-[16px] text-primary">swap_vert</span>
      </div>
      <div className="flex gap-2">
        <ol className="flex flex-col gap-1.5">
          {order.map((_, rank) => (
            <li key={rank} className="h-8 w-4 flex items-center justify-center font-mono text-xs text-primary">
              {rank + 1}
            </li>
          ))}
        </ol>
        <ul className="flex-1 flex flex-col gap-1.5">
          {order.map((item) => (
            <motion.li
              key={item.id}
              layout
              animate={{ scale: lifted === item.id ? 1.05 : 1 }}
              transition={springy}
              style={{ zIndex: lifted === item.id ? 1 : 0 }}
              className={`relative h-8 flex items-center gap-2 px-2.5 rounded-lg border text-sm text-on-surface ${
                lifted === item.id
                  ? "bg-surface-container-highest border-primary/50 shadow-lg shadow-black/20"
                  : "bg-surface-container-high/70 border-outline-variant/60"
              }`}
            >
              <span>{item.emoji}</span>
              <span className="flex-1">{item.label}</span>
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">drag_indicator</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

/* ---------------------------------- root ---------------------------------- */

function Showcase() {
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion;

  return (
    <motion.aside
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="hidden lg:flex relative m-4 flex-col justify-between gap-8 rounded-3xl border border-outline-variant/60 bg-surface-container-low/40 px-10 xl:px-14 py-8 xl:py-10 overflow-hidden"
    >
      <div aria-hidden="true" className="dot-grid absolute inset-0 pointer-events-none" />

      <motion.div variants={fadeUp} className="relative flex items-center gap-3">
        <Logo size={36} />
        <span className="font-display font-bold text-2xl gradient-text tracking-tight">QuickPoll</span>
      </motion.div>

      <div className="relative">
        <motion.h2
          variants={fadeUp}
          className="font-display font-bold text-4xl xl:text-5xl leading-tight tracking-tight text-on-surface"
        >
          Ask anything.
          <br />
          <span className="gradient-text">See answers live.</span>
        </motion.h2>
        <motion.p variants={fadeUp} className="mt-3 max-w-md text-on-surface-variant">
          Share a link and watch every vote land the moment it's cast.
        </motion.p>

        {/* The ballot only fits beside the poll card once the column widens at xl */}
        <motion.div variants={fadeUp} aria-hidden="true" className="relative mt-8 flex items-center gap-5">
          <div className="absolute -inset-8 rounded-full bg-primary-container/20 blur-3xl pointer-events-none" />
          <div className="relative flex-1 min-w-0 max-w-md">
            <LivePollCard animate={animate} />
          </div>
          <div className="relative shrink-0 hidden xl:block">
            <RankedBallotCard animate={animate} />
          </div>
        </motion.div>
      </div>

      <motion.ul variants={fadeUp} className="relative flex flex-wrap gap-2">
        {FEATURES.map((f) => (
          <li
            key={f.label}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant/70 bg-surface-container/60 text-xs text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">{f.icon}</span>
            {f.label}
          </li>
        ))}
      </motion.ul>
    </motion.aside>
  );
}

export default function AuthShowcase() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  return isDesktop ? <Showcase /> : null;
}
