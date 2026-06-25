import { randomBytes } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { getUserListAccess } from '../lib/access';
import { asyncHandler } from '../lib/async-handler';
import { buildUserCalendar } from '../lib/calendar';
import { forbidden, notFound } from '../lib/http-error';
import { serializeCalendarSync } from '../lib/serialize';
import { requireAuth } from '../middleware/require-auth';
import { validateBody } from '../middleware/validate';
import { SharedList } from '../models/SharedList';
import { User, type UserDoc } from '../models/User';

/**
 * Calendar sync (TODO Stage 9; FR-38/39/40). Two surfaces:
 *
 *  - A PUBLIC, tokenized feed (`GET /calendar/:token.ics`) a calendar app can
 *    subscribe to. No auth header - calendar clients can't send one - so the
 *    secret token in the URL is the credential. Built fresh per request, so it
 *    reflects current adds/edits/deletes (FR-39). Disabling sync or rotating the
 *    token makes the old URL 404 immediately (revoke).
 *
 *  - AUTHED settings (`/me/calendar`) to opt in, choose what to include
 *    (personal people + which shared lists, FR-40), and rotate the token.
 */

const newToken = () => randomBytes(24).toString('base64url');

/** Defensive: older docs created before Stage 9 may lack the subdoc. */
function ensureCalendarSync(user: UserDoc): void {
  if (!user.calendarSync) {
    user.calendarSync = { enabled: false, includePersonal: true, lists: [] } as UserDoc['calendarSync'];
  }
}

/** Every list the caller owns or belongs to - the choices for per-list opt-in. */
async function accessibleLists(userId: string) {
  return SharedList.find({ $or: [{ owner: userId }, { 'members.user': userId }] }).sort({
    createdAt: 1,
  });
}

// --- Public feed ------------------------------------------------------------

export const calendarFeedRouter = Router();

/**
 * GET /calendar/:token(.ics) - the subscribable ICS feed (FR-38). The `.ics`
 * suffix is optional (some clients append it); it's stripped before lookup.
 */
calendarFeedRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const raw = req.params.token;
    const token = raw.endsWith('.ics') ? raw.slice(0, -4) : raw;

    const user = await User.findOne({ 'calendarSync.token': token, 'calendarSync.enabled': true });
    if (!user) throw notFound('That calendar link is invalid or has been turned off.');

    const ics = await buildUserCalendar(user);
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'inline; filename="circle-the-date.ics"');
    // Always re-fetch: the feed is regenerated each request so it stays in sync.
    res.set('Cache-Control', 'no-cache, max-age=0');
    res.send(ics);
  }),
);

// --- Authed settings (mounted at /me/calendar) ------------------------------

export const calendarRouter = Router();

calendarRouter.use(requireAuth);

async function settingsResponse(user: UserDoc) {
  return serializeCalendarSync(user, await accessibleLists(user._id.toString()));
}

/** GET /me/calendar - current sync settings + the subscribe link. */
calendarRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await settingsResponse(req.user!));
  }),
);

const patchSchema = z
  .object({
    enabled: z.boolean().optional(),
    includePersonal: z.boolean().optional(),
    lists: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

/**
 * PATCH /me/calendar - opt in/out, choose what to include (FR-40). Enabling for
 * the first time mints a feed token; the token is kept when disabling so toggling
 * back on restores the same link (use POST /rotate to truly revoke).
 */
calendarRouter.patch(
  '/',
  validateBody(patchSchema),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    ensureCalendarSync(user);
    const patch = req.body as z.infer<typeof patchSchema>;

    if (patch.lists !== undefined) {
      const access = await getUserListAccess(user._id);
      const accessible = new Set(access.accessibleListIds);
      for (const id of patch.lists) {
        if (!accessible.has(id)) throw forbidden('You can only sync a list you belong to.');
      }
      user.calendarSync.lists = [...new Set(patch.lists)] as unknown as UserDoc['calendarSync']['lists'];
    }
    if (patch.includePersonal !== undefined) user.calendarSync.includePersonal = patch.includePersonal;
    if (patch.enabled !== undefined) {
      user.calendarSync.enabled = patch.enabled;
      if (patch.enabled && !user.calendarSync.token) user.calendarSync.token = newToken();
    }

    await user.save();
    res.json(await settingsResponse(user));
  }),
);

/**
 * POST /me/calendar/rotate - issue a new token, invalidating the old link
 * (revoke). Leaves the enabled/include settings as they are.
 */
calendarRouter.post(
  '/rotate',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    ensureCalendarSync(user);
    user.calendarSync.token = newToken();
    await user.save();
    res.json(await settingsResponse(user));
  }),
);
