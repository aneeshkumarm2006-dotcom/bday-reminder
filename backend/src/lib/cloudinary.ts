import { createHash } from 'node:crypto';

import { loadEnv } from './env';
import { logger } from './logger';

/**
 * Cloudinary image hosting (TODO Stage 6; FR-10). Person photos are uploaded
 * here and only the resulting URL is stored on the Person. Uses Cloudinary's
 * signed REST upload directly (no SDK) - the same "talk to the provider over
 * HTTPS" approach as the Expo push and Resend email channels - so the API
 * secret never leaves the server.
 *
 * When the account isn't configured the upload degrades gracefully: the image
 * is handed back as a data URL, so adding a photo still works (and persists)
 * end-to-end in dev/QA without provisioning Cloudinary. Dropping in real keys
 * swaps that for hosted, CDN-served URLs with no other code change.
 */

export interface UploadResult {
  url: string;
  /** true when served by Cloudinary; false = data-URL fallback (unconfigured). */
  hosted: boolean;
}

export function isCloudinaryConfigured(): boolean {
  const env = loadEnv();
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

/** Cloudinary signature: SHA-1 of the sorted `k=v&…` params + the API secret. */
function sign(params: Record<string, string>, secret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(toSign + secret).digest('hex');
}

/**
 * Upload a base64 data URI (`data:image/...;base64,...`) and return its URL.
 * Falls back to echoing the data URI when Cloudinary isn't configured.
 */
export async function uploadImage(dataUri: string): Promise<UploadResult> {
  const env = loadEnv();
  if (!isCloudinaryConfigured()) {
    return { url: dataUri, hosted: false };
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = env.CLOUDINARY_UPLOAD_FOLDER;
  const signature = sign({ folder, timestamp }, env.CLOUDINARY_API_SECRET as string);

  const form = new URLSearchParams();
  form.set('file', dataUri);
  form.set('api_key', env.CLOUDINARY_API_KEY as string);
  form.set('timestamp', timestamp);
  form.set('folder', folder);
  form.set('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.error('cloudinary upload failed', res.status, detail.slice(0, 200));
    throw new Error('Photo upload failed. Try again.');
  }

  const json = (await res.json()) as { secure_url?: string; url?: string };
  const url = json.secure_url ?? json.url;
  if (!url) throw new Error('Photo upload failed. Try again.');
  return { url, hosted: true };
}
