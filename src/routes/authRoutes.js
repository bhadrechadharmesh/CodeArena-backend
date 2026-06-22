import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { registerUser, loginUser, getMe, logoutUser, verifyOtp, resendOtp } from '../controllers/authController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.post('/logout', protect, logoutUser);

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
