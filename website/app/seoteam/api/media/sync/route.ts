import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isCloudinaryConfigured } from "@/lib/blog/cloudinary";
import { syncImages } from "@/lib/blog/images";
import { getSeoSession } from "@/lib/seo-auth/server";

export async function POST() {
  if (!(await getSeoSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Cloudinary isn't configured. Add the CLOUDINARY_* env vars to sync." },
      { status: 400 },
    );
  }
  try {
    const summary = await syncImages();
    revalidatePath("/seoteam/media");
    return NextResponse.json(summary);
  } catch (err) {
    console.error("POST /seoteam/api/media/sync failed:", err);
    return NextResponse.json({ error: "Sync failed. Please try again." }, { status: 502 });
  }
}
