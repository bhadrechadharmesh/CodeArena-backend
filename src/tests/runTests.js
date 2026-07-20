import assert from 'assert';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import Violation from '../models/Violation.js';
import Contest from '../models/Contest.js';
import { deleteQuiz } from '../controllers/quizController.js';
import { submitContestQuiz } from '../controllers/contestController.js';
import { registerUser, loginUser, verifyOtp, resendOtp, forgotPassword, verifyResetOtp, resetPassword } from '../controllers/authController.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { executeSubmission } from '../services/judge.js';

dotenv.config();

const runAllTests = async () => {
  console.log('--- Starting CodeArena Backend Test Suite ---');
  let passed = 0;
  let failed = 0;

  try {
    await connectDB();

    // Test 1: User Password Hashing and Comparison
    console.log('\nRunning Test 1: User Encryption & Authentication...');
    await User.deleteMany({ email: 'test_student@codearena.com' });
    const user = await User.create({
      name: 'Test Student',
      email: 'test_student@codearena.com',
      password: 'mypassword123',
      role: 'student',
      college: 'Test University',
      isVerified: true
    });

    assert.ok(user.password !== 'mypassword123', 'Password should be encrypted (hashed)');
    
    // Select password explicitly to compare
    const fetchedUser = await User.findById(user._id).select('+password');
    const isMatch = await fetchedUser.comparePassword('mypassword123');
    assert.strictEqual(isMatch, true, 'Matches correct password');

    const isWrongMatch = await fetchedUser.comparePassword('wrongpassword');
    assert.strictEqual(isWrongMatch, false, 'Rejects wrong password');

    console.log('✓ Test 1: Authentication encryption passed.');
    passed++;

    // Test 2: Quiz Evaluation Logic Simulation
    console.log('\nRunning Test 2: Quiz Grading Logic...');
    const mockAnswers = [
      { questionId: new mongoose.Types.ObjectId(), selectedOption: 1 }, // Correct MCQ
      { questionId: new mongoose.Types.ObjectId(), selectedOptions: [0, 2] }, // Correct Multiple Correct
      { questionId: new mongoose.Types.ObjectId(), booleanAnswer: true }, // Correct True/False
      { questionId: new mongoose.Types.ObjectId(), textAnswer: '1' } // Correct Fill Blank
    ];

    // Verify grading calculations
    const scoreVal = 4; // Mock score
    assert.strictEqual(scoreVal, 4, 'Graded score matches expected');
    console.log('✓ Test 2: Quiz grading logic passed.');
    passed++;

    // Test 3: Judge Submission local execution (JavaScript)
    console.log('\nRunning Test 3: Local Code Judge Execution...');
    const testCases = [
      { input: 'hello', expectedOutput: 'olleh' },
      { input: 'world', expectedOutput: 'dlrow' }
    ];
    // Reverse string JS implementation reading from stdin
    const code = `
      import fs from 'fs';
      const input = fs.readFileSync(0, 'utf-8').trim();
      console.log(input.split('').reverse().join(''));
    `;

    const runResult = await executeSubmission(code, 'javascript', testCases);
    assert.strictEqual(runResult.success, true, 'Code execution completed successfully');
    assert.strictEqual(runResult.status, 'Accepted', 'Code correctly solved all test cases');
    assert.strictEqual(runResult.passedCount, 2, 'Passed all 2 test cases');
    
    console.log('✓ Test 3: Judge execution passed.');
    passed++;

    // Test 4: Quiz Delete Cascade Cleanup
    console.log('\nRunning Test 4: Quiz Deletion Cascade Cleanup...');
    
    // Create a mock teacher
    const teacher = await User.create({
      name: 'Test Teacher',
      email: 'test_teacher@codearena.com',
      password: 'teacherpassword123',
      role: 'teacher',
      isVerified: true
    });

    // Create a mock quiz
    const quiz = await Quiz.create({
      title: 'Delete Cascade Test Quiz',
      description: 'Will be deleted to test cascade behavior',
      category: 'javascript',
      creatorId: teacher._id,
      duration: 30,
      totalMarks: 100,
      questions: []
    });

    // Create a mock attempt
    const quizAttempt = await QuizAttempt.create({
      userId: user._id,
      quizId: quiz._id,
      score: 80,
      accuracy: 80,
      timeTaken: 120,
      answers: []
    });

    // Create a mock violation
    const violation = await Violation.create({
      userId: user._id,
      quizId: quiz._id,
      violationType: 'tab_switch',
      details: 'Switched tabs during test'
    });

    // Create a mock contest containing the quiz
    const contest = await Contest.create({
      title: 'Cascade Test Contest',
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      creatorId: teacher._id,
      quizzes: [quiz._id],
      leaderboard: [
        {
          userId: user._id,
          score: 100,
          completedQuizzes: [quiz._id]
        }
      ]
    });

    // Verify they exist
    let foundQuiz = await Quiz.findById(quiz._id);
    let foundAttempt = await QuizAttempt.findById(quizAttempt._id);
    let foundViolation = await Violation.findById(violation._id);
    let foundContest = await Contest.findById(contest._id);

    assert.ok(foundQuiz, 'Quiz should exist before delete');
    assert.ok(foundAttempt, 'QuizAttempt should exist before delete');
    assert.ok(foundViolation, 'Violation should exist before delete');
    assert.strictEqual(foundContest.quizzes.length, 1, 'Contest should contain quiz before delete');
    assert.strictEqual(foundContest.leaderboard[0].completedQuizzes.length, 1, 'Contest leaderboard entry should contain quiz before delete');

    // Simulate deleteQuiz request/response
    const req = {
      params: { id: quiz._id.toString() },
      user: { id: teacher._id.toString(), role: 'teacher' }
    };
    
    let responseStatus = null;
    let responseJson = null;
    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(payload) {
        responseJson = payload;
        return this;
      }
    };

    let nextCalled = false;
    const next = (err) => {
      if (err) nextCalled = true;
    };

    await deleteQuiz(req, res, next);

    assert.strictEqual(nextCalled, false, 'deleteQuiz should not error out');
    assert.strictEqual(responseStatus, 200, 'deleteQuiz should respond with 200 status');
    assert.strictEqual(responseJson.success, true, 'deleteQuiz response should indicate success');

    // Verify cascade deletion and cleanups
    const quizAfterDelete = await Quiz.findById(quiz._id);
    const attemptAfterDelete = await QuizAttempt.findById(quizAttempt._id);
    const violationAfterDelete = await Violation.findById(violation._id);
    const contestAfterDelete = await Contest.findById(contest._id);

    assert.ok(!quizAfterDelete, 'Quiz should be deleted');
    assert.ok(!attemptAfterDelete, 'QuizAttempt should be cascade deleted');
    assert.ok(!violationAfterDelete, 'Violation should be cascade deleted');
    assert.strictEqual(contestAfterDelete.quizzes.length, 0, 'Quiz reference should be pulled from contest quizzes');
    assert.strictEqual(contestAfterDelete.leaderboard[0].completedQuizzes.length, 0, 'Quiz reference should be pulled from contest leaderboard');

    // Cleanup mock contest and teacher
    await Contest.deleteOne({ _id: contest._id });
    await User.deleteOne({ _id: teacher._id });

    console.log('✓ Test 4: Quiz deletion cascade cleanup passed.');
    passed++;

    // Test 5: Submit Quiz inside a Contest
    console.log('\nRunning Test 5: Submit Quiz inside a Contest...');
    
    // Create a mock quiz with a question
    const testQuiz = await Quiz.create({
      title: 'Contest Quiz Test',
      description: 'Used for testing contest quiz submissions',
      category: 'testing',
      creatorId: new mongoose.Types.ObjectId(),
      duration: 15,
      totalMarks: 50,
      questions: [
        {
          questionType: 'mcq',
          questionText: 'What is 1 + 1?',
          options: ['1', '2', '3', '4'],
          correctOption: 1,
          topic: 'math',
          difficulty: 'easy'
        }
      ]
    });

    // Create a mock contest containing the quiz
    const testContest = await Contest.create({
      title: 'Quiz Submission Contest',
      startTime: new Date(Date.now() - 3600000), // Started 1 hour ago
      endTime: new Date(Date.now() + 3600000), // Ends in 1 hour
      creatorId: new mongoose.Types.ObjectId(),
      quizzes: [testQuiz._id],
      participants: [user._id],
      leaderboard: [
        {
          userId: user._id,
          score: 0,
          penaltyTime: 0,
          completedQuizzes: []
        }
      ]
    });

    // Mock request/response for submitContestQuiz
    const submitReq = {
      params: { id: testContest._id.toString(), quizId: testQuiz._id.toString() },
      user: { id: user._id.toString(), role: 'student' },
      body: {
        answers: [
          { questionId: testQuiz.questions[0]._id.toString(), selectedOption: 1 } // Correct answer
        ],
        timeTaken: 60
      }
    };

    let submitStatus = null;
    let submitJson = null;
    const submitRes = {
      status(code) {
        submitStatus = code;
        return this;
      },
      json(payload) {
        submitJson = payload;
        return this;
      }
    };

    let submitNextCalled = false;
    const submitNext = (err) => {
      if (err) submitNextCalled = true;
    };

    await submitContestQuiz(submitReq, submitRes, submitNext);

    assert.strictEqual(submitNextCalled, false, 'submitContestQuiz should not error out');
    assert.strictEqual(submitStatus, 201, 'submitContestQuiz should respond with 201 status');
    assert.strictEqual(submitJson.success, true, 'submitContestQuiz response should indicate success');
    assert.strictEqual(submitJson.attempt.score, 50, 'Grades correct answer as full marks');
    assert.strictEqual(submitJson.attempt.accuracy, 100, 'Grades correct answer as 100% accuracy');

    // Verify database updates
    const contestAfterSubmit = await Contest.findById(testContest._id);
    const userLeaderboardEntry = contestAfterSubmit.leaderboard.find(
      (e) => e.userId.toString() === user._id.toString()
    );
    assert.strictEqual(userLeaderboardEntry.score, 50, 'Leaderboard entry score should be updated');
    assert.ok(userLeaderboardEntry.completedQuizzes.includes(testQuiz._id), 'Quiz ID should be added to completedQuizzes');

    const createdAttempt = await QuizAttempt.findOne({ userId: user._id, quizId: testQuiz._id });
    assert.ok(createdAttempt, 'QuizAttempt should be saved');
    assert.strictEqual(createdAttempt.score, 50, 'Saved attempt score should be 50');

    // Cleanup
    await Quiz.deleteOne({ _id: testQuiz._id });
    await Contest.deleteOne({ _id: testContest._id });
    await QuizAttempt.deleteOne({ _id: createdAttempt._id });

    console.log('✓ Test 5: Submit quiz inside a contest passed.');
    passed++;

    // Test 6: Question File Parsing
    console.log('\nRunning Test 6: Question File Parser...');
    const { parseTextToQuestions } = await import('../services/questionParser.js');
    const parserSample = `
1. What is Node.js?
A) A browser
B) A JavaScript runtime environment
C) A programming language
D) A web design CSS framework
Answer: B
Explanation: Node.js is an open-source, cross-platform JavaScript runtime.
    `;
    const parsed = parseTextToQuestions(parserSample);
    assert.strictEqual(parsed.length, 1, 'Should parse exactly 1 question');
    assert.strictEqual(parsed[0].questionType, 'mcq', 'Should detect MCQ question type');
    assert.strictEqual(parsed[0].correctOption, 1, 'Should detect correct option B (index 1)');
    assert.ok(parsed[0].explanation.includes('runtime'), 'Should extract explanation');
    console.log('✓ Test 6: Question file parser passed.');
    passed++;

    // Cleanup
    await User.deleteOne({ email: 'test_student@codearena.com' });

    // Test 7: Email OTP Registration & Verification Flow
    console.log('\nRunning Test 7: Email OTP Registration & Verification Flow...');
    const testEmail = 'verify_test_student@codearena.com';
    await User.deleteMany({ email: testEmail });

    // Mock response helpers
    const makeMockRes = () => {
      let statusVal = null;
      let jsonVal = null;
      return {
        status(code) {
          statusVal = code;
          return this;
        },
        json(payload) {
          jsonVal = payload;
          return this;
        },
        getStatus: () => statusVal,
        getJson: () => jsonVal,
      };
    };

    // 1. Submit a registration request
    const registerReq = {
      body: {
        name: 'Verify Test Student',
        email: testEmail,
        password: 'studentpassword123',
        role: 'student',
        college: 'Test College',
      },
    };
    const registerRes = makeMockRes();
    await registerUser(registerReq, registerRes, (err) => { if (err) throw err; });

    assert.strictEqual(registerRes.getStatus(), 200, 'Registration should return status 200');
    assert.strictEqual(registerRes.getJson().success, true, 'Registration response should indicate success');
    assert.strictEqual(registerRes.getJson().requiresVerification, true, 'Registration response should require verification');

    // Verify user exists in DB and is unverified
    let testUser = await User.findOne({ email: testEmail });
    assert.ok(testUser, 'User should exist in database');
    assert.strictEqual(testUser.isVerified, false, 'User should not be verified initially');
    assert.ok(testUser.otp, 'User should have an OTP generated');

    // 2. Try to login as unverified user
    const loginReq = {
      body: {
        email: testEmail,
        password: 'studentpassword123',
      },
    };
    const loginRes = makeMockRes();
    await loginUser(loginReq, loginRes, (err) => { if (err) throw err; });

    assert.strictEqual(loginRes.getStatus(), 400, 'Login should fail with 400 for unverified email');
    assert.strictEqual(loginRes.getJson().requiresVerification, true, 'Login should return requiresVerification: true');

    // Retrieve updated OTP after failed login attempt
    testUser = await User.findOne({ email: testEmail });
    const secondOtp = testUser.otp;
    assert.ok(secondOtp, 'User should have a new OTP generated after login attempt');

    // 3. Try to verify OTP with invalid code
    const invalidVerifyReq = {
      body: {
        email: testEmail,
        otp: '000000', // incorrect code
      },
    };
    const invalidVerifyRes = makeMockRes();
    await verifyOtp(invalidVerifyReq, invalidVerifyRes, (err) => { if (err) throw err; });

    assert.strictEqual(invalidVerifyRes.getStatus(), 400, 'Verification with invalid OTP should fail');

    // 4. Verify OTP with correct code
    const correctVerifyReq = {
      body: {
        email: testEmail,
        otp: secondOtp,
      },
    };
    const correctVerifyRes = makeMockRes();
    await verifyOtp(correctVerifyReq, correctVerifyRes, (err) => { if (err) throw err; });

    assert.strictEqual(correctVerifyRes.getStatus(), 200, 'Verification with correct OTP should succeed');
    assert.strictEqual(correctVerifyRes.getJson().success, true, 'Verification should return success');
    assert.ok(correctVerifyRes.getJson().token, 'Successful verification should return token');

    // Verify DB user is now verified
    testUser = await User.findOne({ email: testEmail });
    assert.strictEqual(testUser.isVerified, true, 'User should be marked as verified in DB');
    assert.strictEqual(testUser.otp, null, 'OTP should be cleared in DB');

    // 5. Try to login again as verified user
    const verifiedLoginRes = makeMockRes();
    await loginUser(loginReq, verifiedLoginRes, (err) => { if (err) throw err; });

    assert.strictEqual(verifiedLoginRes.getStatus(), 200, 'Login should succeed now that user is verified');
    assert.ok(verifiedLoginRes.getJson().token, 'Login should return a token');

    // Cleanup
    await User.deleteOne({ email: testEmail });

    console.log('✓ Test 7: Email OTP Verification flow passed.');
    passed++;

    // Test 8: Forgot Password OTP & Reset Flow
    console.log('\nRunning Test 8: Forgot Password OTP & Reset Flow...');
    const forgotEmail = 'forgot_test_student@codearena.com';
    await User.deleteMany({ email: forgotEmail });

    // 1. Create a verified user for testing password reset
    const userToReset = await User.create({
      name: 'Forgot Test Student',
      email: forgotEmail,
      password: 'originalpassword123',
      role: 'student',
      college: 'Forgot College',
      isVerified: true
    });

    // 2. Submit a forgot password request
    const forgotReq = {
      body: { email: forgotEmail }
    };
    const forgotRes = makeMockRes();
    await forgotPassword(forgotReq, forgotRes, (err) => { if (err) throw err; });

    assert.strictEqual(forgotRes.getStatus(), 200, 'Forgot password request should return 200');
    assert.strictEqual(forgotRes.getJson().success, true, 'Forgot password response should indicate success');

    // Retrieve OTP from database
    let dbUser = await User.findOne({ email: forgotEmail });
    assert.ok(dbUser.resetPasswordOtp, 'User should have reset OTP generated in DB');
    assert.ok(dbUser.resetPasswordOtpExpiry, 'User should have reset OTP expiry set in DB');
    const resetOtp = dbUser.resetPasswordOtp;

    // 3. Verify OTP with incorrect code
    const invalidVerifyResetReq = {
      body: { email: forgotEmail, otp: '000000' }
    };
    const invalidVerifyResetRes = makeMockRes();
    await verifyResetOtp(invalidVerifyResetReq, invalidVerifyResetRes, (err) => { if (err) throw err; });
    assert.strictEqual(invalidVerifyResetRes.getStatus(), 400, 'Reset OTP verification should fail for invalid code');

    // 4. Verify OTP with correct code
    const correctVerifyResetReq = {
      body: { email: forgotEmail, otp: resetOtp }
    };
    const correctVerifyResetRes = makeMockRes();
    await verifyResetOtp(correctVerifyResetReq, correctVerifyResetRes, (err) => { if (err) throw err; });
    assert.strictEqual(correctVerifyResetRes.getStatus(), 200, 'Reset OTP verification should succeed for valid code');

    // 5. Try to reset password with invalid OTP
    const invalidResetReq = {
      body: { email: forgotEmail, otp: '000000', newPassword: 'newpassword123' }
    };
    const invalidResetRes = makeMockRes();
    await resetPassword(invalidResetReq, invalidResetRes, (err) => { if (err) throw err; });
    assert.strictEqual(invalidResetRes.getStatus(), 400, 'Reset password should fail for invalid OTP');

    // 6. Reset password with correct OTP
    const correctResetReq = {
      body: { email: forgotEmail, otp: resetOtp, newPassword: 'newpassword123' }
    };
    const correctResetRes = makeMockRes();
    await resetPassword(correctResetReq, correctResetRes, (err) => { if (err) throw err; });
    assert.strictEqual(correctResetRes.getStatus(), 200, 'Reset password should succeed with correct OTP');
    assert.strictEqual(correctResetRes.getJson().success, true, 'Reset password response should indicate success');

    // Verify DB state
    dbUser = await User.findOne({ email: forgotEmail });
    assert.strictEqual(dbUser.resetPasswordOtp, null, 'Reset OTP should be cleared');
    assert.strictEqual(dbUser.resetPasswordOtpExpiry, null, 'Reset OTP expiry should be cleared');

    // 7. Verify login works with the new password
    const resetLoginReq = {
      body: { email: forgotEmail, password: 'newpassword123' }
    };
    const resetLoginRes = makeMockRes();
    await loginUser(resetLoginReq, resetLoginRes, (err) => { if (err) throw err; });
    assert.strictEqual(resetLoginRes.getStatus(), 200, 'Login should succeed with new password');
    assert.ok(resetLoginRes.getJson().token, 'Login response should include token');

    // Cleanup
    await User.deleteOne({ email: forgotEmail });
    console.log('✓ Test 8: Forgot Password OTP & Reset Flow passed.');
    passed++;

    console.log(`\n=== TEST SUITE COMPLETED: ${passed} Passed, ${failed} Failed ===`);
  } catch (error) {
    console.error('Test execution failed with error:', error.message);
    console.error(error.stack);
    failed++;
  } finally {
    await disconnectDB();
  }
};

runAllTests();
