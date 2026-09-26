import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/token.js';
import Contest from '../models/Contest.js';
import User from '../models/User.js';

export const configureSockets = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user?.isVerified || (user.role === 'teacher' && !user.isApproved)) return next(new Error('Account not authorized'));
      socket.user = user;
      next();
    } catch { next(new Error('Invalid session')); }
  });
  io.on('connection', socket => {
    socket.on('join_contest', async (payload = {}) => {
      try {
        const contest = await Contest.findById(payload.contestId);
        const allowed = contest && (socket.user.role === 'admin' || String(contest.creatorId) === String(socket.user._id) || contest.participants.some(id => String(id) === String(socket.user._id)));
        if (!allowed) return socket.emit('contest_error', { message: 'Join the contest before subscribing to standings' });
        await socket.join('contest_' + contest._id);
        await sendLeaderboardUpdate(io, contest._id);
      } catch { socket.emit('contest_error', { message: 'Unable to load contest standings' }); }
    });
    socket.on('leave_contest', (payload = {}) => { if (payload?.contestId) socket.leave('contest_' + payload.contestId); });
  });
};

export const sendLeaderboardUpdate = async (io, contestId) => {
  try {
    const contest = await Contest.findById(contestId)
      .populate('leaderboard.userId', 'name college totalPoints')
      .exec();

    if (!contest) return;

    // Sort leaderboard by score (descending) and then by penaltyTime (ascending)
    const sortedLeaderboard = contest.leaderboard.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.penaltyTime - b.penaltyTime;
    });

    const roomName = `contest_${contestId}`;
    io.to(roomName).emit('leaderboard_update', sortedLeaderboard);
  } catch (err) {
    console.error('Error sending leaderboard update:', err.message);
  }
};
