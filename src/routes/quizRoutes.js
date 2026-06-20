import express from 'express';
import {
  createQuiz,
  getQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  attemptQuiz,
  getMyQuizAttempts,
  getQuizAttemptById,
  getQuizAttempts
} from '../controllers/quizController.js';
import { protect, authorize } from '../middlewares/auth.js';
import { generateScorecardPDF } from '../services/pdf.js';
import QuizAttempt from '../models/QuizAttempt.js';

const router = express.Router();

router.route('/')
  .get(protect, getQuizzes)
  .post(protect, authorize('teacher', 'admin'), createQuiz);

router.get('/attempts/my', protect, getMyQuizAttempts);

router.get('/attempts/:id', protect, getQuizAttemptById);

// PDF scorecard download route
router.get('/attempts/:id/pdf', protect, async (req, res, next) => {
  try {
    const attempt = await QuizAttempt.findById(req.params.id)
      .populate('quizId')
      .populate('userId');

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }

    // Secure access
    if (attempt.userId._id.toString() !== req.user.id && req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to download this scorecard' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=scorecard_${attempt._id}.pdf`);

    generateScorecardPDF(res, attempt, attempt.userId, attempt.quizId);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/attempts', protect, authorize('teacher', 'admin'), getQuizAttempts);

router.route('/:id')
  .get(protect, getQuizById)
  .put(protect, authorize('teacher', 'admin'), updateQuiz)
  .delete(protect, authorize('teacher', 'admin'), deleteQuiz);

router.post('/:id/attempt', protect, attemptQuiz);

export default router;
