import mongoose from 'mongoose';

const pollSchema = new mongoose.Schema(
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
        validator: (opts) => opts.length >= 2 && opts.length <= 6,
        message: 'A poll must have between 2 and 6 options',
      },
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
  },
  { timestamps: true }
);

const Poll = mongoose.model('Poll', pollSchema);
export default Poll;
