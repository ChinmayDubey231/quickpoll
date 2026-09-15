import mongoose, { Schema } from 'mongoose';
import type { IComment } from '../types/models.js';

const commentSchema = new Schema<IComment>(
  {
    pollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Poll',
      required: true,
      index: true,
    },
    authorName: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [40, 'Name must be under 40 characters'],
    },
    body: {
      type: String,
      required: [true, 'Comment cannot be empty'],
      trim: true,
      maxlength: [500, 'Comment must be under 500 characters'],
    },
  },
  { timestamps: true }
);

const Comment = mongoose.model<IComment>('Comment', commentSchema);
export default Comment;
