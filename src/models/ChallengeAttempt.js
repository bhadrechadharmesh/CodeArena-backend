import mongoose from 'mongoose';

const challengeAttemptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  challengeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CodingChallenge',
    required: true
  },
  code: {
    type: String,
    required: true
  },
  language: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true
  },
  passedCount: {
    type: Number,
    required: true,
    default: 0
  },
  totalCount: {
    type: Number,
    required: true,
    default: 0
  },
  pointsAwarded: {
    type: Number,
    required: true,
    default: 0
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const ChallengeAttempt = mongoose.model('ChallengeAttempt', challengeAttemptSchema);
export default ChallengeAttempt;
