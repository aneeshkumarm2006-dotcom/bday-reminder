import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

/**
 * Body validation middleware. Parses `req.body` with a zod schema, replacing it
 * with the typed/coerced result. Failures forward a ZodError to the error
 * handler (→ 400 with field-level details).
 */
export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}
