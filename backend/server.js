// server.js
// ===================================================================
// 1) Imports
// ===================================================================
import express from 'express';          // Minimal HTTP server framework
import http from 'http';                // Raw HTTP server (required by Socket.IO)
import { Server } from 'socket.io';     // Socket.IO WebSocket server
import connectDB from './db.js';        // MongoDB connection (loads .env)
import User from './models/User.js';    // Mongoose model for connected users
import Message from './models/Message.js'; // Mongoose model for chat messages

// ===================================================================
// 2) Connect to MongoDB
// ===================================================================
// Ensures we have a database connection before handling sockets.
// Exits process if connection fails (handled inside connectDB()).
connectDB();

// ===================================================================
// 3) Create Express app, HTTP server, and Socket.IO server
// ===================================================================
const app = express();
const server = http.createServer(app);

// CORS: Allow your Next.js frontend to connect in dev.
// You can tighten this later via an env var (e.g., process.env.ORIGIN).
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// ===================================================================
// 4) Utilities
// ===================================================================

// Emit the current user list to everyone in a room
async function emitRoomUsers(room) {
  const usersInRoom = await User.find({ room }).lean();
  io.to(room).emit('roomUsers', {
    users: usersInRoom.map((u) => ({ username: u.username })),
  });
}

// Consistent shape for server/system messages (adds timestamp)
function serverMessage(text) {
  return { username: 'Server', text, createdAt: new Date() };
}

// ===================================================================
// 5) Socket.IO real-time logic
// ===================================================================
// Runs for each new socket connection. All per-user events (join, send,
// typing, leave) live inside this handler.
io.on('connection', (socket) => {
  console.log('🟢 Connected:', socket.id);

  // ---------------------------------------------------------------
  // joinRoom
  // ---------------------------------------------------------------
  // Client emits: socket.emit('joinRoom', { username, room })
  //  1) Persist user session to MongoDB
  //  2) Join the socket to a Socket.IO room
  //  3) Send recent message history to the joining user
  //  4) Send a welcome message (to the joining user only)
  //  5) Announce to others in the room that the user joined
  //  6) Emit updated user list to everyone in the room
  socket.on('joinRoom', async ({ username, room }) => {
    try {
      if (!username || !room) {
        socket.emit('message', serverMessage('Username and room are required.'));
        return;
      }

      // 1) Persist user session (socketId -> username, room)
      await User.create({ socketId: socket.id, username, room });

      // 2) Join the logical Socket.IO room
      socket.join(room);

      // 3) Send recent message history (oldest -> newest) just to this user
      const recent = await Message.find({ room })
        .sort({ createdAt: -1 })
        .limit(50) // tweak to your taste
        .lean();
      socket.emit('messageHistory', recent.reverse());

      // 4) Welcome the joining user
      socket.emit('message', serverMessage(`Welcome to ${room}, ${username}!`));

      // 5) Announce join to others in the room
      socket.broadcast.to(room).emit('message', serverMessage(`${username} has joined the chat.`));

      // 6) Send updated user list
      await emitRoomUsers(room);
    } catch (err) {
      console.error('❌ joinRoom error:', err);
      socket.emit('message', serverMessage('Failed to join room. Please try again.'));
    }
  });

  // ---------------------------------------------------------------
  // chat-message
  // ---------------------------------------------------------------
  // Client emits: socket.emit('chat-message', text)
  //  1) Resolve socket.id -> user (for username + room)
  //  2) Save the message (username, room, text) to MongoDB
  //  3) Broadcast the message to everyone in that room
  socket.on('chat-message', async (text) => {
    try {
      const trimmed = (text || '').trim();
      if (!trimmed) return;

      // 1) Find the user associated with this socket
      const user = await User.findOne({ socketId: socket.id });
      if (!user) return; // User might have disconnected

      // 2) Persist message
      const saved = await Message.create({
        username: user.username,
        room: user.room,
        text: trimmed,
      });

      // 3) Emit the new message to everyone in the same room
      io.to(user.room).emit('message', {
        username: saved.username,
        text: saved.text,
        createdAt: saved.createdAt,
      });
    } catch (err) {
      console.error('❌ chat-message error:', err);
      socket.emit('message', serverMessage('Failed to send message.'));
    }
  });

  // ---------------------------------------------------------------
  // typing / stopTyping
  // ---------------------------------------------------------------
  // Client emits 'typing' as user types (debounced on the client).
  // We broadcast to everyone ELSE in the room that this user is typing.
  socket.on('typing', async () => {
    try {
      const user = await User.findOne({ socketId: socket.id }).lean();
      if (!user) return;
      socket.broadcast.to(user.room).emit('typing', { username: user.username });
    } catch (err) {
      console.error('❌ typing error:', err);
    }
  });

  // Client emits 'stopTyping' after brief idle or on blur/submit.
  socket.on('stopTyping', async () => {
    try {
      const user = await User.findOne({ socketId: socket.id }).lean();
      if (!user) return;
      socket.broadcast.to(user.room).emit('stopTyping', { username: user.username });
    } catch (err) {
      console.error('❌ stopTyping error:', err);
    }
  });

  // ---------------------------------------------------------------
  // disconnect
  // ---------------------------------------------------------------
  // Fires when:
  //  - The user closes tab / app
  //  - Network drops
  //  - The socket disconnects for any reason
  //  1) Remove the user from MongoDB
  //  2) Broadcast "user left" to the room
  //  3) Emit updated user list
  socket.on('disconnect', async () => {
    try {
      const user = await User.findOneAndDelete({ socketId: socket.id });
      if (!user) {
        console.log('🔴 Disconnected (unknown user):', socket.id);
        return;
      }

      const { username, room } = user;

      // 2) Announce the user left
      io.to(room).emit('message', serverMessage(`${username} has left the chat.`));

      // 3) Update user list for the room
      await emitRoomUsers(room);

      console.log('🔴 Disconnected:', socket.id, username, room);
    } catch (err) {
      console.error('❌ disconnect error:', err);
    }
  });
});

// ===================================================================
// 6) Start the HTTP + WebSocket server
// ===================================================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});