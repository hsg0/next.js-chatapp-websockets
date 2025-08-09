import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    room: { type: String, required: true, index: true },
    text: { type: String, required: true },
  },
  { timestamps: true } // adds createdAt / updatedAt
);

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);