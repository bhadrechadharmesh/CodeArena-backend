import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  questionType: {
    type: String,
    enum: ['mcq', 'multiple_correct', 'true_false', 'fill_blank'],
    required: true
  },
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  options: {
    type: [String],
    default: []
  },
  correctOption: {
    type: Number, // index for MCQ (0-indexed)
    default: null
  },
  correctAnswers: {
    type: [Number], // array of indexes for Multiple Correct
    default: []
  },
  answer: {
    type: Boolean, // for True/False
    default: null
  },
  correctAnswerText: {
    type: String, // for Fill in Blank
    trim: true,
    default: ''
  },
  explanation: {
    type: String,
    trim: true,
    default: ''
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  topic: {
    type: String,
    trim: true,
    default: 'General'
  }
});

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Quiz title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  category: {
    type: String,
    required: [true, 'Quiz category is required'],
    trim: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  duration: {
    type: Number, // duration in minutes
    required: [true, 'Quiz duration is required'],
    min: [1, 'Duration must be at least 1 minute']
  },
  tags: {
    type: [String],
    default: []
  },
  totalMarks: {
    type: Number,
    required: true,
    default: 0
  },
  questions: {
    type: [questionSchema],
    default: []
  },
  isPublished: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Quiz = mongoose.model('Quiz', quizSchema);
export default Quiz;
export { questionSchema };
