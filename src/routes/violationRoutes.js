import express from 'express';
import { logViolation, getMyViolations, getAllViolations } from '../controllers/violationController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

router.route('/')
  .post(protect, logViolation)
  .get(protect, authorize('teacher', 'admin'), getAllViolations);

router.get('/my', protect, getMyViolations);

export default router;
