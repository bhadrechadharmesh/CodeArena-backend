import { gradeQuiz, validQuizSubmission } from '../services/grading.js';
import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import User from '../models/User.js';
import Violation from '../models/Violation.js';
import Contest from '../models/Contest.js';
import { parseFileContent } from '../services/questionParser.js';

// @desc    Create a quiz
// @route   POST /api/quizzes
// @access  Private (Teacher/Admin)
export const createQuiz = async (req, res, next) => {
  try {
    const { title, description, category, difficulty, duration, tags, questions, totalMarks, isPublished } = req.body;

    const quiz = await Quiz.create({
      title,
      description,
      category,
      difficulty: difficulty || 'medium',
      creatorId: req.user.id,
      duration,
      tags: tags || [],
      totalMarks,
      questions: questions || [],
      isPublished: isPublished !== undefined ? isPublished : false
    });

    res.status(201).json({ success: true, quiz });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all quizzes
// @route   GET /api/quizzes
// @access  Private
export const getQuizzes = async (req, res, next) => {
  try {
    let query = {};

    // Students only see published quizzes
    if (req.user.role === 'student') {
      query.isPublished = true;
    } else if (req.user.role === 'teacher') {
      // Teachers see quizzes they created, or all if preferred. Let's show quizzes they created.
      query.creatorId = req.user.id;
    }

    const quizzes = await Quiz.find(query).populate('creatorId', 'name email');

    // Security: If student, strip correct answers from the list payload (although list doesn't have questions usually, just in case)
    const sanitizedQuizzes = quizzes.map((quiz) => {
      const quizObj = quiz.toObject();
      if (req.user.role === 'student') {
        quizObj.questions = quizObj.questions?.map((q) => {
          delete q.correctOption;
          delete q.correctAnswers;
          delete q.answer;
          delete q.correctAnswerText;
          delete q.explanation;
          return q;
        });
      }
      return quizObj;
    });

    res.status(200).json({ success: true, count: sanitizedQuizzes.length, quizzes: sanitizedQuizzes });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single quiz
// @route   GET /api/quizzes/:id
// @access  Private
export const getQuizById = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id).populate('creatorId', 'name email');
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (req.user.role === 'student' && !quiz.isPublished) {
      const session = await Contest.exists({ quizzes: quiz._id, participants: req.user.id, startTime: { $lte: new Date() }, endTime: { $gt: new Date() } });
      if (!session) return res.status(403).json({ success: false, message: 'Quiz is not available' });
    }

    const quizObj = quiz.toObject();

    // Security: Strip out answers for students during attempts
    if (req.user.role === 'student') {
      quizObj.questions = quizObj.questions.map((q) => {
        delete q.correctOption;
        delete q.correctAnswers;
        delete q.answer;
        delete q.correctAnswerText;
        delete q.explanation;
        return q;
      });
    }

    res.status(200).json({ success: true, quiz: quizObj });
  } catch (error) {
    next(error);
  }
};

// @desc    Update quiz
// @route   PUT /api/quizzes/:id
// @access  Private (Teacher/Admin)
export const updateQuiz = async (req, res, next) => {
  try {
    let quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Verify ownership
    if (quiz.creatorId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this quiz' });
    }

    const fields = ['title', 'description', 'category', 'difficulty', 'duration', 'tags', 'questions', 'totalMarks', 'isPublished'];
    const changes = Object.fromEntries(fields.filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]));
    quiz = await Quiz.findByIdAndUpdate(req.params.id, { $set: changes }, {
      new: true,
      runValidators: true
    });

    res.status(200).json({ success: true, quiz });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete quiz
// @route   DELETE /api/quizzes/:id
// @access  Private (Teacher/Admin)
export const deleteQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Verify ownership
    if (quiz.creatorId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this quiz' });
    }

    // Delete associated quiz attempts
    await QuizAttempt.deleteMany({ quizId: quiz._id });

    // Delete associated violations
    await Violation.deleteMany({ quizId: quiz._id });

    // Remove quiz from contests and contest leaderboards
    await Contest.updateMany(
      { quizzes: quiz._id },
      { $pull: { quizzes: quiz._id } }
    );
    await Contest.updateMany(
      { 'leaderboard.completedQuizzes': quiz._id },
      { $pull: { 'leaderboard.$[].completedQuizzes': quiz._id } }
    );

    await quiz.deleteOne();
    res.status(200).json({ success: true, message: 'Quiz deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit a quiz attempt
// @route   POST /api/quizzes/:id/attempt
// @access  Private (Student)
export const attemptQuiz = async (req, res, next) => {
  try {
    const { answers, timeTaken } = req.body; // Array of { questionId, selectedOption, selectedOptions, booleanAnswer, textAnswer }
    if (!validQuizSubmission(answers, timeTaken)) return res.status(400).json({ success: false, message: 'Invalid answers or time taken' });
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (!quiz.isPublished) return res.status(403).json({ success: false, message: 'Quiz is not published' });

    // Check if already attempted
    const existingAttempt = await QuizAttempt.findOne({ userId: req.user.id, quizId: quiz._id });
    if (existingAttempt) {
      return res.status(400).json({ success: false, message: 'You have already attempted this quiz.' });
    }

    const { gradedAnswers, correctCount, totalQuestions, accuracy, score } = gradeQuiz(quiz, answers);

    // Save attempt
    const attempt = await QuizAttempt.create({
      userId: req.user.id,
      quizId: quiz._id,
      answers: gradedAnswers,
      score,
      accuracy,
      timeTaken
    });

    await User.updateOne({ _id: req.user.id }, { $inc: { quizzesAttempted: 1, totalPoints: score, streak: 1 } });

    res.status(201).json({
      success: true,
      attempt: {
        id: attempt._id,
        score,
        accuracy,
        timeTaken,
        correctCount,
        totalQuestions,
        submittedAt: attempt.submittedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all attempts for a user
// @route   GET /api/quizzes/attempts/my
// @access  Private (Student)
export const getMyQuizAttempts = async (req, res, next) => {
  try {
    const attempts = await QuizAttempt.find({ userId: req.user.id })
      .populate('quizId', 'title category difficulty totalMarks')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: attempts.length, attempts });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single attempt review with full explanation details
// @route   GET /api/quizzes/attempts/:id
// @access  Private
export const getQuizAttemptById = async (req, res, next) => {
  try {
    const attempt = await QuizAttempt.findById(req.params.id)
      .populate('quizId')
      .populate('userId', 'name email');

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Quiz attempt not found' });
    }

    // Verify access
    if (attempt.userId?._id.toString() !== req.user.id && req.user.role !== 'admin' && !(req.user.role === 'teacher' && attempt.quizId?.creatorId?.toString() === req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this attempt' });
    }

    res.status(200).json({ success: true, attempt });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all attempts for a specific quiz
// @route   GET /api/quizzes/:id/attempts
// @access  Private (Teacher/Admin)
export const getQuizAttempts = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Verify ownership
    if (quiz.creatorId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view attempts for this quiz' });
    }

    const attempts = await QuizAttempt.find({ quizId: req.params.id })
      .populate('userId', 'name email college')
      .sort({ score: -1, timeTaken: 1 });

    res.status(200).json({ success: true, count: attempts.length, attempts });
  } catch (error) {
    next(error);
  }
};

// @desc    Import quiz questions from PDF or TXT
// @route   POST /api/quizzes/import
// @access  Private (Teacher/Admin)
export const importQuizQuestions = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }

    const parsedQuestions = await parseFileContent(req.file.buffer, req.file.mimetype);

    res.status(200).json({
      success: true,
      count: parsedQuestions.length,
      questions: parsedQuestions
    });
  } catch (error) {
    next(error);
  }
};

