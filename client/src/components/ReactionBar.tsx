import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import socket from '../utils/socket';
import type { ReactionCountDTO } from '../types/api';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

interface ReactionBarProps {
  pollId: string;
  fingerprint: string | null;
}

export default function ReactionBar({ pollId, fingerprint }: ReactionBarProps) {
  const [reactions, setReactions] = useState<ReactionCountDTO[]>([]);
  const [pending, setPending] = useState(false);
  const [justReacted, setJustReacted] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/polls/${pollId}/reactions`).then(({ data }) => setReactions(data.reactions)).catch(() => {});
  }, [pollId]);

  useEffect(() => {
    const onUpdate = (payload: { pollId: string; reactions: ReactionCountDTO[] }) => {
      if (payload.pollId === pollId) setReactions(payload.reactions);
    };
    socket.on('reaction-update', onUpdate);
    return () => {
      socket.off('reaction-update', onUpdate);
    };
  }, [pollId]);

  const react = async (emoji: string) => {
    if (pending) return;
    setPending(true);
    setJustReacted(emoji);
    try {
      const { data } = await api.post(`/polls/${pollId}/reactions`, { emoji, fingerprint });
      setReactions(data.reactions);
    } catch {
      // Already reacted (409) or transient network error — the live update
      // still arrives for other viewers, nothing to surface here.
    } finally {
      setPending(false);
      setTimeout(() => setJustReacted(null), 400);
    }
  };

  if (reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {reactions.map((r) => (
        <motion.button
          key={r.emoji}
          type="button"
          whileTap={{ scale: 0.85 }}
          animate={justReacted === r.emoji ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          onClick={() => react(r.emoji)}
          disabled={pending}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant bg-surface-container hover:bg-surface-container-high hover:border-primary/40 transition-colors text-sm disabled:opacity-60 ${focusRing}`}
        >
          <span>{r.emoji}</span>
          <AnimatePresence mode="wait" initial={false}>
            {r.count > 0 && (
              <motion.span
                key={r.count}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="text-xs font-mono text-on-surface-variant"
              >
                {r.count}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      ))}
    </div>
  );
}
