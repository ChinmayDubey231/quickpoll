import type { Request, Response } from 'express';
import Poll from '../models/Poll.js';
import Comment from '../models/Comment.js';
import { getIO } from '../config/socket.js';
import { paramId } from '../utils/http.js';
import type { CommentDTO } from '../types/socket.js';

// ─── GET /api/polls/:id/comments ───────────────────────────────────────────────
// Public — paginated, newest last (chronological discussion order)
export const getComments = async (req: Request, res: Response) => {
  const pollId = paramId(req.params.id);
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));

  const [comments, totalCount] = await Promise.all([
    Comment.find({ pollId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Comment.countDocuments({ pollId }),
  ]);

  res.json({
    comments: comments.reverse(),
    page,
    totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    totalCount,
  });
};

// ─── POST /api/polls/:id/comments ──────────────────────────────────────────────
// Public — no auth required, matches the app's anonymous-voter model
export const addComment = async (req: Request, res: Response) => {
  const pollId = paramId(req.params.id);
  const { authorName, body } = req.body;

  if (!authorName || typeof authorName !== 'string' || !authorName.trim()) {
    return res.status(400).json({ message: 'Name is required' });
  }
  if (!body || typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ message: 'Comment cannot be empty' });
  }
  if (authorName.trim().length > 40) {
    return res.status(400).json({ message: 'Name must be under 40 characters' });
  }
  if (body.trim().length > 500) {
    return res.status(400).json({ message: 'Comment must be under 500 characters' });
  }

  const poll = await Poll.findById(pollId).select('_id');
  if (!poll) return res.status(404).json({ message: 'Poll not found' });

  const comment = await Comment.create({
    pollId,
    authorName: authorName.trim(),
    body: body.trim(),
  });

  const dto: CommentDTO = {
    _id: comment._id.toString(),
    pollId,
    authorName: comment.authorName,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
  };

  getIO().to(pollId).emit('comment-added', dto);

  res.status(201).json(dto);
};

// ─── DELETE /api/polls/:id/comments/:commentId ─────────────────────────────────
// Creator-only moderation
export const deleteComment = async (req: Request, res: Response) => {
  const pollId = paramId(req.params.id);
  const commentId = paramId(req.params.commentId);

  const poll = await Poll.findOne({ _id: pollId, creatorId: req.user._id }).select('_id');
  if (!poll) return res.status(404).json({ message: 'Poll not found' });

  const comment = await Comment.findOneAndDelete({ _id: commentId, pollId });
  if (!comment) return res.status(404).json({ message: 'Comment not found' });

  res.json({ message: 'Comment deleted' });
};
