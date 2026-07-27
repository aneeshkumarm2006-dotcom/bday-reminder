"use client";

import { Copy, ExternalLink, Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { TypedConfirmDialog } from "@/components/seoteam/admin/typed-confirm";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteSitePage, duplicateSitePage } from "@/lib/content/admin-api";
import { derivePageVisibility, type PageVisibility } from "@/lib/content/schedule";
import type { SitePage } from "@/lib/content/types";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<PageVisibility, string> = {
  draft: "border-border-subtle bg-surface-sunken text-ink-secondary",
  scheduled: "border-warn-fg/30 bg-warn-bg text-warn-fg",
  published: "border-ok-fg/30 bg-ok-bg text-ok-fg",
};

const STATUS_LABEL: Record<PageVisibility, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
};

export function PagesTable({ pages: initial }: { pages: SitePage[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pages, setPages] = React.useState(initial);
  const [pendingDelete, setPendingDelete] = React.useState<SitePage | null>(null);
  const [openMenu, setOpenMenu] = React.useState<string | null>(null);

  if (pages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-subtle px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold text-ink">No custom pages yet</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
          Build landing pages, guides, or campaign pages from blocks — no developer or
          deploy needed.
        </p>
        <Link href="/seoteam/pages/new" className="mt-5 inline-block">
          <Button type="button" size="sm">
            Create the first page
          </Button>
        </Link>
      </div>
    );
  }

  const duplicate = async (page: SitePage) => {
    try {
      const copy = await duplicateSitePage(page.id);
      setPages((prev) => [copy, ...prev]);
      toast({ message: `Duplicated as /${copy.slug}.`, tone: "success" });
      router.refresh();
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : "Could not duplicate.",
        tone: "error",
      });
    }
  };

  const remove = async (page: SitePage) => {
    try {
      await deleteSitePage(page.id);
      setPages((prev) => prev.filter((p) => p.id !== page.id));
      toast({ message: "Page deleted.", tone: "success" });
      router.refresh();
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : "Could not delete.",
        tone: "error",
      });
    }
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-border-subtle bg-surface-sunken text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Page</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Blocks</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => {
              const visibility = derivePageVisibility(page.status, page.publishedAt);
              return (
                <tr
                  key={page.id}
                  className="border-b border-border-subtle last:border-0 hover:bg-surface-sunken/60"
                >
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={`/seoteam/pages/${page.id}/edit`}
                      className="font-medium text-ink hover:text-biro"
                    >
                      {page.title}
                    </Link>
                    <p className="text-xs text-ink-muted">/{page.slug}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-xs",
                        STATUS_STYLE[visibility],
                      )}
                    >
                      {STATUS_LABEL[visibility]}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top tabular-nums text-ink-secondary">
                    {page.blocks.length}
                  </td>
                  <td className="px-4 py-3 align-top text-ink-muted">
                    <time dateTime={page.updatedAt}>{page.updatedAt.slice(0, 10)}</time>
                  </td>
                  <td className="relative whitespace-nowrap px-4 py-3 text-right align-top">
                    <Link
                      href={`/seoteam/pages/${page.id}/edit`}
                      aria-label={`Edit ${page.title}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface hover:text-ink"
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      aria-label={`More actions for ${page.title}`}
                      aria-expanded={openMenu === page.id}
                      onClick={() => setOpenMenu(openMenu === page.id ? null : page.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface hover:text-ink"
                    >
                      <MoreHorizontal size={16} aria-hidden="true" />
                    </button>

                    {openMenu === page.id && (
                      <>
                        <button
                          type="button"
                          aria-hidden="true"
                          tabIndex={-1}
                          onClick={() => setOpenMenu(null)}
                          className="fixed inset-0 z-10 cursor-default"
                        />
                        <div className="absolute right-4 z-20 mt-1 w-52 rounded-md border border-border-subtle bg-surface py-1 text-left shadow-lg">
                          <MenuItem
                            icon={ExternalLink}
                            label={visibility === "published" ? "View live" : "Preview draft"}
                            href={
                              visibility === "published"
                                ? `/${page.slug}`
                                : `/seoteam/preview/page/${page.id}`
                            }
                            onSelect={() => setOpenMenu(null)}
                          />
                          <MenuItem
                            icon={Link2}
                            label="Copy URL"
                            onSelect={() => {
                              void navigator.clipboard
                                .writeText(`${siteConfig.url}/${page.slug}`)
                                .then(() =>
                                  toast({ message: "URL copied.", tone: "success" }),
                                )
                                .catch(() =>
                                  toast({ message: "Could not copy.", tone: "error" }),
                                );
                              setOpenMenu(null);
                            }}
                          />
                          <MenuItem
                            icon={Copy}
                            label="Duplicate"
                            onSelect={() => {
                              setOpenMenu(null);
                              void duplicate(page);
                            }}
                          />
                          <MenuItem
                            icon={Trash2}
                            label="Delete"
                            destructive
                            onSelect={() => {
                              setOpenMenu(null);
                              setPendingDelete(page);
                            }}
                          />
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TypedConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this page?"
        message={
          pendingDelete
            ? `/${pendingDelete.slug} will 404 unless you add a redirect. A revision snapshot is kept in Activity.`
            : ""
        }
        phrase={pendingDelete?.slug ?? ""}
        confirmLabel="Delete the page"
        onConfirm={() => {
          if (pendingDelete) void remove(pendingDelete);
        }}
      />
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  href,
  onSelect,
  destructive,
}: {
  icon: typeof Copy;
  label: string;
  href?: string;
  onSelect: () => void;
  destructive?: boolean;
}) {
  const className = cn(
    "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
    destructive
      ? "text-ink-secondary hover:bg-danger-bg hover:text-danger-fg"
      : "text-ink-secondary hover:bg-surface-sunken hover:text-ink",
  );
  if (href) {
    return (
      <Link href={href} target="_blank" onClick={onSelect} className={className}>
        <Icon size={15} aria-hidden="true" />
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onSelect} className={className}>
      <Icon size={15} aria-hidden="true" />
      {label}
    </button>
  );
}
