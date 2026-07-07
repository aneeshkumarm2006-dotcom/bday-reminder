import { Router } from 'express';
import { z } from 'zod';

import { generateForUser } from '../jobs/reminder-engine';
import { asyncHandler } from '../lib/async-handler';
import { parseCsv } from '../lib/csv';
import { maxDayInMonth } from '../lib/dates';
import { buildGoogleCandidates } from '../lib/google-import';
import { googleImportConfigured, refreshAccessToken } from '../lib/google-oauth';
import { HttpError } from '../lib/http-error';
import {
  annotateCandidates,
  mapCsvToCandidates,
  validateDob,
  type ExistingPerson,
  type RawCandidate,
} from '../lib/import';
import { normalizePhone } from '../lib/phone';
import { decryptToken } from '../lib/token-crypto';
import { requireAuth } from '../middleware/require-auth';
import { validateBody } from '../middleware/validate';
import { Event } from '../models/Event';
import { Person } from '../models/Person';
import { User } from '../models/User';

/**
 * Bulk import (TODO Stage 7; FR-6/7/11). Two steps so the user always confirms
 * before anything is written:
 *
 *   1. POST /import/preview - accept a pasted CSV (parsed + column-mapped server-
 *      side, FR-7) and/or already-structured device-contact rows (FR-6). Each
 *      candidate is annotated: `ready`, `invalid` (no name / unreadable date), or
 *      `duplicate` (same name + same DOB as an existing person, or an earlier row
 *      in the same batch - FR-11). Nothing is created here.
 *
 *   2. POST /import/commit - the client sends each row back with an explicit
 *      resolution (`add` = keep both, `merge` = fill the existing person's empty
 *      fields, `skip`). Never silently auto-merges and never overwrites populated
 *      data without the user asking (FR-11, §10). Reminders are generated once at
 *      the end for everything that was added.
 */

const CURRENT_YEAR = new Date().getUTCFullYear();

// A hosted https URL (Cloudinary) or the data-URL fallback (mirrors people.ts).
const photoUrlSchema = z
  .string()
  .trim()
  .max(8_000_000)
  .refine((v) => /^(https?:\/\/|data:image\/)/.test(v), 'Enter a valid image URL.')
  .nullable()
  .optional();

// The friend's email (Google Contacts import can carry it); mirrors people.ts.
const emailSchema = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email address.')
  .nullable()
  .optional();

// Loose dob for contacts - bad values become an `invalid` row, not a 400.
const contactDobSchema = z
  .object({
    month: z.number().int(),
    day: z.number().int(),
    year: z.number().int().nullable().optional(),
  })
  .nullable()
  .optional();

const contactCandidateSchema = z.object({
  name: z.string().trim().max(200),
  relationshipTag: z.string().trim().max(40).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  photoUrl: photoUrlSchema,
  dob: contactDobSchema,
});

const previewSchema = z
  .object({
    csv: z.string().max(2_000_000).optional(),
    candidates: z.array(contactCandidateSchema).max(2000).optional(),
  })
  .refine((b) => !!b.csv?.trim() || (b.candidates && b.candidates.length > 0), {
    message: 'Add a CSV or some contacts to import.',
  });

export const importRouter = Router();

importRouter.use(requireAuth);

/** Snapshot the caller's existing people in dedupe-key terms (for annotation). */
async function loadExistingPeople(userId: string): Promise<ExistingPerson[]> {
  const existing = await Person.find({ owner: userId }).select('fullName dob');
  return existing.map((p) => ({
    id: p._id.toString(),
    fullName: p.fullName,
    dob: { month: p.dob.month, day: p.dob.day, year: p.dob.year ?? null },
  }));
}

