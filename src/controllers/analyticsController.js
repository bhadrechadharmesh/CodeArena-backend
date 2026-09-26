import QuizAttempt from '../models/QuizAttempt.js';
import User from '../models/User.js';
import Quiz from '../models/Quiz.js';
import Contest from '../models/Contest.js';
import Violation from '../models/Violation.js';

// @desc    Get student analytics
// @route   GET /api/analytics/student
// @access  Private (Student)
export const getStudentAnalytics = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Aggregates for user attempts
    const attempts = await QuizAttempt.find({ userId }).populate('quizId');

    const totalQuizzes = attempts.length;
    let avgScore = 0;
    let avgAccuracy = 0;
    let totalTimeSpent = 0;

    if (totalQuizzes > 0) {
      const sumScore = attempts.reduce((acc, curr) => acc + curr.score, 0);
      const sumAccuracy = attempts.reduce((acc, curr) => acc + curr.accuracy, 0);
      const sumTime = attempts.reduce((acc, curr) => acc + curr.timeTaken, 0);

      avgScore = Math.round(sumScore / totalQuizzes);
      avgAccuracy = Math.round(sumAccuracy / totalQuizzes);
      totalTimeSpent = sumTime;
    }

    const weeklyProgress = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(); day.setUTCHours(0, 0, 0, 0); day.setUTCDate(day.getUTCDate() - 6 + index);
      const next = new Date(day); next.setUTCDate(next.getUTCDate() + 1);
      const daily = attempts.filter(attempt => attempt.submittedAt >= day && attempt.submittedAt < next);
      return { name: day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }), score: daily.length ? Math.round(daily.reduce((sum, attempt) => sum + attempt.score, 0) / daily.length) : 0 };
    });
    const subjects = new Map();
    attempts.forEach(attempt => {
      const name = attempt.quizId?.category || 'General';
      const group = subjects.get(name) || { total: 0, count: 0 };
      group.total += attempt.accuracy; group.count++; subjects.set(name, group);
    });
    const topicPerformance = [...subjects].map(([subject, group]) => ({ subject, A: Math.round(group.total / group.count), fullMark: 100 }));

    res.status(200).json({
      success: true,
      metrics: {
        totalQuizzes,
        avgScore,
        accuracy: avgAccuracy,
        timeSpent: totalTimeSpent,
        points: req.user.totalPoints,
        streak: req.user.streak,
        contestsParticipated: req.user.contestsParticipated
      },
      weeklyProgress,
      topicPerformance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get teacher analytics
// @route   GET /api/analytics/teacher
// @access  Private (Teacher/Admin)
export const getTeacherAnalytics = async (req, res, next) => {
  try {
    const teacherId = req.user._id;

    // Get quizzes created by teacher
    const quizzes = await Quiz.find({ creatorId: teacherId });
    const quizIds = quizzes.map(q => q._id);

    const attemptsCount = await QuizAttempt.countDocuments({ quizId: { $in: quizIds } });

    // Average score of teacher's quizzes
    const attemptsStats = await QuizAttempt.aggregate([
      { $match: { quizId: { $in: quizIds } } },
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$score' },
          avgAccuracy: { $avg: '$accuracy' }
        }
      }
    ]);

    const avgScore = attemptsStats.length > 0 ? Math.round(attemptsStats[0].avgScore) : 0;
    const avgAccuracy = attemptsStats.length > 0 ? Math.round(attemptsStats[0].avgAccuracy) : 0;

    // Top performers (dummy list or fetched)
    const participantIds = await QuizAttempt.distinct('userId', { quizId: { $in: quizIds } });
    const topPerformers = await User.find({ role: 'student', _id: { $in: participantIds } })
      .sort({ totalPoints: -1 })
      .limit(5)
      .select('name email college totalPoints');

    // Difficulty distribution
    const difficultyData = [
      { name: 'Easy', value: quizzes.filter(q => q.difficulty === 'easy').length },
      { name: 'Medium', value: quizzes.filter(q => q.difficulty === 'medium').length },
      { name: 'Hard', value: quizzes.filter(q => q.difficulty === 'hard').length }
    ];

    res.status(200).json({
      success: true,
      metrics: {
        totalQuizzesCreated: quizzes.length,
        totalAttempts: attemptsCount,
        averageClassScore: avgScore,
        averageClassAccuracy: avgAccuracy
      },
      difficultyDistribution: difficultyData,
      topPerformers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get admin platform analytics
// @route   GET /api/analytics/admin
// @access  Private (Admin)
export const getAdminAnalytics = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ contestsParticipated: { $gt: 0 } });
    const totalQuizzes = await Quiz.countDocuments();
    const totalContests = await Contest.countDocuments();
    const totalViolations = await Violation.countDocuments();

    const roleDistribution = [
      { name: 'Students', value: await User.countDocuments({ role: 'student' }) },
      { name: 'Teachers', value: await User.countDocuments({ role: 'teacher' }) },
      { name: 'Admins', value: await User.countDocuments({ role: 'admin' }) }
    ];

    const now = new Date();
    const firstMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const registrations = await User.aggregate([
      { $match: { createdAt: { $gte: firstMonth, $lte: now } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' } }, users: { $sum: 1 } } }
    ]);
    const counts = new Map(registrations.map(row => [row._id, row.users]));
    const growthData = Array.from({ length: 6 }, (_, index) => {
      const month = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + index, 1));
      return {
        month: month.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
        users: counts.get(month.toISOString().slice(0, 7)) || 0
      };
    });

    res.status(200).json({
      success: true,
      metrics: {
        totalUsers,
        activeUsers,
        totalQuizzes,
        totalContests,
        totalViolations
      },
      roleDistribution,
      growthData
    });
  } catch (error) {
    next(error);
  }
};

// Global rankings use the same cumulative points awarded by quiz and contest submissions.
export const getLeaderboard = async (req, res, next) => {
  try {
    const students = await User.find({ role: 'student', isVerified: true })
      .select('_id name college totalPoints streak')
      .sort({ totalPoints: -1, _id: 1 })
      .lean();
    let rank = 0;
    let previousPoints;
    const users = students.map((student, index) => {
      const points = student.totalPoints ?? 0;
      if (index === 0 || points !== previousPoints) rank = index + 1;
      previousPoints = points;
      return {
        _id: student._id,
        name: student.name || 'Unnamed student',
        college: student.college || '',
        totalPoints: points,
        streak: student.streak ?? 0,
        rank,
      };
    });
    res.status(200).json({ success: true, users });
  } catch (error) {
    next(error);
  }
};
