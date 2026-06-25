import { Router } from 'express';
import { z } from 'zod';

import { generateForUser } from '../jobs/reminder-engine';
import { asyncHandler } from '../lib/async-handler';
import { parseCsv } from '../lib/csv';
import { maxDayInMonth } from '../lib/dates';
import {
  dedupeKey,
  mapCsvToCandidates,
  validateDob,
  type ParsedDob,
  type RawCandidate,
} from '../lib/import';
import { requireAuth } from '../middleware/require-auth';
import { validateBody } from '../middleware/validate';
import { Event } from '../models/Event';
import { Person } from '../models/Person';

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

type PreviewRow = {
  id: string;
  name: string;
  relationshipTag: string | null;
  phone: string | null;
  photoUrl: string | null;
  dob: ParsedDob | null;
  status: 'ready' | 'duplicate' | 'invalid';
  error: string | null;
  duplicate: { kind: 'existing' | 'batch'; personId: string | null; fullName: string } | null;
};

export const importRouter = Router();

importRouter.use(requireAuth);

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
        rawDob: null,
      });
    }

    // 2. Index the user's existing people by dedupe key (FR-11).
    const existing = await Person.find({ owner: userId });
    const existingByKey = new Map<string, { id: string; fullName: string }>();
    for (const p of existing) {
      const key = dedupeKey(p.fullName, {
        month: p.dob.month,
        day: p.dob.day,
        year: p.dob.year ?? null,
      });
      if (!existingByKey.has(key)) {
        existingByKey.set(key, { id: p._id.toString(), fullName: p.fullName });
      }
    }

    // 3. Annotate every candidate.
    const seenInBatch = new Map<string, string>();
    const rows: PreviewRow[] = candidates.map((c, i) => {
      const base = {
        id: `row-${i}`,
        name: c.name,
        relationshipTag: c.relationshipTag,
        phone: c.phone,
        photoUrl: c.photoUrl,
        dob: c.dob,
      };
      if (!c.name.trim()) {
        return { ...base, status: 'invalid', error: 'Add a name for this row.', duplicate: null };
      }
      if (!c.dob) {
        const error = c.rawDob
          ? `Couldn't read the date "${c.rawDob}".`
          : 'Add a date of birth (month and day).';
        return { ...base, status: 'invalid', error, duplicate: null };
      }
      const key = dedupeKey(c.name, c.dob);
      const existingMatch = existingByKey.get(key);
      if (existingMatch) {
        return {
          ...base,
          status: 'duplicate',
          error: null,
          duplicate: { kind: 'existing', personId: existingMatch.id, fullName: existingMatch.fullName },
        };
      }
      const batchMatch = seenInBatch.get(key);
      if (batchMatch) {
        return {
          ...base,
          status: 'duplicate',
          error: null,
          duplicate: { kind: 'batch', personId: null, fullName: batchMatch },
        };
      }
      seenInBatch.set(key, c.name.trim());
      return { ...base, status: 'ready', error: null, duplicate: null };
    });

    res.json({
      rows,
      summary: {
        total: rows.length,
        ready: rows.filter((r) => r.status === 'ready').length,
        duplicates: rows.filter((r) => r.status === 'duplicate').length,
        invalid: rows.filter((r) => r.status === 'invalid').length,
      },
    });
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

const commitItemSchema = z
  .object({
    name: z.string().trim().min(1, 'Add a name for this row.'),
    relationshipTag: z.string().trim().max(40).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    photoUrl: photoUrlSchema,
    dob: commitDobSchema,
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
        if (!target.phone && item.phone) {
          target.phone = item.phone;
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
        if (changed) {
          target.updatedBy = user._id;
          await target.save();
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
        phone: item.phone ?? undefined,
        createdBy: userId,
        updatedBy: userId,
      });
      await Event.create({
        person: person._id,
        type: 'birthday',
        date: { month: person.dob.month, day: person.dob.day, year: person.dob.year },
      });
      added += 1;
    }

    // Schedule reminders once for everything created (idempotent).
    if (added > 0) await generateForUser(user);

    res.status(201).json({ summary: { added, merged, skipped, total: items.length } });
  }),
);
