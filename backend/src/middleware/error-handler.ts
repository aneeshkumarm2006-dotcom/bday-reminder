import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';

import { HttpError } from '../lib/http-error';
import { logger } from '../lib/logger';

function isMongoDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/** body-parser tags its errors with a `type` and an HTTP `status`/`statusCode`. */
function bodyParserType(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null
    ? (err as { type?: string }).type
    : undefined;
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

  // A malformed id in a path/body (e.g. GET /people/not-an-id) is a lookup that
  // can't match anything — treat it as 404, never a 500 (which leaks internals).
  if (err instanceof mongoose.Error.CastError) {
    res.status(404).json({ message: "We couldn't find that.", code: 'not_found' });
    return;
  }

  // body-parser: unreadable JSON → 400, oversized payload → 413 (a photo over
  // the 8mb cap). Say the fix, don't 500.
  const parserType = bodyParserType(err);
  if (parserType === 'entity.parse.failed') {
    res.status(400).json({
      message: "We couldn't read that request. Please try again.",
      code: 'bad_request',
    });
    return;
  }
  if (parserType === 'entity.too.large') {
    res.status(413).json({
      message: 'That upload is too large. Try a smaller photo.',
      code: 'payload_too_large',
    });
    return;
  }

  logger.error('Unhandled error:', err);
  res.status(500).json({ message: 'Something went wrong on our end.', code: 'internal' });
};
