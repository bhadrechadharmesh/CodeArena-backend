import express from 'express';
import {
  createChallenge,
  getChallenges,
  getChallengeById,
  submitChallenge,
  deleteChallenge,
  getChallengeAttempts,
  getMyChallengeAttempts
} from '../controllers/challengeController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getChallenges)
  .post(protect, authorize('teacher', 'admin'), createChallenge);

router.get('/attempts/my', protect, getMyChallengeAttempts);

router.get('/:id/attempts', protect, authorize('teacher', 'admin'), getChallengeAttempts);

router.route('/:id')
  .get(protect, getChallengeById)
  .delete(protect, authorize('teacher', 'admin'), deleteChallenge);

router.post('/:id/submit', protect, submitChallenge);

export default router;
