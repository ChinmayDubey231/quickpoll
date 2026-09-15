import mongoose, { Schema } from 'mongoose';
import type { IReaction } from '../types/models.js';
import { REACTION_EMOJIS } from '../config/features.js';

const reactionSchema = new Schema<IReaction>(
  {
    pollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Poll',
      required: true,
      index: true,
    },
    emoji: {
      type: String,
      required: true,
      enum: REACTION_EMOJIS,
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
  { timestamps: true }
);

reactionSchema.index({ pollId: 1, emoji: 1 });

const Reaction = mongoose.model<IReaction>('Reaction', reactionSchema);
export default Reaction;
