import { JWT_SECRET } from '../config/token.js';
import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getLeaderboard } from '../controllers/analyticsController.js';
import analyticsRoutes from '../routes/analyticsRoutes.js';

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('rankings select only verified students and public fields; ties share competition rank', async () => {
  const find = mock.method(User, 'find', filter => {
    assert.deepEqual(filter, { role: 'student', isVerified: true });
    return {
      select(fields) {
        assert.equal(fields, '_id name college totalPoints streak');
        return this;
      },
      sort(order) {
        assert.deepEqual(order, { totalPoints: -1, _id: 1 });
        return this;
      },
      async lean() {
        return [
          { _id: 'a', name: 'First', totalPoints: 200, email: 'private@example.com', otp: '123456' },
          { _id: 'b', name: 'Tied', totalPoints: 200 },
          { _id: 'c', name: 'Third', totalPoints: 50, college: 'College', streak: 2 },
          { _id: 'd', name: 'New' },
        ];
      },
    };
  });
  try {
    const res = response();
    await getLeaderboard({}, res, error => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.users.map(user => user.rank), [1, 1, 3, 4]);
    assert.equal(res.body.users[3].totalPoints, 0);
    assert.equal(res.body.users[3].streak, 0);
    assert.deepEqual(Object.keys(res.body.users[0]).sort(), ['_id', 'college', 'name', 'rank', 'streak', 'totalPoints']);
    // Search must retain the server-assigned global rank.
    assert.equal(res.body.users.filter(user => user.name === 'Third')[0].rank, 3);
  } finally { find.mock.restore(); }
});

test('empty rankings return a successful empty list', async () => {
  const find = mock.method(User, 'find', () => ({
    select() { return this; }, sort() { return this; }, lean: async () => [],
  }));
  try {
    const res = response();
    await getLeaderboard({}, res, error => { throw error; });
    assert.deepEqual(res.body, { success: true, users: [] });
  } finally { find.mock.restore(); }
});

test('database failures are forwarded to the API error handler', async () => {
  const failure = new Error('Database unavailable');
  const find = mock.method(User, 'find', () => { throw failure; });
  try {
    let received;
    await getLeaderboard({}, response(), error => { received = error; });
    assert.equal(received, failure);
  } finally { find.mock.restore(); }
});

test('leaderboard route rejects anonymous users and accepts verified students', async () => {
  const route = analyticsRoutes.stack.find(layer => layer.route?.path === '/leaderboard').route;
  assert.equal(route.methods.get, true);
  assert.equal(route.stack.at(-1).handle, getLeaderboard);
  const protect = route.stack[0].handle;
  const anonymous = response();
  let called = false;
  await protect({ headers: {} }, anonymous, () => { called = true; });
  assert.equal(anonymous.statusCode, 401);
  assert.equal(called, false);

  const find = mock.method(User, 'findById', async () => ({ _id: 'student', role: 'student', isVerified: true }));
  try {
    const token = jwt.sign({ id: 'student' }, JWT_SECRET);
    await protect({ headers: { authorization: 'Bearer ' + token } }, response(), () => { called = true; });
    assert.equal(called, true);
  } finally { find.mock.restore(); }
});
