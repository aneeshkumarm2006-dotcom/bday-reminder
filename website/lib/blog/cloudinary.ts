import { createHash } from "node:crypto";

import sharp from "sharp";

/**
 * Image upload to Cloudinary via signed REST (no SDK), mirroring the backend's
 * approach (backend/src/lib/cloudinary.ts). Three discrete env vars; when any is
 * missing the upload gracefully echoes the data URI back so the feature still
 * works in local dev (the image is just inlined rather than hosted).
 */
export interface UploadResult {
  url: string;
  hosted: boolean;
  /** The full Cloudinary asset (only present on a hosted upload). */
  resource?: CloudinaryResource;
}

/** The subset of a Cloudinary asset the Media library persists. */
export interface CloudinaryResource {
  publicId: string;
  secureUrl: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  /** Cloudinary created_at (ISO string), or null. */
  createdAt: string | null;
  tags: string[];
}

function folder(): string {
  return process.env.CLOUDINARY_UPLOAD_FOLDER || "circlethedate-blog";
}

/** Admin-API Basic auth header (api_key:api_secret). Callers must ensure config. */
function adminAuthHeader(): string {
  const apiKey = process.env.CLOUDINARY_API_KEY as string;
  const apiSecret = process.env.CLOUDINARY_API_SECRET as string;
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
}

/** Encode a public_id for a URL path, preserving folder slashes. */
function encodePublicIdPath(publicId: string): string {
  return publicId.split("/").map(encodeURIComponent).join("/");
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

/** Cloudinary signature: SHA-1 of the sorted `k=v&…` params + the API secret. */
function sign(params: Record<string, string>, secret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + secret).digest("hex");
}

/**
 * Ingest format we transcode every upload to. WebP is smaller than JPEG/PNG at
 * equivalent quality and preserves alpha, so it's the better SEO/perf default —
 * the stored asset (and its `secure_url`) comes back as `.webp` regardless of
 * whether the source was a JPG, PNG, or another WebP.
 */
const TARGET_FORMAT = "webp";

/**
 * Every stored blog image is compressed to at most this many bytes (~300KB) for
 * faster page loads and better Core Web Vitals / SEO. Images already under the
 * cap are left untouched (Cloudinary still transcodes them to WebP as before).
 */
const MAX_UPLOAD_BYTES = 300 * 1024;

/** Never upscale, but cap very wide source images — blog content rarely needs more. */
const MAX_UPLOAD_WIDTH = 2000;

