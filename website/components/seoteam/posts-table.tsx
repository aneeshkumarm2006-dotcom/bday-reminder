"use client";

import {
  EyeOff,
  ExternalLink,
  FileText,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { SeoReadinessPill } from "@/components/seoteam/seo-check-list";
import { buttonVariants } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { deletePostRequest, updatePostRequest } from "@/lib/blog/dashboard-api";
import { formatDate } from "@/lib/blog/format";
import { analyzeSeo } from "@/lib/blog/seo-checks";
import type { Post } from "@/lib/blog/types";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "published" | "draft";

export function PostsTable({ initialPosts }: { initialPosts: Post[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [posts, setPosts] = useState(initialPosts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((post) => {
      if (statusFilter !== "all" && post.status !== statusFilter) return false;
      if (q && !post.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [posts, search, statusFilter]);

  // Parse each post's HTML for its SEO verdict once per posts change — not on
  // every search keystroke / re-render.
  const seoByPost = useMemo(() => {
    const map = new Map<string, ReturnType<typeof analyzeSeo>>();
    for (const post of posts) {
      map.set(
        post.id,
        analyzeSeo({
          metaTitle: post.metaTitle || post.title,
          excerpt: post.excerpt,
          body: post.body,
          keywords: post.keywords,
          coverImage: post.coverImage,
        }),
      );
    }
    return map;
  }, [posts]);

  const toggleStatus = async (post: Post) => {
    const next = post.status === "published" ? "draft" : "published";
    setBusyId(post.id);
    try {
      const updated = await updatePostRequest(post.id, { status: next });
      setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
      toast({
        message: next === "published" ? "Published." : "Moved to draft.",
        tone: "success",
      });
      router.refresh();
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : "Couldn't update the post.",
        tone: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (post: Post) => {
    const ok = await confirm({
      title: "Delete this post?",
      message: `“${post.title}” will be permanently deleted. This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(post.id);
    try {
      await deletePostRequest(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast({ message: "Post deleted.", tone: "success" });
      router.refresh();
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : "Couldn't delete the post.",
        tone: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No posts yet"
        body="Create your first SEO-optimized blog post."
        action={
          <Link href="/seoteam/new" className={cn(buttonVariants())}>
            New post
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="sm:max-w-[12rem]"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-sunken text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">SEO</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Views</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((post) => {
              const analysis = seoByPost.get(post.id)!;
              const isPublished = post.status === "published";
              const date = post.publishedAt ?? post.updatedAt;
              const rowBusy = busyId === post.id;
              return (
                <tr
                  key={post.id}
                  className="border-b border-border-subtle last:border-0 bg-surface"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/seoteam/posts/${post.id}/edit`}
                      className="font-medium text-ink hover:text-biro"
                    >
                      {post.title || "Untitled"}
                    </Link>
                    <p className="text-xs text-ink-muted">/blog/{post.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <SeoReadinessPill analysis={analysis} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        isPublished
                          ? "bg-ok-bg text-ok-fg"
                          : "bg-surface-sunken text-ink-secondary",
                      )}
                    >
                      {isPublished ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {formatDate(date)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-secondary">
                    {post.views}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {isPublished && (
                        <Link
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          aria-label="View post"
                          title="View"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
                        >
                          <ExternalLink size={18} aria-hidden="true" />
                        </Link>
                      )}
                      <Link
                        href={`/seoteam/posts/${post.id}/edit`}
                        aria-label="Edit post"
                        title="Edit"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
                      >
                        <Pencil size={18} aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleStatus(post)}
                        disabled={rowBusy}
                        aria-label={isPublished ? "Unpublish" : "Publish"}
                        title={isPublished ? "Unpublish" : "Publish"}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-50"
                      >
                        {isPublished ? (
                          <EyeOff size={18} aria-hidden="true" />
                        ) : (
                          <Send size={18} aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(post)}
                        disabled={rowBusy}
                        aria-label="Delete post"
                        title="Delete"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-danger-bg hover:text-danger-fg disabled:opacity-50"
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-muted">
                  No posts match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
