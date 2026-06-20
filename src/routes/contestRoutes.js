import express from 'express';
import {
  createContest,
  getContests,
  getContestById,
  joinContest,
  submitContestChallenge
} from '../controllers/contestController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getContests)
  .post(protect, authorize('teacher', 'admin'), createContest);

router.route('/:id')
  .get(protect, getContestById);

router.post('/:id/join', protect, joinContest);
router.post('/:id/submit-challenge/:challengeId', protect, submitContestChallenge);

export default router;
