/**
 * Operational HTTP errors. Thrown anywhere, caught by the centralized error
 * handler, and serialized as `{ message, code?, details? }` with the right
 * status. Error copy says what happened and the fix (DESIGN.md §10 voice).
 */
export class HttpError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, options?: { code?: string; details?: unknown }) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, { code: 'bad_request', details });
export const unauthorized = (message = 'You need to log in to do that.') =>
  new HttpError(401, message, { code: 'unauthorized' });
export const forbidden = (message = "You don't have access to this.") =>
  new HttpError(403, message, { code: 'forbidden' });
export const notFound = (message = "We couldn't find that.") =>
  new HttpError(404, message, { code: 'not_found' });
export const conflict = (message: string) => new HttpError(409, message, { code: 'conflict' });
export const tooManyRequests = (message = 'Too many requests. Please wait a moment and try again.') =>
  new HttpError(429, message, { code: 'rate_limited' });
