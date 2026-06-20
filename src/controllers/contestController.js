import Contest from '../models/Contest.js';
import CodingChallenge from '../models/CodingChallenge.js';
import Quiz from '../models/Quiz.js';
import User from '../models/User.js';
import { executeSubmission } from '../services/judge.js';
import { sendLeaderboardUpdate } from '../sockets/contestSocket.js';

// @desc    Create/Schedule a contest
// @route   POST /api/contests
// @access  Private (Teacher/Admin)
export const createContest = async (req, res, next) => {
  try {
    const { title, startTime, endTime, contestType, codingChallenges, quizzes } = req.body;

    const contest = await Contest.create({
      title,
      startTime,
      endTime,
      contestType: contestType || 'coding',
      codingChallenges: codingChallenges || [],
      quizzes: quizzes || [],
      creatorId: req.user.id
    });

    res.status(201).json({ success: true, contest });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all contests
// @route   GET /api/contests
// @access  Private
export const getContests = async (req, res, next) => {
  try {
    const contests = await Contest.find()
      .populate('creatorId', 'name email')
      .sort({ startTime: 1 });

    res.status(200).json({ success: true, count: contests.length, contests });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single contest
// @route   GET /api/contests/:id
// @access  Private
export const getContestById = async (req, res, next) => {
  try {
    const contest = await Contest.findById(req.params.id)
      .populate('codingChallenges', 'title description difficulty constraints examples')
      .populate('quizzes', 'title description category difficulty duration totalMarks')
      .populate('participants', 'name email college')
      .populate('leaderboard.userId', 'name email college totalPoints');

    if (!contest) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }

    res.status(200).json({ success: true, contest });
  } catch (error) {
    next(error);
  }
};

// @desc    Join a contest
// @route   POST /api/contests/:id/join
// @access  Private (Student)
export const joinContest = async (req, res, next) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }

    // Add to participants list
    if (!contest.participants.includes(req.user.id)) {
      contest.participants.push(req.user.id);
      
      // Initialize leaderboard entry if not exists
      const existingEntry = contest.leaderboard.find(
        (entry) => entry.userId.toString() === req.user.id.toString()
      );

      if (!existingEntry) {
        contest.leaderboard.push({
          userId: req.user.id,
          score: 0,
          penaltyTime: 0,
          submissionsCount: 0,
          solvedChallenges: [],
          completedQuizzes: []
        });
      }

      await contest.save();

      // Trigger socket leaderboard update
      if (req.io) {
        await sendLeaderboardUpdate(req.io, contest._id);
      }
    }

    // Update user stats
    const user = await User.findById(req.user.id);
    if (user) {
      user.contestsParticipated += 1;
      await user.save();
    }

    res.status(200).json({ success: true, message: 'Joined contest successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit coding challenge inside a contest
// @route   POST /api/contests/:id/submit-challenge/:challengeId
// @access  Private (Student)
export const submitContestChallenge = async (req, res, next) => {
  try {
    const { code, language } = req.body;
    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }

    const now = new Date();
    if (now < new Date(contest.startTime) || now > new Date(contest.endTime)) {
      return res.status(400).json({ success: false, message: 'Contest is not active' });
    }

    const challenge = await CodingChallenge.findById(req.params.challengeId);
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }

    // Process code
    const evaluation = await executeSubmission(code, language, challenge.testCases);

    if (!evaluation.success) {
      return res.status(500).json({ success: false, message: 'Evaluation failed', error: evaluation.error });
    }

    const isAccepted = evaluation.status === 'Accepted';

    // Find user's leaderboard entry
    let entry = contest.leaderboard.find(
      (e) => e.userId.toString() === req.user.id.toString()
    );

    if (!entry) {
      contest.leaderboard.push({
        userId: req.user.id,
        score: 0,
        penaltyTime: 0,
        submissionsCount: 0,
        solvedChallenges: [],
        completedQuizzes: []
      });
      entry = contest.leaderboard[contest.leaderboard.length - 1];
    }

    // Increment submissions count
    entry.submissionsCount += 1;

    let pointsAwarded = 0;
    if (isAccepted && !entry.solvedChallenges.includes(challenge._id)) {
      entry.solvedChallenges.push(challenge._id);
      
      // Calculate penalty: minutes elapsed since contest start + 20 mins per wrong submission
      const minutesElapsed = Math.floor((now - new Date(contest.startTime)) / 60000);
      const wrongSubmissions = entry.submissionsCount - 1; // subtract the current accepted submission
      const penalty = minutesElapsed + (wrongSubmissions * 20);

      // Score weight by difficulty
      const challengeScore = challenge.difficulty === 'easy' ? 50 : challenge.difficulty === 'medium' ? 100 : 200;

      entry.score += challengeScore;
      entry.penaltyTime += penalty;
      pointsAwarded = challengeScore;

      // Add points to user profile
      const user = await User.findById(req.user.id);
      if (user) {
        user.totalPoints += challengeScore;
        await user.save();
      }
    }

    await contest.save();

    // Broadcast WebSocket updates
    if (req.io) {
      await sendLeaderboardUpdate(req.io, contest._id);
    }

    // Format output
    const sanitizedResults = evaluation.results?.map((res, index) => {
      const tcModel = challenge.testCases[index];
      const resObj = { ...res };
      if (tcModel && tcModel.isHidden && req.user.role === 'student') {
        resObj.input = 'Hidden Test Case';
        resObj.expectedOutput = 'Hidden';
        resObj.output = 'Hidden';
      }
      return resObj;
    });

    res.status(200).json({
      success: true,
      status: evaluation.status,
      passedCount: evaluation.passedCount,
      totalCount: evaluation.totalCount,
      results: sanitizedResults,
      pointsAwarded
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete/Cancel a contest
// @route   DELETE /api/contests/:id
// @access  Private (Teacher/Admin)
export const deleteContest = async (req, res, next) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }

    // Check if user is the creator or an admin
    if (contest.creatorId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this contest' });
    }

    await contest.deleteOne();

    res.status(200).json({ success: true, message: 'Contest cancelled successfully' });
  } catch (error) {
    next(error);
  }
};

