import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { deletePost, getPostById, updatePost } from "@/lib/blog/posts";
import { sanitizePostHtml } from "@/lib/blog/sanitize";
import { firstZodError, updatePostSchema } from "@/lib/blog/validation";
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

  const parsed = updatePostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  const data = { ...parsed.data };
  if (data.body !== undefined) data.body = sanitizePostHtml(data.body);

  try {
    const previous = await getPostById(id);
    const post = await updatePost(id, data);
    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    revalidatePath("/blog");
    revalidatePath(`/blog/${post.slug}`);
    if (previous && previous.slug !== post.slug) {
      revalidatePath(`/blog/${previous.slug}`);
    }
    revalidatePath("/sitemap.xml");

    return NextResponse.json({ post });
  } catch (err) {
    console.error("PATCH /seoteam/api/posts/[id] failed:", err);
    return NextResponse.json(
      { error: "Could not save the post. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!(await getSeoSession())) return unauthorized();
  const { id } = await ctx.params;

  try {
    const previous = await getPostById(id);
    const ok = await deletePost(id);
    if (!ok) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    revalidatePath("/blog");
    if (previous) revalidatePath(`/blog/${previous.slug}`);
    revalidatePath("/sitemap.xml");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /seoteam/api/posts/[id] failed:", err);
    return NextResponse.json(
      { error: "Could not delete the post. Please try again." },
      { status: 500 },
    );
  }
}
