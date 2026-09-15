import type { Types } from 'mongoose';
import type { IrvResult } from './socket.js';

export type PollType = 'single' | 'multi' | 'ranked';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

export interface IPollOption {
  text: string;
}

export interface IPoll {
  _id: Types.ObjectId;
  creatorId: Types.ObjectId;
  question: string;
  options: IPollOption[];
  pollType: PollType;
  isPublic: boolean;
  expiresAt: Date | null;
  isOpen: boolean;
  totalVotesCache: number;
  finalResult: IrvResult | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVote {
  _id: Types.ObjectId;
  pollId: Types.ObjectId;
  optionIndex?: number | null;
  optionIndexes?: number[] | null;
  rankings?: number[] | null;
  voterFingerprint: string | null;
  ip: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IComment {
  _id: Types.ObjectId;
  pollId: Types.ObjectId;
  authorName: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReaction {
  _id: Types.ObjectId;
  pollId: Types.ObjectId;
  emoji: string;
  voterFingerprint: string | null;
  ip: string | null;
  createdAt: Date;
  updatedAt: Date;
}
