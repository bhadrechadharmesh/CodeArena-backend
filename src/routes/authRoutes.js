import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { registerUser, loginUser, getMe, logoutUser, verifyOtp, resendOtp, forgotPassword, verifyResetOtp, resetPassword, getTeachers, approveTeacher } from '../controllers/authController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.post('/logout', protect, logoutUser);

// Admin teacher management routes
router.get('/admin/teachers', protect, authorize('admin'), getTeachers);
router.put('/admin/teachers/:id/approve', protect, authorize('admin'), approveTeacher);

// Google OAuth initiating route
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// Google OAuth callback route
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  (req, res) => {
    // Check if the user is a teacher and is not approved
    if (req.user.role === 'teacher' && !req.user.isApproved) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/login?error=pending_approval`);
    }

    // Generate JWT token for Google authenticated user
    const token = jwt.sign(
      { id: req.user._id },
      process.env.JWT_SECRET || 'fallback_secret_key_123',
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );

    // Redirect to frontend app dashboard with JWT token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/oauth-callback?token=${token}`);
  }
);

export default router;
