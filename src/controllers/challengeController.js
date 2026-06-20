import CodingChallenge from '../models/CodingChallenge.js';
import User from '../models/User.js';
import { executeSubmission } from '../services/judge.js';

// @desc    Create a coding challenge
// @route   POST /api/challenges
// @access  Private (Teacher/Admin)
export const createChallenge = async (req, res, next) => {
  try {
    const { title, description, difficulty, constraints, examples, testCases, supportedLanguages } = req.body;

    const challenge = await CodingChallenge.create({
      title,
      description,
      difficulty: difficulty || 'medium',
      constraints: constraints || '',
      examples: examples || [],
      testCases: testCases || [],
      supportedLanguages: supportedLanguages || ['cpp', 'java', 'python', 'javascript'],
      creatorId: req.user.id
    });

    res.status(201).json({ success: true, challenge });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all coding challenges
// @route   GET /api/challenges
// @access  Private
export const getChallenges = async (req, res, next) => {
  try {
    // Basic filter
    const challenges = await CodingChallenge.find().select('-testCases').populate('creatorId', 'name email');
    res.status(200).json({ success: true, count: challenges.length, challenges });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single challenge details
// @route   GET /api/challenges/:id
// @access  Private
export const getChallengeById = async (req, res, next) => {
  try {
    let challenge;
    if (req.user.role === 'student') {
      // Exclude hidden test cases from standard fetch
      challenge = await CodingChallenge.findById(req.params.id).select('-testCases');
    } else {
      challenge = await CodingChallenge.findById(req.params.id);
    }

    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }

    res.status(200).json({ success: true, challenge });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit coding challenge solution
// @route   POST /api/challenges/:id/submit
// @access  Private (Student)
export const submitChallenge = async (req, res, next) => {
  try {
    const { code, language } = req.body;
    const challenge = await CodingChallenge.findById(req.params.id);

    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }

    if (!challenge.supportedLanguages.includes(language)) {
      return res.status(400).json({ success: false, message: `Language '${language}' is not supported for this challenge` });
    }

    // Retrieve all test cases for execution
    const testCases = challenge.testCases;
    if (!testCases || testCases.length === 0) {
      return res.status(500).json({ success: false, message: 'No test cases set up for this challenge' });
    }

    // Call compilation & execution service
    const evaluation = await executeSubmission(code, language, testCases);

    if (!evaluation.success) {
      return res.status(500).json({ success: false, message: 'Evaluation failed', error: evaluation.error });
    }

    // Process score and user profile adjustments
    const isAccepted = evaluation.status === 'Accepted';
    let pointsAwarded = 0;

    if (isAccepted) {
      // Points based on difficulty
      pointsAwarded = challenge.difficulty === 'easy' ? 50 : challenge.difficulty === 'medium' ? 100 : 200;

      const user = await User.findById(req.user.id);
      if (user) {
        user.totalPoints += pointsAwarded;
        user.streak += 1;
        await user.save();
      }
    }

    // Format output for student: strip out hidden inputs/outputs in detailed results to prevent cheating!
    const sanitizedResults = evaluation.results?.map((res, index) => {
      const tcModel = challenge.testCases[index];
      const resObj = { ...res };
      if (tcModel && tcModel.isHidden && req.user.role === 'student') {
        // Strip input/expected output for hidden cases
        resObj.input = 'Hidden Test Case';
        resObj.expectedOutput = 'Hidden';
        resObj.output = 'Hidden';
      }
      return resObj;
    });

    res.status(200).json({
      success: true,
      status: evaluation.status,
      error: evaluation.error,
      passedCount: evaluation.passedCount,
      totalCount: evaluation.totalCount,
      results: sanitizedResults,
      pointsAwarded
    });

  } catch (error) {
    next(error);
  }
};
