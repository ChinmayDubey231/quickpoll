import { useEffect, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import api from '../utils/api';
import socket from '../utils/socket';
import type { CommentDTO } from '../types/api';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

export default function CommentSection({ pollId }: { pollId: string }) {
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get(`/polls/${pollId}/comments`, { params: { limit: 50 } })
      .then(({ data }) => setComments(data.comments))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pollId]);

  useEffect(() => {
    const onAdded = (comment: CommentDTO) => {
      if (comment.pollId === pollId) setComments((prev) => [...prev, comment]);
    };
    socket.on('comment-added', onAdded);
    return () => {
      socket.off('comment-added', onAdded);
    };
  }, [pollId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!authorName.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/polls/${pollId}/comments`, { authorName: authorName.trim(), body: body.trim() });
      setBody('');
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6">
      <h2 className="font-display font-semibold text-on-surface mb-4">Discussion</h2>

      <form onSubmit={handleSubmit} className="mb-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            maxLength={40}
            placeholder="Your name"
            className={`sm:w-36 bg-surface-container border border-outline-variant rounded-xl px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary/60 transition-all ${focusRing}`}
          />
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            placeholder="Add a comment…"
            className={`flex-1 bg-surface-container border border-outline-variant rounded-xl px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary/60 transition-all ${focusRing}`}
          />
          <button
            type="submit"
            disabled={submitting || !authorName.trim() || !body.trim()}
            className={`px-4 py-2 bg-primary-container text-on-primary-container font-medium rounded-xl text-sm disabled:opacity-40 transition-all hover:scale-[0.98] ${focusRing}`}
          >
            Post
          </button>
        </div>
        {error && <p className="text-xs text-error mt-1.5">{error}</p>}
      </form>

      {loading ? (
        <p className="text-sm text-on-surface-variant font-mono">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No comments yet — be the first to say something.</p>
      ) : (
        <ul className="space-y-3 max-h-80 overflow-y-auto">
          {comments.map((c) => (
            <li key={c._id} className="text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-on-surface">{c.authorName}</span>
                <span className="text-[10px] font-mono text-on-surface-variant">
                  {new Date(c.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-on-surface-variant">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
