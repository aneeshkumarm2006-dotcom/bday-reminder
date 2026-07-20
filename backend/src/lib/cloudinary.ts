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
 * Format we transcode every upload to. WebP is smaller than JPEG/PNG at
 * equivalent quality and preserves alpha, so the stored asset comes back as
 * `.webp` no matter what the source was.
 */
const TARGET_FORMAT = 'webp';

/**
 * Upload a base64 data URI (`data:image/...;base64,...`) and return its URL,
 * transcoded to WebP. Falls back to echoing the data URI when Cloudinary isn't
 * configured.
 */
export async function uploadImage(dataUri: string): Promise<UploadResult> {
  const env = loadEnv();
  if (!isCloudinaryConfigured()) {
    return { url: dataUri, hosted: false };
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = env.CLOUDINARY_UPLOAD_FOLDER;
  // `format` transcodes the stored asset, so it must be part of the signature.
  const signature = sign(
    { folder, format: TARGET_FORMAT, timestamp },
    env.CLOUDINARY_API_SECRET as string,
  );

  const form = new URLSearchParams();
  form.set('file', dataUri);
  form.set('api_key', env.CLOUDINARY_API_KEY as string);
  form.set('timestamp', timestamp);
  form.set('folder', folder);
  form.set('format', TARGET_FORMAT);
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

/**
 * Pull the `folder/name` public id out of a Cloudinary delivery URL, or return
 * null for anything that isn't one (the data-URL fallback, a foreign host).
 * Uploads here apply no transformations, so the path is just an optional version
 * segment (`v123/`) followed by `folder/name.ext`.
 */
function cloudinaryPublicId(url: string): string | null {
  if (!/^https?:\/\/res\.cloudinary\.com\//.test(url)) return null;
  const marker = '/image/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rest = url
    .slice(idx + marker.length)
    .replace(/^v\d+\//, '') // drop the version segment
    .replace(/\.[a-zA-Z0-9]+$/, ''); // drop the file extension
  return rest || null;
}

/**
 * Best-effort delete of a previously-uploaded person photo by its URL. No-ops
 * when Cloudinary isn't configured or the URL isn't a hosted Cloudinary asset,
 * so callers (account deletion) can fire it per photo without it ever failing
 * the wider operation. A non-2xx response is logged, not thrown.
 */
export async function destroyImage(url: string): Promise<void> {
  const env = loadEnv();
  if (!isCloudinaryConfigured()) return;
  const publicId = cloudinaryPublicId(url);
  if (!publicId) return;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign({ public_id: publicId, timestamp }, env.CLOUDINARY_API_SECRET as string);

  const form = new URLSearchParams();
  form.set('public_id', publicId);
  form.set('api_key', env.CLOUDINARY_API_KEY as string);
  form.set('timestamp', timestamp);
  form.set('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.warn('cloudinary destroy failed', res.status, detail.slice(0, 200));
  }
}
