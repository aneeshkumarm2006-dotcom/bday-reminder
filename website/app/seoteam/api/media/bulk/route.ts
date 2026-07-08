import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { addTagToImages, deleteImages, removeTagFromImages } from "@/lib/blog/images";
import { bulkImageSchema, firstZodError } from "@/lib/blog/validation";
import { getSeoSession } from "@/lib/seo-auth/server";

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

  const parsed = bulkImageSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }
  const { action, ids, tag } = parsed.data;

  try {
    let affected = 0;
    if (action === "delete") {
      affected = await deleteImages(ids);
    } else if (action === "addTag") {
      if (!tag) return NextResponse.json({ error: "A tag is required." }, { status: 400 });
      affected = await addTagToImages(ids, tag);
    } else {
      if (!tag) return NextResponse.json({ error: "A tag is required." }, { status: 400 });
      affected = await removeTagFromImages(ids, tag);
    }

    revalidatePath("/seoteam/media");
    return NextResponse.json({ affected });
  } catch (err) {
    console.error("POST /seoteam/api/media/bulk failed:", err);
    return NextResponse.json({ error: "The bulk action failed." }, { status: 500 });
  }
}
