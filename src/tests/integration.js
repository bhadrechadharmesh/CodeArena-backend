// Isolated HTTP/database integration checks. Never load the project .env here.
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/token.js';
import app from '../app.js';
import User from '../models/User.js';
import Quiz from '../models/Quiz.js';
import Contest from '../models/Contest.js';
import CodingChallenge from '../models/CodingChallenge.js';
import Violation from '../models/Violation.js';

let mongo, server;
try {
  mongo = await MongoMemoryServer.create({ binary: process.env.MONGOMS_SYSTEM_BINARY ? { systemBinary: process.env.MONGOMS_SYSTEM_BINARY } : undefined });
  await mongoose.connect(mongo.getUri());
  const student = await User.create({ name: 'Student', email: 'student@example.test', password: '  password  ', role: 'student', isVerified: true });
  const teacher = await User.create({ name: 'Teacher', email: 'teacher@example.test', password: 'password', role: 'teacher', isVerified: true, isApproved: true });
  const other = await User.create({ name: 'Other teacher', email: 'other@example.test', password: 'password', role: 'teacher', isVerified: true, isApproved: true });
  const admin = await User.create({ name: 'Admin', email: 'admin@example.test', password: 'password', role: 'admin', isVerified: true });
  const quiz = await Quiz.create({ title: 'Test', category: 'Algorithms', duration: 10, totalMarks: 10, creatorId: teacher._id, isPublished: true, questions: [{ questionType: 'mcq', questionText: 'Pick A', options: ['A', 'B'], correctOption: 0 }] });
  const challenge = await CodingChallenge.create({ title: 'Echo', description: 'Echo input', creatorId: teacher._id, testCases: [{ input: 'x', expectedOutput: 'x' }] });
  const contest = await Contest.create({ title: 'Session', startTime: new Date(Date.now()-60000), endTime: new Date(Date.now()+60000), creatorId: teacher._id, quizzes: [quiz._id] });
  await Violation.create({ userId: student._id, challengeId: challenge._id, violationType: 'tab_switch' });
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  let checked = 0;
  async function request(path, user, method='GET', body) {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Authorization = 'Bearer ' + jwt.sign({ id: user.id }, JWT_SECRET);
    const res = await fetch(base+path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json(); checked++; return { status: res.status, data };
  }
  assert.equal((await request('/api/auth/login', null, 'POST', { email: 'STUDENT@example.test', password: '  password  ' })).status, 200);
  assert.equal((await request('/api/auth/register', null, 'POST', { name: 'Bad', email: 'bad@example.test', password: 'password', role: 'admin' })).status, 400);
  assert.equal((await request('/api/auth/verify-otp', null, 'POST', { email: admin.email, otp: '000000' })).status, 400);
  assert.equal((await request('/api/auth/login', null, 'POST', { email: { $ne: null }, password: 'password' })).status, 400);
  assert.equal((await request('/api/analytics/admin', student)).status, 403);
  const analytics = await request('/api/analytics/admin', admin);
  assert.equal(analytics.status, 200); assert.equal(analytics.data.metrics.activeUsers, 0);
  const violations = await request('/api/violations', admin);
  assert.equal(violations.status, 200); assert.equal(violations.data.violations[0].challengeId.title, 'Echo');
  assert.equal((await request('/api/violations', other)).data.count, 0);
  const updated = await request('/api/quizzes/'+quiz.id, teacher, 'PUT', { creatorId: other.id, title: 'Renamed' });
  assert.equal(updated.data.quiz.creatorId, teacher.id);
  assert.equal((await request('/api/contests/'+contest.id+'/submit-quiz/'+quiz.id, student, 'POST', { answers: [], timeTaken: 1 })).status, 403);
  await request('/api/contests/'+contest.id+'/join', student, 'POST', {});
  await request('/api/contests/'+contest.id+'/join', student, 'POST', {});
  assert.equal((await User.findById(student.id)).contestsParticipated, 1);
  const submitted = await request('/api/quizzes/'+quiz.id+'/attempt', student, 'POST', { answers: [{ questionId: quiz.questions[0].id, selectedOption: 0 }], timeTaken: 5 });
  assert.equal(submitted.status, 201); assert.equal(submitted.data.attempt.score, 10);
  assert.equal((await request('/api/quizzes/attempts/'+submitted.data.attempt.id, other)).status, 403);
  const ranking = await request('/api/analytics/leaderboard', student);
  assert.equal(ranking.data.users[0].totalPoints, 10); assert.equal(ranking.data.users[0].rank, 1);
  console.log('Passed ' + checked + ' isolated HTTP/database requests and scoring checks. No emails sent.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
}
