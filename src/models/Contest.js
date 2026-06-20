import mongoose from 'mongoose';

const leaderboardEntrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  score: {
    type: Number,
    default: 0
  },
  penaltyTime: {
    type: Number, // In minutes/seconds for competitive ranking
    default: 0
  },
  submissionsCount: {
    type: Number,
    default: 0
  },
  solvedChallenges: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CodingChallenge'
  }],
  completedQuizzes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz'
  }]
});

const contestSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Contest title is required'],
    trim: true
  },
  startTime: {
    type: Date,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: Date,
    required: [true, 'End time is required']
  },
  contestType: {
    type: String,
    enum: ['quiz', 'coding', 'hybrid'],
    default: 'coding'
  },
  codingChallenges: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CodingChallenge'
  }],
  quizzes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz'
  }],
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  leaderboard: {
    type: [leaderboardEntrySchema],
    default: []
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const Contest = mongoose.model('Contest', contestSchema);
export default Contest;
