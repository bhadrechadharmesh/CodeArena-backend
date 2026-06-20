import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: function() {
      // Password is only required if googleId is not present (standard registration)
      return !this.googleId;
    },
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false,
  },
  googleId: {
    type: String,
    sparse: true,
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student',
  },
  avatar: {
    type: String,
    default: '',
  },
  college: {
    type: String,
    trim: true,
    default: '',
  },
  bio: {
    type: String,
    trim: true,
    default: '',
  },
  totalPoints: {
    type: Number,
    default: 0,
  },
  streak: {
    type: Number,
    default: 0,
  },
  contestsParticipated: {
    type: Number,
    default: 0,
  },
  quizzesAttempted: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true
});

// Pre-save hook to hash the password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
