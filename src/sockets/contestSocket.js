import Contest from '../models/Contest.js';
import User from '../models/User.js';

export const configureSockets = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join contest room
    socket.on('join_contest', async ({ contestId, userId }) => {
      try {
        const roomName = `contest_${contestId}`;
        socket.join(roomName);
        console.log(`User ${userId} joined room ${roomName}`);

        // Add user as participant if not already present
        const contest = await Contest.findById(contestId);
        if (contest && !contest.participants.includes(userId)) {
          contest.participants.push(userId);
          // Initialize leaderboard entry if not exists
          const existingEntry = contest.leaderboard.find(
            (entry) => entry.userId.toString() === userId.toString()
          );
          if (!existingEntry) {
            contest.leaderboard.push({
              userId,
              score: 0,
              penaltyTime: 0,
              submissionsCount: 0,
              solvedChallenges: [],
              completedQuizzes: []
            });
          }
          await contest.save();
        }

        // Send initial leaderboard
        await sendLeaderboardUpdate(io, contestId);
      } catch (err) {
        console.error('Socket join_contest error:', err.message);
      }
    });

    socket.on('leave_contest', ({ contestId, userId }) => {
      const roomName = `contest_${contestId}`;
      socket.leave(roomName);
      console.log(`User ${userId} left room ${roomName}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

export const sendLeaderboardUpdate = async (io, contestId) => {
  try {
    const contest = await Contest.findById(contestId)
      .populate('leaderboard.userId', 'name email college totalPoints')
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
