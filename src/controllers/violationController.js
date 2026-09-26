import Quiz from '../models/Quiz.js';
import Contest from '../models/Contest.js';
import CodingChallenge from '../models/CodingChallenge.js';
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
    let filter = {};
    if (req.user.role === 'teacher') {
      const [quizzes, contests, challenges] = await Promise.all([
        Quiz.find({ creatorId: req.user.id }).select('_id'),
        Contest.find({ creatorId: req.user.id }).select('_id'),
        CodingChallenge.find({ creatorId: req.user.id }).select('_id')
      ]);
      filter = { $or: [{ quizId: { $in: quizzes.map(item => item._id) } }, { contestId: { $in: contests.map(item => item._id) } }, { challengeId: { $in: challenges.map(item => item._id) } }] };
    }
    const violations = await Violation.find(filter)
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
