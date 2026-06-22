import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async route handler so a rejected promise is forwarded to Express's
 * error handler instead of crashing the process (Express 4 doesn't await).
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
