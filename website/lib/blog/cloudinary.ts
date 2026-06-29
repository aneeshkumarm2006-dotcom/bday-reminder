import { createHash } from "node:crypto";

/**
 * Image upload to Cloudinary via signed REST (no SDK), mirroring the backend's
 * approach (backend/src/lib/cloudinary.ts). Three discrete env vars; when any is
 * missing the upload gracefully echoes the data URI back so the feature still
 * works in local dev (the image is just inlined rather than hosted).
 */
export interface UploadResult {
  url: string;
  hosted: boolean;
}

function folder(): string {
  return process.env.CLOUDINARY_UPLOAD_FOLDER || "circlethedate-blog";
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

export async function uploadImage(dataUri: string): Promise<UploadResult> {
  if (!isCloudinaryConfigured()) {
    return { url: dataUri, hosted: false };
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME as string;
  const apiKey = process.env.CLOUDINARY_API_KEY as string;
  const apiSecret = process.env.CLOUDINARY_API_SECRET as string;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const uploadFolder = folder();
  const signature = sign({ folder: uploadFolder, timestamp }, apiSecret);

  const form = new URLSearchParams();
  form.set("file", dataUri);
  form.set("api_key", apiKey);
  form.set("timestamp", timestamp);
  form.set("folder", uploadFolder);
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

  const json = (await res.json()) as { secure_url?: string; url?: string };
  const url = json.secure_url ?? json.url;
  if (!url) throw new Error("Image upload failed. Try again.");
  return { url, hosted: true };
}
