import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { uploadImage } from "@/lib/blog/cloudinary";
import { recordUploadedImage } from "@/lib/blog/images";
import { getSeoSession } from "@/lib/seo-auth/server";

const schema = z.object({
  image: z
    .string()
    .refine((s) => /^data:image\/[a-z0-9.+-]+;base64,/i.test(s), {
      message: "Expected a base64 image data URL.",
    }),
});

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

  // base64 is ~4/3 the byte size — reject oversized payloads before uploading.
  const approxBytes = (parsed.data.image.length * 3) / 4;
  if (approxBytes > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is too large (max 8MB)." },
      { status: 413 },
    );
  }

  try {
    const result = await uploadImage(parsed.data.image);
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
