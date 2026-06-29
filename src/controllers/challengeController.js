import CodingChallenge from '../models/CodingChallenge.js';
import User from '../models/User.js';
import ChallengeAttempt from '../models/ChallengeAttempt.js';
import { executeSubmission } from '../services/judge.js';

// @desc    Create a coding challenge
// @route   POST /api/challenges
// @access  Private (Teacher/Admin)
export const createChallenge = async (req, res, next) => {
  try {
    const { title, description, difficulty, constraints, examples, testCases, supportedLanguages, boilerplateCode, sampleCode } = req.body;

    const challenge = await CodingChallenge.create({
      title,
      description,
      difficulty: difficulty || 'medium',
      constraints: constraints || '',
      examples: examples || [],
      testCases: testCases || [],
      supportedLanguages: supportedLanguages || ['cpp', 'java', 'python', 'javascript'],
      boilerplateCode: boilerplateCode || {},
      sampleCode: sampleCode || {},
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
    const { code, language, runOnly } = req.body;
    const challenge = await CodingChallenge.findById(req.params.id);

    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }

    if (!runOnly) {
      // Check if already attempted
      const existingAttempt = await ChallengeAttempt.findOne({ userId: req.user.id, challengeId: challenge._id });
      if (existingAttempt) {
        return res.status(400).json({ success: false, message: 'You have already attempted this challenge.' });
      }
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
    const boilerplate = challenge.boilerplateCode?.[language] || '';
    const evaluation = await executeSubmission(code, language, testCases, boilerplate);

    if (!evaluation.success) {
      return res.status(500).json({ success: false, message: 'Evaluation failed', error: evaluation.error });
    }

    // Process score and user profile adjustments
    const isAccepted = evaluation.status === 'Accepted';
    let pointsAwarded = 0;

    if (!runOnly && isAccepted) {
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

    if (!runOnly) {
      // Save challenge attempt
      await ChallengeAttempt.create({
        userId: req.user.id,
        challengeId: challenge._id,
        code,
        language,
        status: evaluation.status,
        passedCount: evaluation.passedCount,
        totalCount: evaluation.totalCount,
        pointsAwarded
      });
    }

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

// @desc    Delete a coding challenge
// @route   DELETE /api/challenges/:id
// @access  Private (Teacher/Admin)
export const deleteChallenge = async (req, res, next) => {
  try {
    const challenge = await CodingChallenge.findById(req.params.id);
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }

    // Verify ownership or admin role
    if (challenge.creatorId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this challenge' });
    }

    await challenge.deleteOne();
    res.status(200).json({ success: true, message: 'Challenge deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all attempts for a specific challenge
// @route   GET /api/challenges/:id/attempts
// @access  Private (Teacher/Admin)
export const getChallengeAttempts = async (req, res, next) => {
  try {
    const challenge = await CodingChallenge.findById(req.params.id);
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }

    // Verify ownership
    if (challenge.creatorId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view attempts for this challenge' });
    }

    const attempts = await ChallengeAttempt.find({ challengeId: req.params.id })
      .populate('userId', 'name email college')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: attempts.length, attempts });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all attempts for the current user
// @route   GET /api/challenges/attempts/my
// @access  Private
export const getMyChallengeAttempts = async (req, res, next) => {
  try {
    const attempts = await ChallengeAttempt.find({ userId: req.user.id })
      .populate('challengeId', 'title difficulty')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: attempts.length, attempts });
  } catch (error) {
    next(error);
  }
};



