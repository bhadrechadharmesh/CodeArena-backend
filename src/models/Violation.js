import mongoose from 'mongoose';

const violationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest',
    default: null
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    default: null
  },
  violationType: {
    type: String,
    enum: ['exit_fullscreen', 'tab_switch', 'multiple_faces', 'no_face'],
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Violation = mongoose.model('Violation', violationSchema);
export default Violation;
