import { Router } from 'express';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { getVoteCounts, castVote, getVoteStatus } from '../controllers/voteController.js';

const router = Router();

// No auth required — public voting
router.get('/:pollId', apiLimiter, getVoteCounts);
router.get('/:pollId/status', apiLimiter, getVoteStatus);
router.post('/:pollId', apiLimiter, castVote);

export default router;
