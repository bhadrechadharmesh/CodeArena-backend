import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Quiz from '../models/Quiz.js';
import CodingChallenge from '../models/CodingChallenge.js';
import Contest from '../models/Contest.js';
import QuizAttempt from '../models/QuizAttempt.js';
import ChallengeAttempt from '../models/ChallengeAttempt.js';
import { connectDB, disconnectDB } from './db.js';

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();

    // Clear existing data
    console.log('Clearing database collection data...');
    await User.deleteMany();
    await Quiz.deleteMany();
    await CodingChallenge.deleteMany();
    await Contest.deleteMany();
    await QuizAttempt.deleteMany();
    await ChallengeAttempt.deleteMany();

    console.log('Seeding default users...');
    // 1. Create Users
    const admin = await User.create({
      name: 'CodeArena Admin',
      email: 'admin@codearena.com',
      password: 'password123',
      role: 'admin',
      college: 'CodeArena Tech',
      bio: 'Platform System Administrator',
      isVerified: true
    });

    const teacher = await User.create({
      name: 'Professor Jarvis',
      email: 'teacher@codearena.com',
      password: 'password123',
      role: 'teacher',
      college: 'Stark Academy',
      bio: 'Computer Science Professor',
      isVerified: true
    });

    const student = await User.create({
      name: 'Tony Stark',
      email: 'student@codearena.com',
      password: 'password123',
      role: 'student',
      college: 'MIT',
      bio: 'Junior Developer & Iron Man enthusiast',
      totalPoints: 250,
      streak: 5,
      contestsParticipated: 2,
      quizzesAttempted: 3,
      isVerified: true
    });

    console.log('Seeding default quizzes...');
    // 2. Create Quizzes
    const quiz1 = await Quiz.create({
      title: 'Data Structures Quick Test',
      description: 'Test your understanding of Stacks, Queues, Lists, and Binary Search Trees.',
      category: 'Data Structures',
      difficulty: 'easy',
      creatorId: teacher._id,
      duration: 10,
      tags: ['DSA', 'Beginner', 'Theory'],
      totalMarks: 40,
      isPublished: true,
      questions: [
        {
          questionType: 'mcq',
          questionText: 'Which data structure works on the LIFO (Last In First Out) principle?',
          options: ['Queue', 'Stack', 'Linked List', 'Tree'],
          correctOption: 1,
          explanation: 'Stacks push and pop elements from the same end, making the last inserted element the first one to be removed.',
          topic: 'Stack',
          difficulty: 'easy'
        },
        {
          questionType: 'true_false',
          questionText: 'Binary Search Tree lookup takes O(log N) average time complexity.',
          answer: true,
          explanation: 'On average, BST lookups split search space in half, resulting in logarithmic time complexity.',
          topic: 'Trees',
          difficulty: 'easy'
        },
        {
          questionType: 'multiple_correct',
          questionText: 'Which of the following are linear data structures?',
          options: ['Queue', 'Graph', 'Linked List', 'Tree'],
          correctAnswers: [0, 2],
          explanation: 'Queues and Linked Lists represent data sequentially in memory or dynamically in linear order, unlike trees and graphs which are non-linear.',
          topic: 'General DSA',
          difficulty: 'medium'
        },
        {
          questionType: 'fill_blank',
          questionText: 'The time complexity of inserting a node at the head of a doubly linked list is O(____).',
          correctAnswerText: '1',
          explanation: 'Inserting at head only requires updating pointers, which takes constant time O(1).',
          topic: 'Linked List',
          difficulty: 'easy'
        }
      ]
    });

    const quiz2 = await Quiz.create({
      title: 'JavaScript Core Concepts',
      description: 'Evaluate your knowledge of closures, event loop, and asynchronous behavior.',
      category: 'Web Development',
      difficulty: 'medium',
      creatorId: teacher._id,
      duration: 15,
      tags: ['JS', 'Frontend', 'Intermediate'],
      totalMarks: 30,
      isPublished: true,
      questions: [
        {
          questionType: 'mcq',
          questionText: 'What is the output of console.log(typeof null) in JavaScript?',
          options: ['"null"', '"undefined"', '"object"', '"boolean"'],
          correctOption: 2,
          explanation: 'In JavaScript, typeof null is historical bug returning "object".',
          topic: 'Fundamentals',
          difficulty: 'medium'
        },
        {
          questionType: 'true_false',
          questionText: 'JavaScript is a multi-threaded programming language by default.',
          answer: false,
          explanation: 'JavaScript is single-threaded, using an event loop to execute asynchronous tasks.',
          topic: 'Event Loop',
          difficulty: 'easy'
        }
      ]
    });

    console.log('Seeding default coding challenges...');
    // 3. Create Coding Challenges
    const challenge1 = await CodingChallenge.create({
      title: 'Reverse String',
      description: `### Problem Description\nWrite a function that reverses an input string. You receive the string as input and must return the reversed string.\n\n### Constraints\n* String length <= 1000\n\n### Example\n* Input: \`hello\`\n* Output: \`olleh\``,
      difficulty: 'easy',
      constraints: 'Time Limit: 2s, Memory: 256MB',
      supportedLanguages: ['cpp', 'java', 'python', 'javascript'],
      creatorId: teacher._id,
      examples: [
        { input: 'hello', output: 'olleh', explanation: 'Reverse of hello is olleh' }
      ],
      testCases: [
        { input: 'hello', expectedOutput: 'olleh', isHidden: false },
        { input: 'CodeArena', expectedOutput: 'anerAedoC', isHidden: false },
        { input: 'a', expectedOutput: 'a', isHidden: true },
        { input: 'radar', expectedOutput: 'radar', isHidden: true }
      ]
    });

    const challenge2 = await CodingChallenge.create({
      title: 'Sum of Array',
      description: `### Problem Description\nGiven an array of space-separated integers, calculate their total sum and print it.\n\n### Constraints\n* Array size <= 100\n\n### Example\n* Input: \`1 2 3 4\`\n* Output: \`10\``,
      difficulty: 'easy',
      constraints: 'Time Limit: 1s, Memory: 128MB',
      supportedLanguages: ['cpp', 'java', 'python', 'javascript'],
      creatorId: teacher._id,
      examples: [
        { input: '1 2 3 4', output: '10', explanation: '1+2+3+4 = 10' }
      ],
      testCases: [
        { input: '1 2 3 4', expectedOutput: '10', isHidden: false },
        { input: '5 5 10', expectedOutput: '20', isHidden: false },
        { input: '-1 1 5', expectedOutput: '5', isHidden: true }
      ]
    });

    // Create Contest
    const now = new Date();
    const startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // Started 2 hours ago
    const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Ends tomorrow

    await Contest.create({
      title: 'Summer Coding Championship 2026',
      startTime,
      endTime,
      contestType: 'hybrid',
      codingChallenges: [challenge1._id, challenge2._id],
      quizzes: [quiz1._id],
      creatorId: teacher._id,
      participants: [student._id],
      leaderboard: [
        {
          userId: student._id,
          score: 150,
          penaltyTime: 45,
          submissionsCount: 2,
          solvedChallenges: [challenge1._id],
          completedQuizzes: []
        }
      ]
    });

    console.log('Seeding student attempts...');
    // Create Quiz Attempt
    await QuizAttempt.create({
      userId: student._id,
      quizId: quiz1._id,
      answers: [
        {
          questionId: quiz1.questions[0]._id,
          selectedOption: 1,
          isCorrect: true
        },
        {
          questionId: quiz1.questions[1]._id,
          booleanAnswer: true,
          isCorrect: true
        },
        {
          questionId: quiz1.questions[2]._id,
          selectedOptions: [0, 2],
          isCorrect: true
        },
        {
          questionId: quiz1.questions[3]._id,
          textAnswer: '1',
          isCorrect: true
        }
      ],
      score: 40,
      accuracy: 100,
      timeTaken: 180,
      submittedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000)
    });

    // Create Coding Challenge Attempt
    await ChallengeAttempt.create({
      userId: student._id,
      challengeId: challenge1._id,
      code: `def reverse_string(s):\n    return s[::-1]\n\n# Read input\nimport sys\nfor line in sys.stdin:\n    print(reverse_string(line.strip()))`,
      language: 'python',
      status: 'Accepted',
      passedCount: 4,
      totalCount: 4,
      pointsAwarded: 50,
      submittedAt: new Date(now.getTime() - 1.5 * 60 * 60 * 1000)
    });

    console.log('Seeding completed successfully!');
    await disconnectDB();
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exit(1);
  }
};

// Check if run directly
if (process.argv[1] === import.meta.filename || process.argv[1]?.endsWith('seed.js')) {
  seedData();
}

export default seedData;
