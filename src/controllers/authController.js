import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Helper to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret_key_123', {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, role, college, bio } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'student',
      college: college || '',
      bio: bio || '',
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        college: user.college,
        bio: user.bio,
        totalPoints: user.totalPoints,
        streak: user.streak,
        contestsParticipated: user.contestsParticipated,
        quizzesAttempted: user.quizzesAttempted,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check for email and password
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide an email and password' });
    }

    // Check for user (must select password since we set select: false in schema)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        college: user.college,
        bio: user.bio,
        totalPoints: user.totalPoints,
        streak: user.streak,
        contestsParticipated: user.contestsParticipated,
        quizzesAttempted: user.quizzesAttempted,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        college: user.college,
        bio: user.bio,
        totalPoints: user.totalPoints,
        streak: user.streak,
        contestsParticipated: user.contestsParticipated,
        quizzesAttempted: user.quizzesAttempted,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};
