import { Router } from 'express';
import { z } from 'zod';

import { resolvePersonAccess } from '../lib/access';
import { asyncHandler } from '../lib/async-handler';
import { notFound } from '../lib/http-error';
import { serializeNote } from '../lib/serialize';
import { requireAuth } from '../middleware/require-auth';
import { validateBody } from '../middleware/validate';
import { Note } from '../models/Note';

/**
 * Gift notes (TODO Stage 6; FR-35/36/37). A running list of separate,
 * timestamped entries per person - not one overwritable field - so old gift
 * ideas aren't lost when a new one is added. Notes are private to the user/list:
 * everyone who can see the person can read them, and anyone with access can add
 * or delete entries (FR-35/36/37).
 * Mounted nested under a person (`/people/:personId/notes`) so every route is
 * scoped to that person; deleting the person cascades their notes.
 */

export const notesRouter = Router({ mergeParams: true });

notesRouter.use(requireAuth);

/** GET /people/:personId/notes - the person's notes, newest first (any access). */
notesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { person } = await resolvePersonAccess(req.params.personId, req.userId!);
    const notes = await Note.find({ person: person._id }).sort({ createdAt: -1 });
    res.json({ notes: notes.map(serializeNote) });
  }),
);

const createSchema = z
  .object({
    text: z.string().trim().min(1, 'Write something to remember.').max(2000),
  })
  .strict();

/** POST /people/:personId/notes - add a note entry (FR-35/36; needs list access). */
notesRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { person } = await resolvePersonAccess(req.params.personId, userId);
    const { text } = req.body as z.infer<typeof createSchema>;

    const note = await Note.create({ person: person._id, author: userId, text });
    res.status(201).json({ note: serializeNote(note) });
  }),
);

/** DELETE /people/:personId/notes/:noteId - remove a single entry (needs list access). */
notesRouter.delete(
  '/:noteId',
  asyncHandler(async (req, res) => {
    const { person } = await resolvePersonAccess(req.params.personId, req.userId!);
    const note = await Note.findOne({ _id: req.params.noteId, person: person._id });
    if (!note) throw notFound("We couldn't find that note.");
    await note.deleteOne();
    res.status(204).end();
  }),
);