importRouter.post(
  '/preview',
  validateBody(previewSchema),
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const body = req.body as z.infer<typeof previewSchema>;

    // 1. Normalize CSV rows and/or structured contacts into one candidate list.
    const candidates: RawCandidate[] = [];
    if (body.csv?.trim()) candidates.push(...mapCsvToCandidates(parseCsv(body.csv)));
    for (const c of body.candidates ?? []) {
      candidates.push({
        name: c.name,
        relationshipTag: c.relationshipTag ?? null,
        phone: c.phone ?? null,
        photoUrl: c.photoUrl ?? null,
        dob: c.dob ? validateDob(c.dob) : null,
        email: null,
        events: [],
        rawDob: null,
      });
    }

    // 2-3. Annotate against the user's existing people (FR-11); shared with Google import.
    const existing = await loadExistingPeople(userId);
    const { rows, summary } = annotateCandidates(candidates, existing);

    res.json({ rows, summary });
  }),
);

const commitDobSchema = z
  .object({
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    year: z.number().int().min(1900).max(CURRENT_YEAR).nullable().optional(),
  })
  .refine((d) => d.day <= maxDayInMonth(d.month), {
    message: "That day doesn't exist in the chosen month.",
    path: ['day'],
  });

// An extra anniversary/custom event to attach on commit (Google import only). The
// birthday is still auto-created from `dob`, so only these two types are accepted;
// a custom event needs a name (mirrors people.ts's createEventItemSchema).
const commitEventSchema = z
  .object({
    type: z.enum(['anniversary', 'custom']),
    customName: z.string().trim().min(1).max(60).nullable().optional(),
    date: commitDobSchema,
  })
  .strict()
  .refine((e) => e.type !== 'custom' || !!e.customName?.trim(), {
    message: 'Name this event so you know what it is.',
    path: ['customName'],
  });

const commitItemSchema = z
  .object({
    name: z.string().trim().min(1, 'Add a name for this row.'),
    relationshipTag: z.string().trim().max(40).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    photoUrl: photoUrlSchema,
    dob: commitDobSchema,
    email: emailSchema,
    events: z.array(commitEventSchema).max(20).optional(),
    resolution: z.enum(['add', 'merge', 'skip']),
    mergeTargetId: z.string().trim().min(1).nullable().optional(),
  })
  .refine((i) => i.resolution !== 'merge' || !!i.mergeTargetId, {
    message: 'Pick which person to merge into.',
    path: ['mergeTargetId'],
  });

const commitSchema = z.object({ items: z.array(commitItemSchema).min(1).max(2000) });

