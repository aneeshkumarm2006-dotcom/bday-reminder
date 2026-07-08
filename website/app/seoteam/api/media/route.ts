import { NextResponse } from "next/server";

import { getMediaRows } from "@/lib/blog/images";
import { getSeoSession } from "@/lib/seo-auth/server";

export async function GET() {
  if (!(await getSeoSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await getMediaRows();
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("GET /seoteam/api/media failed:", err);
    return NextResponse.json({ error: "Could not load the media library." }, { status: 500 });
  }
}
