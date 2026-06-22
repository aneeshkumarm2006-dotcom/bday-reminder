import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';

import { HttpError } from '../lib/http-error';
import { logger } from '../lib/logger';

function isMongoDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/** 404 for unmatched routes. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ message: `No route for ${req.method} ${req.path}.`, code: 'not_found' });
};

/**
 * Centralized error handler. Maps known error shapes (HttpError, ZodError,
 * Mongoose validation, duplicate key) to clean JSON; everything else is a 500
 * with the detail logged, never leaked.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, code: err.code, details: err.details });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      message: 'Some fields need fixing.',
      code: 'validation',
      details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
    return;
  }

  if (isMongoDuplicateKey(err)) {
    res.status(409).json({
      message: 'That email is already registered. Try logging in instead.',
      code: 'conflict',
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      message: 'Some fields need fixing.',
      code: 'validation',
      details: Object.values(err.errors).map((e) => e.message),
    });
    return;
  }

  logger.error('Unhandled error:', err);
  res.status(500).json({ message: 'Something went wrong on our end.', code: 'internal' });
};