importRouter.post(
  '/commit',
  validateBody(commitSchema),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const userId = user._id.toString();
    const { items } = req.body as z.infer<typeof commitSchema>;

    let added = 0;
    let merged = 0;
    let skipped = 0;
    // Track whether a merge inserted any events, so we regen reminders even when
    // nothing new was *added* (a merge that only appends an anniversary still needs it).
    let mergedEvents = false;

    // Normalize an item's email once ('' / whitespace clears to undefined).
    const cleanEmail = (raw: string | null | undefined) =>
      raw && raw.trim() ? raw.trim().toLowerCase() : undefined;
    // Dedupe key for an event (matches lib/google-import so merge doesn't re-add).
    const evKey = (type: string, customName: string | null | undefined, month: number, day: number) =>
      `${type}|${(customName ?? '').toLowerCase()}|${month}-${day}`;

    for (const item of items) {
      if (item.resolution === 'skip') {
        skipped += 1;
        continue;
      }

      if (item.resolution === 'merge') {
        const target = await Person.findById(item.mergeTargetId);
        // Honor only a real, owned target; otherwise skip rather than fail the batch.
        if (!target || String(target.owner) !== userId) {
          skipped += 1;
          continue;
        }
        // Fill only empty fields - never overwrite populated data without asking (§10).
        let changed = false;
        const phone = normalizePhone(item.phone);
        if (!target.phone && phone) {
          target.phone = phone;
          changed = true;
        }
        if (!target.relationshipTag && item.relationshipTag) {
          target.relationshipTag = item.relationshipTag;
          changed = true;
        }
        if (!target.photoUrl && item.photoUrl) {
          target.photoUrl = item.photoUrl;
          changed = true;
        }
        const email = cleanEmail(item.email);
        if (!target.email && email) {
          target.email = email;
          changed = true;
        }
        if (changed) {
          target.updatedBy = user._id;
          await target.save();
        }
        // Add only the anniversary/custom events the target doesn't already have.
        if (item.events?.length) {
          const existingEvents = await Event.find({ person: target._id });
          const existingKeys = new Set(
            existingEvents.map((e) => evKey(e.type, e.customName ?? null, e.date.month, e.date.day)),
          );
          const toInsert = item.events
            .filter((e) => !existingKeys.has(evKey(e.type, e.customName ?? null, e.date.month, e.date.day)))
            .map((e) => ({
              person: target._id,
              type: e.type,
              customName: e.customName ?? undefined,
              date: { month: e.date.month, day: e.date.day, year: e.date.year ?? undefined },
            }));
          if (toInsert.length) {
            await Event.insertMany(toInsert);
            mergedEvents = true;
          }
        }
        merged += 1;
        continue;
      }

      // 'add' - keep both / a brand-new person: create + auto-birthday (FR-5/12).
      const person = await Person.create({
        owner: userId,
        fullName: item.name.trim(),
        type: 'human',
        relationshipTag: item.relationshipTag ?? undefined,
        photoUrl: item.photoUrl ?? undefined,
        dob: { month: item.dob.month, day: item.dob.day, year: item.dob.year ?? undefined },
        feb29Rule: 'feb28',
        phone: normalizePhone(item.phone) ?? undefined,
        email: cleanEmail(item.email),
        createdBy: userId,
        updatedBy: userId,
      });
      await Event.create({
        person: person._id,
        type: 'birthday',
        date: { month: person.dob.month, day: person.dob.day, year: person.dob.year },
      });
      // Extra anniversary/custom events carried in from Google (FR-16).
      if (item.events?.length) {
        await Event.insertMany(
          item.events.map((e) => ({
            person: person._id,
            type: e.type,
            customName: e.customName ?? undefined,
            date: { month: e.date.month, day: e.date.day, year: e.date.year ?? undefined },
          })),
        );
      }
      added += 1;
    }

    // Schedule reminders once for everything created/added (idempotent).
    if (added > 0 || mergedEvents) await generateForUser(user);

    res.status(201).json({ summary: { added, merged, skipped, total: items.length } });
  }),
);

/**
 * POST /import/google/preview (Stage 16). Uses the user's stored (encrypted) Google
 * refresh token to fetch birthdays + anniversaries from their Google Calendar AND
 * Contacts, merges/dedupes the two sources, and annotates them against existing
 * people - returning the SAME `{ rows, summary }` shape as /preview (plus a
 * `truncated` flag) so the client reuses the exact review/consent + commit flow.
 * Nothing is written here. A revoked/expired token drops the connection and asks
 * the user to reconnect (409). No request body - the scopes were granted at connect.
 */
importRouter.post(
  '/google/preview',
  asyncHandler(async (req, res) => {
    const userId = req.userId!;

    if (!googleImportConfigured()) {
      throw new HttpError(503, 'Google import isn’t configured on this server yet.', {
        code: 'google_import_not_configured',
      });
    }

    // Re-select the hidden refresh token so we can mint an access token.
    const withToken = await User.findById(userId).select('+googleImport.refreshTokenEnc');
    const enc = withToken?.googleImport?.refreshTokenEnc;
    if (!enc) {
      throw new HttpError(409, 'Connect your Google account to import.', {
        code: 'google_import_not_connected',
      });
    }

    let accessToken: string;
    try {
      accessToken = await refreshAccessToken(decryptToken(enc));
    } catch (err) {
      // invalid_grant = the user revoked access (or the token expired). Drop our
      // stored copy so the client shows "connect" again, and ask them to reconnect.
      if ((err as { code?: string }).code === 'invalid_grant') {
        await User.updateOne({ _id: userId }, { $unset: { googleImport: '' } });
        throw new HttpError(409, 'Your Google connection expired. Reconnect to import.', {
          code: 'google_import_disconnected',
        });
      }
      throw err;
    }

    const { candidates, truncated } = await buildGoogleCandidates(accessToken);
    const existing = await loadExistingPeople(userId);
    const { rows, summary } = annotateCandidates(candidates, existing);

    res.json({ rows, summary, truncated });
  }),
);
