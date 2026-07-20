import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { uploadImage } from "@/lib/blog/cloudinary";
import { recordUploadedImage } from "@/lib/blog/images";
import { getSeoSession } from "@/lib/seo-auth/server";

// Either a base64 data URL (a picked/dropped file) or a remote http(s) URL (a
// pasted link). Both are converted to WebP by uploadImage().
const schema = z.union([
  z.object({
    image: z
      .string()
      .refine((s) => /^data:image\/[a-z0-9.+-]+;base64,/i.test(s), {
        message: "Expected a base64 image data URL.",
      }),
  }),
  z.object({
    url: z
      .string()
      .refine((s) => /^https?:\/\/\S+$/i.test(s), {
        message: "Expected an http(s) image URL.",
      }),
  }),
]);

const MAX_BYTES = 8 * 1024 * 1024; // ~8MB, matching the backend's upload cap

export async function POST(req: NextRequest) {
  if (!(await getSeoSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid image." },
      { status: 400 },
    );
  }

  // A data URL is sent inline, so reject oversized payloads before uploading
  // (base64 is ~4/3 the byte size). A remote URL is fetched by Cloudinary, so
  // there's no local payload to size-check here.
  const source = "image" in parsed.data ? parsed.data.image : parsed.data.url;
  if ("image" in parsed.data) {
    const approxBytes = (parsed.data.image.length * 3) / 4;
    if (approxBytes > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image is too large (max 8MB)." },
        { status: 413 },
      );
    }
  }

  try {
    const result = await uploadImage(source);
    // Track hosted uploads in the Media library so they appear without a Sync.
    if (result.resource) {
      try {
        await recordUploadedImage(result.resource);
      } catch (err) {
        console.error("recordUploadedImage failed (upload still succeeded):", err);
      }
    }
    return NextResponse.json({ url: result.url, hosted: result.hosted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
