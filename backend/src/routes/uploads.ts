import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../lib/async-handler';
import { uploadImage } from '../lib/cloudinary';
import { requireAuth } from '../middleware/require-auth';
import { validateBody } from '../middleware/validate';

/**
 * Photo uploads (TODO Stage 6; FR-10). The app picks an image, sends it here as
 * a base64 data URI, and the server hosts it on Cloudinary and returns the URL
 * to store on the Person. Routed through the backend so the Cloudinary secret
 * stays server-side; falls back to the data URI when Cloudinary isn't
 * configured (see lib/cloudinary.ts).
 */

export const uploadsRouter = Router();

uploadsRouter.use(requireAuth);

const photoSchema = z
  .object({
    image: z
      .string()
      .trim()
      .startsWith('data:image/', 'Upload an image.')
      // ~6MB of base64 ≈ a 4MB image; the app downscales well below this.
      .max(8_000_000, 'That image is too large. Pick a smaller one.'),
  })
  .strict();

/** POST /uploads/photo - host a person photo, returns `{ url, hosted }`. */
uploadsRouter.post(
  '/photo',
  validateBody(photoSchema),
  asyncHandler(async (req, res) => {
    const { image } = req.body as z.infer<typeof photoSchema>;
    const result = await uploadImage(image);
    res.status(201).json(result);
  }),
);
