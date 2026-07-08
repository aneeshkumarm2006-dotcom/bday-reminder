import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { deleteImage, updateImage } from "@/lib/blog/images";
import { firstZodError, updateImageSchema } from "@/lib/blog/validation";
import { getSeoSession } from "@/lib/seo-auth/server";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await getSeoSession())) return unauthorized();
  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = updateImageSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }
  if (parsed.data.alt === undefined && parsed.data.tags === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const result = await updateImage(id, parsed.data);
    if (!result) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }

    // The alt write-back mutated post bodies — revalidate the pages it touched.
    if (result.touchedSlugs.length > 0) {
      revalidatePath("/blog");
      for (const slug of result.touchedSlugs) revalidatePath(`/blog/${slug}`);
      revalidatePath("/sitemap.xml");
    }

    return NextResponse.json({ row: result.row });
  } catch (err) {
    console.error("PATCH /seoteam/api/media/[id] failed:", err);
    return NextResponse.json({ error: "Could not update the image." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!(await getSeoSession())) return unauthorized();
  const { id } = await ctx.params;

  try {
    const ok = await deleteImage(id);
    if (!ok) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }
    revalidatePath("/seoteam/media");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /seoteam/api/media/[id] failed:", err);
    return NextResponse.json({ error: "Could not delete the image." }, { status: 500 });
  }
}
