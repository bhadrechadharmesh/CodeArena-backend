import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendOTPEmail, sendForgotPasswordOTPEmail } from '../services/emailService.js';

// Helper to generate a 6-digit random number OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

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

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    let user;

    if (userExists) {
      // If user exists and is already verified, prevent registration
      if (userExists.isVerified) {
        return res.status(400).json({ success: false, message: 'User already exists with this email' });
      }

      // If user exists but is NOT verified, update registration details
      userExists.name = name;
      userExists.password = password; // Pre-save hook will hash it
      userExists.role = role || 'student';
      userExists.college = college || '';
      userExists.bio = bio || '';
      userExists.isApproved = (role || 'student') !== 'teacher';
      user = userExists;
    } else {
      // Create new unverified user
      user = new User({
        name,
        email,
        password,
        role: role || 'student',
        college: college || '',
        bio: bio || '',
        isVerified: false,
        isApproved: (role || 'student') !== 'teacher',
      });
    }

    // Generate OTP
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    await user.save();

    // Send verification email
    await sendOTPEmail(user.email, otp, user.name);

    res.status(200).json({
      success: true,
      requiresVerification: true,
      email: user.email,
      message: 'Registration successful! An OTP code has been sent to your email.',
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

    // Check if email is verified
    if (!user.isVerified) {
      // Generate and send a new OTP
      const otp = generateOTP();
      user.otp = otp;
      user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
      await user.save();

      await sendOTPEmail(user.email, otp, user.name);

      return res.status(400).json({
        success: false,
        requiresVerification: true,
        email: user.email,
        message: 'Your email is not verified. A new OTP has been sent to your email.',
      });
    }

    // Check if teacher is approved
    if (user.role === 'teacher' && !user.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your teacher account is pending admin approval. Please contact the administrator.',
      });
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

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Please provide email and OTP code' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isVerified) {
      // If already verified, log them in immediately (unless pending teacher approval)
      if (user.role === 'teacher' && !user.isApproved) {
        return res.status(403).json({
          success: false,
          message: 'Your teacher account is pending admin approval. Please contact the administrator.',
        });
      }
      const token = generateToken(user._id);
      return res.status(200).json({
        success: true,
        message: 'Email is already verified',
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
        }
      });
    }

    // Verify OTP matching and expiry
    if (user.otp !== otp || !user.otpExpiry || user.otpExpiry < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Mark as verified
    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    // If teacher is verified but not approved, do not generate token and return success with status message
    if (user.role === 'teacher' && !user.isApproved) {
      return res.status(200).json({
        success: true,
        requiresApproval: true,
        message: 'Email verified successfully! However, your teacher account is pending admin approval. You will be able to log in once approved.',
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
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

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email address' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
    await user.save();

    // Send email
    await sendOTPEmail(user.email, otp, user.name);

    res.status(200).json({
      success: true,
      message: 'OTP resent successfully to your email',
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

// @desc    Forgot Password - Request OTP
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email address' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email address' });
    }

    // Check if the user is registered via Google OAuth
    if (user.googleId) {
      return res.status(400).json({
        success: false,
        message: 'This account was registered using Google OAuth. Please sign in with Google.',
      });
    }

    // Generate reset OTP
    const otp = generateOTP();
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    await user.save();

    // Send reset OTP email
    await sendForgotPasswordOTPEmail(user.email, otp, user.name);

    res.status(200).json({
      success: true,
      message: 'Password reset OTP has been sent to your email address.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Forgot Password OTP
// @route   POST /api/auth/verify-reset-otp
// @access  Public
export const verifyResetOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Please provide email and OTP code' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify reset OTP matching and expiry
    if (user.resetPasswordOtp !== otp || !user.resetPasswordOtpExpiry || user.resetPasswordOtpExpiry < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset OTP' });
    }

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully. You can now reset your password.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset Password using OTP
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please fill in all fields' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify reset OTP matching and expiry again to ensure secure reset
    if (user.resetPasswordOtp !== otp || !user.resetPasswordOtpExpiry || user.resetPasswordOtpExpiry < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset OTP' });
    }

    // Set new password (the pre-save hook in user model will hash it automatically)
    user.password = newPassword;
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpiry = null;

    // Save changes
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all teachers for admin management
// @route   GET /api/auth/admin/teachers
// @access  Private (Admin)
export const getTeachers = async (req, res, next) => {
  try {
    const teachers = await User.find({ role: 'teacher' }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      teachers,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve/Disapprove a teacher
// @route   PUT /api/auth/admin/teachers/:id/approve
// @access  Private (Admin)
export const approveTeacher = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    if (typeof isApproved !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Please provide isApproved boolean value' });
    }

    const teacher = await User.findOneAndUpdate(
      { _id: id, role: 'teacher' },
      { isApproved },
      { new: true }
    );

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    res.status(200).json({
      success: true,
      message: `Teacher account ${isApproved ? 'approved' : 'disapproved'} successfully`,
      teacher,
    });
  } catch (error) {
    next(error);
  }
};
