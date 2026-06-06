import { Router } from 'express';
import auth from '../middleware/auth.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import {
  getMyPolls,
  createPoll,
  getPoll,
  closePoll,
  deletePoll,
  getPollAnalytics,
} from '../controllers/pollController.js';

const router = Router();

// Public
router.get('/:id', apiLimiter, getPoll);

// Creator — JWT required
router.get('/', auth, getMyPolls);
router.post('/', auth, apiLimiter, createPoll);
router.patch('/:id/close', auth, closePoll);
router.delete('/:id', auth, deletePoll);
router.get('/:id/analytics', auth, getPollAnalytics);

export default router;
