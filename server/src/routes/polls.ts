import { Router } from 'express';
import auth from '../middleware/auth.js';
import { apiLimiter, commentLimiter } from '../middleware/rateLimiter.js';
import {
  getMyPolls,
  createPoll,
  getPoll,
  getPublicPolls,
  closePoll,
  deletePoll,
  getPollAnalytics,
} from '../controllers/pollController.js';
import { getComments, addComment, deleteComment } from '../controllers/commentController.js';
import { getReactions, addReaction } from '../controllers/reactionController.js';

const router = Router();

// Public — must be registered before GET /:id, or Express/Mongoose will try
// to cast the literal "discover" as an ObjectId.
router.get('/discover', apiLimiter, getPublicPolls);

// Public
router.get('/:id', apiLimiter, getPoll);
router.get('/:id/comments', apiLimiter, getComments);
router.post('/:id/comments', commentLimiter, addComment);
router.get('/:id/reactions', apiLimiter, getReactions);
router.post('/:id/reactions', apiLimiter, addReaction);

// Creator — JWT required
router.get('/', auth, getMyPolls);
router.post('/', auth, apiLimiter, createPoll);
router.patch('/:id/close', auth, closePoll);
router.delete('/:id', auth, deletePoll);
router.delete('/:id/comments/:commentId', auth, deleteComment);
router.get('/:id/analytics', auth, getPollAnalytics);

export default router;
