import type { Types } from 'mongoose';

import { forbidden, notFound } from '../lib/http-error';

/**
 * Ownership / permission helpers (used heavily from Stage 3 onward, and for
 * shared-list permission checks in Stage 8). Kept here so every protected
 * resource route enforces access the same way.
 */

/** Throw 404 if a looked-up document is missing; otherwise narrow it to T. */
export function assertFound<T>(doc: T | null | undefined, message?: string): T {
  if (doc === null || doc === undefined) {
    throw notFound(message);
  }
  return doc;
}

/** Throw 403 unless `userId` owns the resource. */
export function assertOwner(ownerId: Types.ObjectId | string, userId: string): void {
  if (String(ownerId) !== String(userId)) {
    throw forbidden();
  }
}

/** True when two ids (ObjectId or string) refer to the same document. */
export function sameId(a: Types.ObjectId | string, b: Types.ObjectId | string): boolean {
  return String(a) === String(b);
}
