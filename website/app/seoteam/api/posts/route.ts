import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { sanitizePostHtml } from "@/lib/blog/sanitize";
import { createPost, getAllPosts } from "@/lib/blog/posts";
import { createPostSchema, firstZodError } from "@/lib/blog/validation";
import { getSeoSession } from "@/lib/seo-auth/server";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  if (!(await getSeoSession())) return unauthorized();
  try {
    const posts = await getAllPosts();
    return NextResponse.json({ posts });
  } catch (err) {
    console.error("GET /seoteam/api/posts failed:", err);
    return NextResponse.json({ error: "Could not load posts." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getSeoSession())) return unauthorized();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = createPostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  const data = parsed.data;
  try {
    const post = await createPost({
      ...data,
      body: sanitizePostHtml(data.body),
    });

    // New posts appear instantly on the public blog (also force-dynamic there).
    revalidatePath("/blog");
    revalidatePath(`/blog/${post.slug}`);
    revalidatePath("/sitemap.xml");

    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    console.error("POST /seoteam/api/posts failed:", err);
    return NextResponse.json(
      { error: "Could not save the post. Please try again." },
      { status: 500 },
    );
  }
}
