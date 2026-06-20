import mongoose from 'mongoose';

const attemptAnswerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  selectedOption: {
    type: Number,
    default: null
  },
  selectedOptions: {
    type: [Number],
    default: []
  },
  booleanAnswer: {
    type: Boolean,
    default: null
  },
  textAnswer: {
    type: String,
    default: ''
  },
  isCorrect: {
    type: Boolean,
    default: false
  }
});

const quizAttemptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  answers: {
    type: [attemptAnswerSchema],
    default: []
  },
  score: {
    type: Number,
    required: true,
    default: 0
  },
  accuracy: {
    type: Number, // Percentage, e.g., 85.5
    required: true,
    default: 0
  },
  timeTaken: {
    type: Number, // In seconds
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

const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);
export default QuizAttempt;
