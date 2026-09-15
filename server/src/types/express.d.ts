import type { HydratedDocument } from 'mongoose';
import type { IUser } from './models.js';

declare global {
  namespace Express {
    interface Request {
      user: HydratedDocument<IUser>;
    }
  }
}

export {};
