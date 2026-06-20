import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { configureSockets } from './src/sockets/contestSocket.js';

const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Bind io instance to the Express request prototype so it is available globally in controllers
app.request.io = io;

// Configure WebSocket events
configureSockets(io);

// Start listening
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`Unhandled Rejection Error: ${err.message}`);
  // Close server & exit process
  // server.close(() => process.exit(1));
});
