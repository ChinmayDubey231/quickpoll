import mongoose, { Schema } from 'mongoose';
import type { IVote } from '../types/models.js';

const voteSchema = new Schema<IVote>(
  {
    pollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Poll',
      required: true,
      index: true,
    },
    // Used when the poll's pollType is 'single' or 'ranked' (first preference)
    optionIndex: {
      type: Number,
      default: null,
    },
    // Used when the poll's pollType is 'multi'
    optionIndexes: {
      type: [Number],
      default: undefined,
    },
    // Used when the poll's pollType is 'ranked' — full ordered permutation of option indices
    rankings: {
      type: [Number],
      default: undefined,
    },
    voterFingerprint: {
      type: String,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
  },
  { timestamps: true } // createdAt is used for the analytics timeline
);

const Vote = mongoose.model<IVote>('Vote', voteSchema);
export default Vote;
