import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { isAxiosError } from "axios";
import { AnimatePresence, motion } from "framer-motion";
import api from "../utils/api";
import socket from "../utils/socket";
import type { CommentDTO, CommentsResponseDTO } from "../types/api";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-qp-bg";
const fieldClass =
  "box-border rounded-[9px] border border-qp-fieldline bg-qp-field text-[15px] text-qp-ink outline-none [transition:border-color_.2s,box-shadow_.2s] placeholder:text-qp-muted placeholder:opacity-70 focus:border-qp-accent focus:shadow-[0_0_0_3px_var(--qp-ring)]";

// The server requires a name; a blank one is posted as this
const ANONYMOUS = "Anonymous";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

// Time of day for today's comments, the date for anything older
const formatWhen = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.trim().slice(0, 2)).toUpperCase();
};

export default function CommentSection({ pollId }: { pollId: string }) {
  // Kept oldest-first as the API sends them; shown newest-first
  const [comments, setComments] = useState<CommentDTO[]>([]);
  // Comments beyond the first page, which are counted but not loaded
  const [unloaded, setUnloaded] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // A comment can arrive both from the POST response and the socket broadcast
  const addComment = (comment: CommentDTO) => {
    setComments((prev) => (prev.some((c) => c._id === comment._id) ? prev : [...prev, comment]));
  };

  useEffect(() => {
    api
      .get<CommentsResponseDTO>(`/polls/${pollId}/comments`, { params: { limit: 50 } })
      .then(({ data }) => {
        setComments(data.comments);
        setUnloaded(Math.max(0, data.totalCount - data.comments.length));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pollId]);

  useEffect(() => {
    const onAdded = (comment: CommentDTO) => {
      if (comment.pollId === pollId) addComment(comment);
    };
    socket.on("comment-added", onAdded);
    return () => {
      socket.off("comment-added", onAdded);
    };
  }, [pollId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post<CommentDTO>(`/polls/${pollId}/comments`, {
        authorName: authorName.trim() || ANONYMOUS,
        body: text,
      });
      addComment(data);
      setBody("");
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message || "Couldn't post your comment. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onBodyKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const canPost = body.trim().length > 0 && !submitting;
  const totalCount = unloaded + comments.length;

  return (
    <section aria-labelledby="discussion-heading" className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="discussion-heading" className="text-[22px] font-semibold tracking-[-0.02em]">
          Discussion
        </h2>
        {!loading && (
          <span className="font-brand-mono text-xs text-qp-muted">
            {totalCount} {totalCount === 1 ? "comment" : "comments"}
          </span>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2.5 rounded-[14px] border border-qp-line bg-qp-panel p-4 [transition:background-color_.4s,border-color_.4s]"
      >
        <input
          type="text"
          aria-label="Your name"
          autoComplete="nickname"
          maxLength={40}
          placeholder="Your name (optional)"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          className={`h-11 px-3 ${fieldClass}`}
        />
        <textarea
          aria-label="Comment"
          rows={3}
          maxLength={500}
          placeholder="Add a comment"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onBodyKeyDown}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "comment-error" : undefined}
          className={`min-h-[88px] resize-y px-3 py-2.5 leading-[1.45] ${fieldClass}`}
        />
        {error && (
          <p id="comment-error" role="alert" className="text-sm text-qp-error">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="hidden text-[13px] text-qp-muted sm:inline">{isMac ? "⌘" : "Ctrl"} + Enter to post</span>
          <button
            type="submit"
            disabled={!canPost}
            className={`ml-auto flex h-10 items-center gap-2 rounded-[9px] bg-qp-accent px-[18px] text-[15px] font-semibold text-qp-accent-fg [transition:filter_.2s,opacity_.2s] enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-[.45] ${focusRing}`}
          >
            {submitting && (
              <span aria-hidden="true" className="h-[14px] w-[14px] animate-spin rounded-full border-2 border-current border-r-transparent" />
            )}
            {submitting ? "Posting" : "Post"}
          </button>
        </div>
      </form>

      {loading ? (
        <div aria-hidden="true" className="flex flex-col">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3 border-b border-qp-line py-4" style={{ opacity: 1 - i * 0.35 }}>
              <span className="h-8 w-8 flex-none animate-pulse rounded-full bg-qp-track" />
              <span className="flex flex-1 flex-col gap-2">
                <span className="h-3.5 w-28 animate-pulse rounded bg-qp-track" />
                <span className="h-3.5 w-4/5 animate-pulse rounded bg-qp-track" />
              </span>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="py-4 text-[15px] text-qp-muted">No comments yet. Start the discussion.</p>
      ) : (
        <ul className="flex flex-col">
          <AnimatePresence initial={false}>
            {[...comments].reverse().map((c) => (
              <motion.li
                key={c._id}
                layout="position"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex gap-3 border-b border-qp-line py-4"
              >
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 flex-none place-items-center rounded-full border border-qp-line bg-qp-panel font-brand-mono text-[11px] font-bold text-qp-muted"
                >
                  {initials(c.authorName)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[15px] font-semibold">{c.authorName}</span>
                    <time dateTime={c.createdAt} className="font-brand-mono text-xs text-qp-muted">
                      {formatWhen(c.createdAt)}
                    </time>
                  </span>
                  <p className="whitespace-pre-wrap text-[15px] leading-normal [overflow-wrap:anywhere]">{c.body}</p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
