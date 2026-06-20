import mongoose from 'mongoose';

const exampleSchema = new mongoose.Schema({
  input: {
    type: String,
    required: true
  },
  output: {
    type: String,
    required: true
  },
  explanation: {
    type: String,
    default: ''
  }
});

const testCaseSchema = new mongoose.Schema({
  input: {
    type: String,
    required: true
  },
  expectedOutput: {
    type: String,
    required: true
  },
  isHidden: {
    type: Boolean,
    default: false
  }
});

const codingChallengeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Challenge title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Challenge description is required'],
    trim: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  constraints: {
    type: String,
    default: ''
  },
  examples: {
    type: [exampleSchema],
    default: []
  },
  testCases: {
    type: [testCaseSchema],
    default: [],
    select: true // Ensure we get this when evaluating, but can deselect in public endpoints if needed
  },
  supportedLanguages: {
    type: [String],
    enum: ['cpp', 'java', 'python', 'javascript'],
    default: ['cpp', 'java', 'python', 'javascript']
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const CodingChallenge = mongoose.model('CodingChallenge', codingChallengeSchema);
export default CodingChallenge;
export { testCaseSchema };
