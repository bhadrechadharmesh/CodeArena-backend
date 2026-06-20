import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import { configurePassport } from './config/passport.js';
import { errorHandler } from './middlewares/error.js';
import { apiLimiter, sanitizeInputs } from './middlewares/security.js';

// Route files
import authRoutes from './routes/authRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import challengeRoutes from './routes/challengeRoutes.js';
import contestRoutes from './routes/contestRoutes.js';
import violationRoutes from './routes/violationRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';

const app = express();

// Set security headers
app.use(helmet());

// Enable CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting & XSS Sanitizer
app.use('/api/', apiLimiter);
app.use(sanitizeInputs);

// Initialize Passport Google OAuth
configurePassport();
app.use(passport.initialize());

// Setup a simple route to verify API status
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'CodeArena API is running healthy.' });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/violations', violationRoutes);
app.use('/api/analytics', analyticsRoutes);

// Error Handler Middleware
app.use(errorHandler);

export default app;
