import express from 'express';
import { getStudentAnalytics, getTeacherAnalytics, getAdminAnalytics, getLeaderboard } from '../controllers/analyticsController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

router.get('/leaderboard', protect, getLeaderboard);

router.get('/student', protect, getStudentAnalytics);
router.get('/teacher', protect, authorize('teacher', 'admin'), getTeacherAnalytics);
router.get('/admin', protect, authorize('admin'), getAdminAnalytics);

export default router;
