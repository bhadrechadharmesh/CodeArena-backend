import express from 'express';
import {
  createContest,
  getContests,
  getContestById,
  joinContest,
  submitContestChallenge,
  submitContestQuiz,
  deleteContest
} from '../controllers/contestController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getContests)
  .post(protect, authorize('teacher', 'admin'), createContest);

router.route('/:id')
  .get(protect, getContestById)
  .delete(protect, authorize('teacher', 'admin'), deleteContest);

router.post('/:id/join', protect, joinContest);
router.post('/:id/submit-challenge/:challengeId', protect, submitContestChallenge);
router.post('/:id/submit-quiz/:quizId', protect, submitContestQuiz);

export default router;
