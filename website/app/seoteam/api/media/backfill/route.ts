import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isCloudinaryConfigured } from "@/lib/blog/cloudinary";
import { backfillWebp } from "@/lib/blog/images";
import { getSeoSession } from "@/lib/seo-auth/server";

// Converting the whole library (fetch + re-encode + repoint each asset) can run
// well past the default serverless budget, so give it the platform max. The op
// is idempotent, so a timeout just means "run it again to finish".
export const maxDuration = 300;

export async function POST() {
  if (!(await getSeoSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Cloudinary isn't configured. Add the CLOUDINARY_* env vars to convert." },
      { status: 400 },
    );
  }
  try {
    const summary = await backfillWebp();
    revalidatePath("/seoteam/media");
    revalidatePath("/blog");
    return NextResponse.json(summary);
  } catch (err) {
    console.error("POST /seoteam/api/media/backfill failed:", err);
    return NextResponse.json(
      { error: "Conversion failed. Please try again." },
      { status: 502 },
    );
  }
}
