import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import User from '../models/User.js';
import Contest from '../models/Contest.js';
import { registerUser, verifyOtp } from '../controllers/authController.js';
import { sanitizeInputs, validateAuthInput } from '../middlewares/security.js';
import { gradeQuiz, validQuizSubmission } from '../services/grading.js';
import { executeSubmission } from '../services/judge.js';
import { submitContestChallenge, submitContestQuiz } from '../controllers/contestController.js';
import { configureSockets } from '../sockets/contestSocket.js';

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const fail = error => { throw error; };

test('public registration cannot create an admin', async () => {
  const res = response();
  await registerUser({ body: { name: 'Example', email: 'test@example.com', password: 'testpass123', role: 'admin' } }, res, fail);
  assert.equal(res.statusCode, 400);
});

test('already verified account cannot log in with an arbitrary OTP', async () => {
  const find = mock.method(User, 'findOne', async () => ({ isVerified: true, role: 'admin', _id: 'admin' }));
  try {
    const res = response();
    await verifyOtp({ body: { email: 'admin@example.com', otp: '000000' } }, res, fail);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.token, undefined);
  } finally { find.mock.restore(); }
});

test('input validation rejects query injection without corrupting code or passwords', () => {
  const res = response(); let called = false;
  sanitizeInputs({ body: { email: { $ne: null } } }, res, () => { called = true; });
  assert.equal(res.statusCode, 400); assert.equal(called, false);
  const body = { password: '  secret  ', code: '<script>console.log(1)</script>\n', sampleCode: { javascript: '  content ' } };
  const before = JSON.stringify(body);
  sanitizeInputs({ body }, response(), () => { called = true; });
  assert.equal(called, true); assert.equal(JSON.stringify(body), before);
  const invalid = response(); validateAuthInput({ body: { email: ['a'] } }, invalid, () => assert.fail());
  assert.equal(invalid.statusCode, 400);
});

test('grading handles all question types and never rewards blank answers', () => {
  const quiz = { totalMarks: 40, questions: [
    { _id: '1', questionType: 'mcq', correctOption: 0 },
    { _id: '2', questionType: 'multiple_correct', correctAnswers: [0, 2] },
    { _id: '3', questionType: 'true_false', answer: false },
    { _id: '4', questionType: 'fill_blank', correctAnswerText: 'Answer' }
  ] };
  const answers = [{ questionId: '1', selectedOption: 0 }, { questionId: '2', selectedOptions: [2, 0] }, { questionId: '3', booleanAnswer: false }, { questionId: '4', textAnswer: ' answer ' }];
  assert.equal(gradeQuiz(quiz, answers).score, 40);
  assert.equal(gradeQuiz(quiz, []).score, 0);
  assert.equal(validQuizSubmission({}, 10), false);
  assert.equal(validQuizSubmission(answers, -1), false);
  assert.equal(validQuizSubmission(answers, 10), true);
});

test('contest submissions require participation and an assigned problem', async () => {
  const contest = { participants: ['member'], codingChallenges: ['assigned'], quizzes: ['assigned'], startTime: new Date(Date.now()-1000), endTime: new Date(Date.now()+60000) };
  const find = mock.method(Contest, 'findById', async () => contest);
  try {
    for (const controller of [submitContestChallenge, submitContestQuiz]) {
      const res = response();
      await controller({ user: { id: 'outsider' }, params: { id: 'contest', challengeId: 'assigned', quizId: 'assigned' }, body: { answers: [], timeTaken: 1, code: 'console.log(1)', language: 'javascript' } }, res, fail);
      assert.equal(res.statusCode, 403);
    }
    const res = response();
    await submitContestChallenge({ user: { id: 'member' }, params: { id: 'contest', challengeId: 'outside' }, body: { code: 'console.log(1)', language: 'javascript' } }, res, fail);
    assert.equal(res.statusCode, 400);
  } finally { find.mock.restore(); }
});

test('socket handshake requires authentication', async () => {
  let middleware;
  configureSockets({ use(fn) { middleware = fn; }, on() {} });
  let failure;
  await middleware({ handshake: { auth: {} } }, error => { failure = error; });
  assert.match(failure.message, /Authentication/);
});

test('judge runs real code, rejects wrong answers, and caps output', async () => {
  const cases = [{ input: 'hello', expectedOutput: 'hello' }];
  const accepted = await executeSubmission('import fs from "node:fs"; console.log(fs.readFileSync(0,"utf8"));', 'javascript', cases);
  assert.equal(accepted.status, 'Accepted');
  assert.equal((await executeSubmission('console.log("wrong")', 'javascript', cases)).status, 'Wrong Answer');
  assert.equal((await executeSubmission('console.log("x".repeat(300000))', 'javascript', cases)).status, 'Runtime Error');
  assert.equal((await executeSubmission('console.log(1)', 'javascript', [])).success, false);
});
