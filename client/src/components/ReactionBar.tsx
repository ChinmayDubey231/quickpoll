import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { AnimatePresence, motion } from "framer-motion";
import api from "../utils/api";
import socket from "../utils/socket";
import RollingNumber from "./motion/RollingNumber";
import type { ReactionCountDTO, ReactionsResponseDTO } from "../types/api";

const EMOJI_NAMES: Record<string, string> = {
  "👍": "Thumbs up",
  "🎉": "Party",
  "🤔": "Thinking",
  "❤️": "Heart",
  "😂": "Laughing",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-qp-bg";

type Pop = { emoji: string; key: number; kind: "add" | "remove" };

interface ReactionBarProps {
  pollId: string;
  fingerprint: string | null;
  // A reaction couldn't be saved (or taken back) and has been reverted
  onError?: () => void;
}

// Each chip is a toggle: tap to react, tap again to take it back. The chip
// flips straight away; requests for one emoji go out one at a time, and taps
// made while one is in flight are folded into the next, so fast tapping
// settles on whatever the chip shows last.
export default function ReactionBar({ pollId, fingerprint, onError }: ReactionBarProps) {
  // Counts as the server last reported them
  const [counts, setCounts] = useState<ReactionCountDTO[]>([]);
  // What this visitor has reacted with: as shown (wanted) and as the server has it (saved)
  const [wanted, setWanted] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [pop, setPop] = useState<Pop | null>(null);

  const wantedRef = useRef(wanted);
  const savedRef = useRef(saved);
  const inFlight = useRef(new Set<string>());
  const popSeq = useRef(0);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const updateWanted = (next: Set<string>) => {
    wantedRef.current = next;
    setWanted(next);
  };
  const updateSaved = (next: Set<string>) => {
    savedRef.current = next;
    setSaved(next);
  };

  useEffect(() => {
    api
      .get<ReactionsResponseDTO>(`/polls/${pollId}/reactions`, { params: { fingerprint } })
      .then(({ data }) => {
        const mine = new Set(data.mine ?? []);
        setCounts(data.reactions);
        updateSaved(mine);
        updateWanted(new Set(mine));
      })
      .catch(() => {});
  }, [pollId, fingerprint]);

  useEffect(() => {
    const onUpdate = (payload: { pollId: string; reactions: ReactionCountDTO[] }) => {
      if (payload.pollId !== pollId) return;
      // An emoji with our own request in flight takes its count from that
      // response instead, so the chip doesn't count our change twice
      setCounts((prev) =>
        payload.reactions.map((r) => (inFlight.current.has(r.emoji) ? (prev.find((p) => p.emoji === r.emoji) ?? r) : r)),
      );
    };
    socket.on("reaction-update", onUpdate);
    return () => {
      socket.off("reaction-update", onUpdate);
    };
  }, [pollId]);

  const sync: (emoji: string) => Promise<void> = useCallback(
    async (emoji: string) => {
      if (inFlight.current.has(emoji)) return;
      const want = wantedRef.current.has(emoji);
      if (want === savedRef.current.has(emoji)) return;

      inFlight.current.add(emoji);
      const nextSaved = new Set(savedRef.current);
      try {
        const { data } = want
          ? await api.post<ReactionsResponseDTO>(`/polls/${pollId}/reactions`, { emoji, fingerprint })
          : await api.delete<ReactionsResponseDTO>(`/polls/${pollId}/reactions/${encodeURIComponent(emoji)}`, {
              params: { fingerprint },
            });
        setCounts(data.reactions);
        if (want) nextSaved.add(emoji);
        else nextSaved.delete(emoji);
      } catch (err) {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        if (want && status === 409) {
          // Already on record (another tab, or the same network) — it's ours
          nextSaved.add(emoji);
        } else if (!want && status === 404) {
          // Already gone
          nextSaved.delete(emoji);
        } else {
          // Put the chip back the way the server has it
          const reverted = new Set(wantedRef.current);
          if (savedRef.current.has(emoji)) reverted.add(emoji);
          else reverted.delete(emoji);
          updateWanted(reverted);
          onErrorRef.current?.();
        }
        // The optimistic count may be off after either of the above; re-read it
        api
          .get<ReactionsResponseDTO>(`/polls/${pollId}/reactions`)
          .then(({ data }) => setCounts(data.reactions))
          .catch(() => {});
      } finally {
        updateSaved(nextSaved);
        inFlight.current.delete(emoji);
      }
      // Taps made meanwhile may have flipped it again
      void sync(emoji);
    },
    [pollId, fingerprint],
  );

  const toggle = (emoji: string) => {
    const next = new Set(wantedRef.current);
    const adding = !next.has(emoji);
    if (adding) next.add(emoji);
    else next.delete(emoji);
    updateWanted(next);
    setPop({ emoji, key: ++popSeq.current, kind: adding ? "add" : "remove" });
    void sync(emoji);
  };

  if (counts.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Reactions" className="flex flex-wrap gap-2">
        {counts.map((r) => {
          const pressed = wanted.has(r.emoji);
          // The server's count, plus or minus a change that hasn't landed yet
          const count = Math.max(0, r.count + (pressed ? 1 : 0) - (saved.has(r.emoji) ? 1 : 0));
          const name = EMOJI_NAMES[r.emoji] ?? r.emoji;
          const popped = pop?.emoji === r.emoji ? pop : null;
          return (
            <motion.button
              key={r.emoji}
              type="button"
              onClick={() => toggle(r.emoji)}
              aria-pressed={pressed}
              aria-label={`${name}${count ? `, ${count}` : ""}`}
              title={pressed ? `Remove your ${name.toLowerCase()} reaction` : `React with ${name.toLowerCase()}`}
              whileTap={{ scale: 0.92 }}
              className={`relative flex h-10 min-w-[56px] items-center justify-center gap-2 rounded-full border px-3.5 font-brand-mono text-[13px] text-qp-ink [transition:border-color_.2s,background-color_.2s] ${
                pressed
                  ? "border-qp-accent bg-[color-mix(in_srgb,var(--qp-accent)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--qp-accent)_18%,transparent)]"
                  : "border-qp-line hover:border-qp-muted hover:bg-qp-track"
              } ${focusRing}`}
            >
              {/* Only the emoji remounts to replay its animation, so the button keeps focus */}
              <motion.span
                key={popped?.key ?? 0}
                aria-hidden="true"
                initial={popped ? { scale: 1 } : false}
                animate={popped ? { scale: popped.kind === "add" ? [1, 1.35, 1] : [1, 0.75, 1] } : undefined}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="inline-block text-base"
              >
                {r.emoji}
              </motion.span>
              {count > 0 && (
                <span aria-hidden="true" className={pressed ? "text-qp-accent-ink" : ""}>
                  <RollingNumber value={count} />
                </span>
              )}
              {/* A copy of the emoji floats up when you add it */}
              <AnimatePresence>
                {popped?.kind === "add" && (
                  <motion.span
                    key={popped.key}
                    aria-hidden="true"
                    initial={{ opacity: 1, y: 0, scale: 0.8 }}
                    animate={{ opacity: 0, y: -30, scale: 1.25 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    onAnimationComplete={() => setPop((p) => (p?.key === popped.key ? null : p))}
                    className="pointer-events-none absolute left-3.5 top-1.5 text-base"
                  >
                    {r.emoji}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence initial={false}>
        {wanted.size > 0 && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden text-[13px] text-qp-muted"
          >
            Tap a reaction again to remove it.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
