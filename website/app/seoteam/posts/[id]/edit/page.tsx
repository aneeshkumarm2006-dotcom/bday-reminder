import { notFound, redirect } from "next/navigation";

import { PostEditor } from "@/components/seoteam/editor/post-editor";
import { getPostById } from "@/lib/blog/posts";
import type { Post } from "@/lib/blog/types";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const { id } = await params;

  let post: Post | null = null;
  try {
    post = await getPostById(id);
  } catch {
    post = null;
  }
  if (!post) notFound();

  return <PostEditor mode="edit" initial={post} />;
}
