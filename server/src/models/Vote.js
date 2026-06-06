import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema(
  {
    pollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Poll',
      required: true,
      index: true,
    },
    optionIndex: {
      type: Number,
      required: true,
    },
    // Reserved for VOTE_GUARD feature — not enforced yet
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

const Vote = mongoose.model('Vote', voteSchema);
export default Vote;
