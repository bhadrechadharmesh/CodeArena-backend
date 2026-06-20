import Violation from '../models/Violation.js';

// @desc    Log a proctoring violation
// @route   POST /api/violations
// @access  Private
export const logViolation = async (req, res, next) => {
  try {
    const { contestId, quizId, challengeId, violationType, details } = req.body;

    const violation = await Violation.create({
      userId: req.user.id,
      contestId: contestId || null,
      quizId: quizId || null,
      challengeId: challengeId || null,
      violationType,
      details: details || '',
    });

    res.status(201).json({
      success: true,
      violation,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get violations for a user
// @route   GET /api/violations/my
// @access  Private
export const getMyViolations = async (req, res, next) => {
  try {
    const violations = await Violation.find({ userId: req.user.id })
      .populate('contestId', 'title')
      .populate('quizId', 'title')
      .populate('challengeId', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: violations.length,
      violations,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all violations for monitoring (Teachers/Admins)
// @route   GET /api/violations
// @access  Private (Teacher/Admin)
export const getAllViolations = async (req, res, next) => {
  try {
    const violations = await Violation.find()
      .populate('userId', 'name email college')
      .populate('contestId', 'title')
      .populate('quizId', 'title')
      .populate('challengeId', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: violations.length,
      violations,
    });
  } catch (error) {
    next(error);
  }
};
