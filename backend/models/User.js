// models/User.js

import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
  },
  room: {
    type: String,
    required: true,
  },
  socketId: {
    type: String,
    required: true,
    unique: true,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.User || mongoose.model('User', UserSchema);