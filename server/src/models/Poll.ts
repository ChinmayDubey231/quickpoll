import mongoose, { Schema } from 'mongoose';
import type { IPoll } from '../types/models.js';

const pollSchema = new Schema<IPoll>(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    question: {
      type: String,
      required: [true, 'Question is required'],
      trim: true,
      maxlength: [300, 'Question must be under 300 characters'],
    },
    options: {
      type: [
        {
          text: {
            type: String,
            required: true,
            trim: true,
          },
        },
      ],
      validate: {
        validator: (opts: unknown[]) => opts.length >= 2 && opts.length <= 6,
        message: 'A poll must have between 2 and 6 options',
      },
    },
    pollType: {
      type: String,
      enum: ['single', 'multi', 'ranked'],
      default: 'single',
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isOpen: {
      type: Boolean,
      default: true,
      index: true,
    },
    totalVotesCache: {
      type: Number,
      default: 0,
    },
    finalResult: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

pollSchema.index({ isPublic: 1, isOpen: 1, createdAt: -1 });

const Poll = mongoose.model<IPoll>('Poll', pollSchema);
export default Poll;
