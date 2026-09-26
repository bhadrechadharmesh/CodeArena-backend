import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import User from '../models/User.js';
import Quiz from '../models/Quiz.js';
import Contest from '../models/Contest.js';
import Violation from '../models/Violation.js';
import CodingChallenge from '../models/CodingChallenge.js';
import { getAdminAnalytics } from '../controllers/analyticsController.js';
import routes from '../routes/analyticsRoutes.js';

test('admin analytics use registration counts and preserve zero participation', async () => {
  const month = new Date().toISOString().slice(0, 7);
  const mocks = [
    mock.method(User, 'countDocuments', async filter => !filter ? 10 : filter.contestsParticipated ? 0 : 2),
    mock.method(Quiz, 'countDocuments', async () => 3),
    mock.method(Contest, 'countDocuments', async () => 4),
    mock.method(Violation, 'countDocuments', async () => 5),
    mock.method(User, 'aggregate', async pipeline => {
      assert.equal(pipeline[1].$group.users.$sum, 1);
      assert.equal(pipeline[1].$group._id.$dateToString.timezone, 'UTC');
      assert.ok(pipeline[0].$match.createdAt.$gte instanceof Date);
      return [{ _id: month, users: 7 }];
    }),
  ];
  try {
    const res = { status(code) { assert.equal(code, 200); return this; }, json(body) { this.body = body; } };
    await getAdminAnalytics({}, res, error => { throw error; });
    assert.equal(res.body.metrics.activeUsers, 0);
    assert.equal(res.body.growthData.length, 6);
    assert.deepEqual(res.body.growthData.map(row => row.users), [0, 0, 0, 0, 0, 7]);
  } finally { mocks.forEach(method => method.mock.restore()); }
});

test('violation population references the registered challenge model', () => {
  assert.equal(Violation.schema.path('challengeId').options.ref, CodingChallenge.modelName);
});

test('admin analytics route blocks students and permits admins', () => {
  const route = routes.stack.find(layer => layer.route?.path === '/admin').route;
  const authorize = route.stack[1].handle;
  let nextCalled = false;
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  authorize({ user: { role: 'student' } }, res, () => { nextCalled = true; });
  assert.equal(res.code, 403);
  assert.equal(nextCalled, false);
  authorize({ user: { role: 'admin' } }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
