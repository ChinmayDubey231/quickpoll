import { useEffect, useState } from 'react';
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
    try {
      const { data } = await api.post(`/polls/${pollId}/reactions`, { emoji, fingerprint });
      setReactions(data.reactions);
    } catch {
      // Already reacted (409) or transient network error — the live update
      // still arrives for other viewers, nothing to surface here.
    } finally {
      setPending(false);
    }
  };

  if (reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => react(r.emoji)}
          disabled={pending}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant bg-surface-container hover:bg-surface-container-high hover:border-primary/40 transition-all text-sm disabled:opacity-60 ${focusRing}`}
        >
          <span>{r.emoji}</span>
          {r.count > 0 && <span className="text-xs font-mono text-on-surface-variant">{r.count}</span>}
        </button>
      ))}
    </div>
  );
}