/** Decode a `data:` URI or fetch a remote http(s) URL into a Buffer, or null. */
async function loadImageBytes(file: string): Promise<Buffer | null> {
  try {
    if (file.startsWith("data:")) {
      const comma = file.indexOf(",");
      if (comma === -1) return null;
      return Buffer.from(file.slice(comma + 1), "base64");
    }
    const res = await fetch(file);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Re-encode `input` to WebP under `maxBytes`, stepping quality then dimensions
 * down until it fits. Returns the best-effort smallest buffer (which may still
 * exceed the cap for pathological inputs) or null if sharp can't read it.
 */
async function compressToWebp(input: Buffer, maxBytes: number): Promise<Buffer | null> {
  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();
    const srcWidth = meta.width ?? MAX_UPLOAD_WIDTH;
    const cap = Math.min(srcWidth, MAX_UPLOAD_WIDTH);

    // Progressively lower quality, then shrink dimensions, until under the cap.
    const attempts: Array<{ width: number; quality: number }> = [
      { width: cap, quality: 80 },
      { width: cap, quality: 65 },
      { width: cap, quality: 50 },
      { width: Math.round(cap * 0.75), quality: 60 },
      { width: Math.round(cap * 0.75), quality: 45 },
      { width: Math.round(cap * 0.5), quality: 50 },
      { width: Math.round(cap * 0.5), quality: 40 },
    ];

    let smallest: Buffer | null = null;
    for (const { width, quality } of attempts) {
      const out = await sharp(input, { failOn: "none" })
        .rotate() // bake in EXIF orientation before we drop the metadata
        .resize({ width: Math.max(width, 1), withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
      if (!smallest || out.length < smallest.length) smallest = out;
      if (out.length <= maxBytes) return out;
    }
    return smallest;
  } catch (err) {
    console.error("Image compression failed (uploading original):", err);
    return null;
  }
}

/**
 * Prepare the `file` param for the Cloudinary upload, compressing oversized
 * images under {@link MAX_UPLOAD_BYTES} first. Returns the value to upload plus
 * whether Cloudinary should still transcode it to WebP: for a locally compressed
 * image we skip that (the bytes are already final WebP), for everything else we
 * keep the original transcode-on-upload behavior.
 */
async function prepareUpload(file: string): Promise<{ file: string; transcode: boolean }> {
  const bytes = await loadImageBytes(file);
  // Can't inspect it (fetch failed, odd data URI) → upload as-is, let Cloudinary transcode.
  if (!bytes) return { file, transcode: true };
  // Already small enough → leave it; Cloudinary still transcodes to WebP as before.
  if (bytes.length <= MAX_UPLOAD_BYTES) return { file, transcode: true };

  const compressed = await compressToWebp(bytes, MAX_UPLOAD_BYTES);
  if (!compressed) return { file, transcode: true };
  return {
    file: `data:image/webp;base64,${compressed.toString("base64")}`,
    transcode: false,
  };
}

/**
 * Upload an image to Cloudinary and transcode it to WebP. `file` may be a base64
 * data URI (a picked/dropped file) or a remote http(s) URL (a pasted link, which
 * Cloudinary fetches server-side). Images over ~300KB are compressed to WebP
 * under that cap before upload (for load speed / SEO); smaller ones are left
 * untouched. Echoes the input back untouched when Cloudinary isn't configured so
 * the feature still works in local dev.
 */
export async function uploadImage(file: string): Promise<UploadResult> {
  if (!isCloudinaryConfigured()) {
    return { url: file, hosted: false };
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME as string;
  const apiKey = process.env.CLOUDINARY_API_KEY as string;
  const apiSecret = process.env.CLOUDINARY_API_SECRET as string;

  const { file: toUpload, transcode } = await prepareUpload(file);

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const uploadFolder = folder();
  // `format` transcodes the stored asset, so it must be part of the signature.
  // A locally compressed image is already final WebP, so we skip the transcode
  // (and thus the `format` param) to preserve the exact sub-300KB bytes.
  const signedParams: Record<string, string> = { folder: uploadFolder, timestamp };
  if (transcode) signedParams.format = TARGET_FORMAT;
  const signature = sign(signedParams, apiSecret);

  const form = new URLSearchParams();
  form.set("file", toUpload);
  form.set("api_key", apiKey);
  form.set("timestamp", timestamp);
  form.set("folder", uploadFolder);
  if (transcode) form.set("format", TARGET_FORMAT);
  form.set("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Cloudinary upload failed:", res.status, detail.slice(0, 200));
    throw new Error("Image upload failed. Try again.");
  }

  const json = (await res.json()) as {
    secure_url?: string;
    url?: string;
    public_id?: string;
    format?: string;
    width?: number;
    height?: number;
    bytes?: number;
    created_at?: string;
    tags?: string[];
  };
  const url = json.secure_url ?? json.url;
  if (!url) throw new Error("Image upload failed. Try again.");

  const resource: CloudinaryResource | undefined = json.public_id
    ? {
        publicId: json.public_id,
        secureUrl: json.secure_url ?? json.url ?? url,
        format: json.format ?? "",
        width: json.width ?? 0,
        height: json.height ?? 0,
        bytes: json.bytes ?? 0,
        createdAt: json.created_at ?? null,
        tags: json.tags ?? [],
      }
    : undefined;

  return { url, hosted: true, resource };
}

/**
 * List every image asset in the upload folder via Cloudinary's Admin API
 * (Basic-auth, fully paginated over `next_cursor`). Returns `[]` when Cloudinary
 * isn't configured, so callers degrade to an empty inventory rather than throw.
 */
export async function listResources(): Promise<CloudinaryResource[]> {
  if (!isCloudinaryConfigured()) return [];

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME as string;
  const prefix = `${folder()}/`;
  const out: CloudinaryResource[] = [];
  let cursor: string | undefined;

  // Bounded — 500 assets/page covers many pages for any realistic blog library.
  for (let page = 0; page < 50; page++) {
    const params = new URLSearchParams({
      type: "upload",
      prefix,
      max_results: "500",
      tags: "true",
    });
    if (cursor) params.set("next_cursor", cursor);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/image?${params.toString()}`,
      { headers: { Authorization: adminAuthHeader() } },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Cloudinary list failed:", res.status, detail.slice(0, 200));
      throw new Error("Could not list Cloudinary images.");
    }

    const json = (await res.json()) as {
      resources?: Array<{
        public_id?: string;
        secure_url?: string;
        url?: string;
        format?: string;
        width?: number;
        height?: number;
        bytes?: number;
        created_at?: string;
        tags?: string[];
      }>;
      next_cursor?: string;
    };

    for (const r of json.resources ?? []) {
      if (!r.public_id) continue;
      out.push({
        publicId: r.public_id,
        secureUrl: r.secure_url ?? r.url ?? "",
        format: r.format ?? "",
        width: r.width ?? 0,
        height: r.height ?? 0,
        bytes: r.bytes ?? 0,
        createdAt: r.created_at ?? null,
        tags: r.tags ?? [],
      });
    }

    cursor = json.next_cursor;
    if (!cursor) break;
  }

  return out;
}

/**
 * Replace the full tag set on an asset via the Admin API (Basic-auth, no
 * signing). No-ops when Cloudinary isn't configured; throws on a real failure so
 * the caller can decide whether to surface it.
 */
export async function updateResourceTags(publicId: string, tags: string[]): Promise<void> {
  if (!isCloudinaryConfigured()) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME as string;
  const form = new URLSearchParams();
  form.set("tags", tags.join(","));

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload/${encodePublicIdPath(publicId)}`,
    {
      method: "POST",
      headers: {
        Authorization: adminAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Cloudinary tag update failed:", res.status, detail.slice(0, 200));
    throw new Error("Could not update tags on Cloudinary.");
  }
}

/**
 * Delete an asset by public_id (signed REST, mirrors the backend's helper).
 * No-ops when Cloudinary isn't configured; throws on a real failure.
 */
export async function destroyImage(publicId: string): Promise<void> {
  if (!isCloudinaryConfigured()) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME as string;
  const apiKey = process.env.CLOUDINARY_API_KEY as string;
  const apiSecret = process.env.CLOUDINARY_API_SECRET as string;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign({ public_id: publicId, timestamp }, apiSecret);

  const form = new URLSearchParams();
  form.set("public_id", publicId);
  form.set("api_key", apiKey);
  form.set("timestamp", timestamp);
  form.set("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Cloudinary destroy failed:", res.status, detail.slice(0, 200));
    throw new Error("Could not delete the image from Cloudinary.");
  }
}
