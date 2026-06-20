import express from 'express';
import {
  createChallenge,
  getChallenges,
  getChallengeById,
  submitChallenge
} from '../controllers/challengeController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getChallenges)
  .post(protect, authorize('teacher', 'admin'), createChallenge);

router.route('/:id')
  .get(protect, getChallengeById);

router.post('/:id/submit', protect, submitChallenge);

export default router;
