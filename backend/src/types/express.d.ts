import type { HydratedDocument } from 'mongoose';

import type { UserDoc } from '../models/User';

// `requireAuth` attaches the authenticated user to the request.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: HydratedDocument<UserDoc>;
    }
  }
}

export {};
