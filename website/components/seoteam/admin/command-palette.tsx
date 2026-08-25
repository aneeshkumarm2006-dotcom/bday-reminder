"use client";

import { CornerDownLeft, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { Input } from "@/components/ui/input";
import type { Post } from "@/lib/blog/types";
import type { SitePage } from "@/lib/content/types";
import { cn } from "@/lib/utils";

/**
 * Ctrl/Cmd+K jump-to across the admin: every screen, plus every post and page
 * by title. Mounted once in the `/seoteam` layout, so the shortcut works from
 * any editor — the point is to stop the SEO team hunting through nav tabs to
 * find one post.
 *
 * The header's search button opens it by dispatching `OPEN_EVENT`, which avoids
 * threading a handler through every page's props.
 */
export const OPEN_EVENT = "seoteam:open-search";

interface Command {
  id: string;
  label: string;
  hint: string;
  href: string;
  group: string;
}

const STATIC_COMMANDS: Command[] = [
  { id: "overview", label: "Overview", hint: "Dashboard", href: "/seoteam", group: "Go to" },
  { id: "posts", label: "Posts", hint: "Blog posts", href: "/seoteam/posts", group: "Go to" },
  { id: "new-post", label: "New post", hint: "Write a blog post", href: "/seoteam/new", group: "Create" },
  { id: "media", label: "Media library", hint: "Images", href: "/seoteam/media", group: "Go to" },
  { id: "landing", label: "Landing page", hint: "Homepage sections", href: "/seoteam/landing", group: "Go to" },
  { id: "seo-pages", label: "SEO pages", hint: "Keyword landing pages", href: "/seoteam/seo-pages", group: "Go to" },
  { id: "pages", label: "Pages", hint: "Custom pages", href: "/seoteam/pages", group: "Go to" },
  { id: "new-page", label: "New page", hint: "Build a page from blocks", href: "/seoteam/pages/new", group: "Create" },
  { id: "legal", label: "Legal & contact", hint: "Privacy, terms, contact", href: "/seoteam/legal", group: "Go to" },
  { id: "site", label: "Site settings", hint: "Identity, SEO, analytics", href: "/seoteam/site", group: "Go to" },
  { id: "meta", label: "Page SEO", hint: "Titles and descriptions", href: "/seoteam/meta", group: "Go to" },
  { id: "structured", label: "Structured data", hint: "JSON-LD", href: "/seoteam/structured-data", group: "Go to" },
  { id: "nav", label: "Navigation", hint: "Header and footer", href: "/seoteam/navigation", group: "Go to" },
  { id: "redirects", label: "Redirects", hint: "Redirects and 404s", href: "/seoteam/redirects", group: "Go to" },
  { id: "activity", label: "Activity", hint: "Audit log and revisions", href: "/seoteam/activity", group: "Go to" },
  { id: "preview-landing", label: "Preview the landing draft", hint: "Opens the draft homepage", href: "/seoteam/preview/landing", group: "Actions" },
  { id: "export", label: "Export all content", hint: "JSON backup", href: "/seoteam/api/export", group: "Actions" },
  // The keyword landing pages, listed by hand rather than mapped from
  // `SEO_LANDING_PAGES`: importing that registry here would drag every page's
  // full copy — some 70KB of briefs — into the client bundle just to label a
  // menu. Unlike posts and pages above there's no list endpoint to fetch these
  // from either, so a page renamed in its own editor keeps its shipped name
  // here — the href is what matters, and it can only break if a page is added.
  { id: "seo-page-birthday-calendar", label: "Digital birthday calendar", hint: "/birthday-calendar", href: "/seoteam/seo-pages/birthday-calendar", group: "SEO pages" },
  { id: "seo-page-birthday-countdown-app", label: "Birthday countdown app", hint: "/birthday-countdown-app", href: "/seoteam/seo-pages/birthday-countdown-app", group: "SEO pages" },
  { id: "seo-page-birthday-tracker", label: "Birthday tracker app", hint: "/birthday-tracker", href: "/seoteam/seo-pages/birthday-tracker", group: "SEO pages" },
  { id: "seo-page-birthday-tracker-printable", label: "Printable birthday tracker", hint: "/birthday-tracker-printable", href: "/seoteam/seo-pages/birthday-tracker-printable", group: "SEO pages" },
  { id: "seo-page-birthday-alarm", label: "Birthday alarm app", hint: "/birthday-alarm", href: "/seoteam/seo-pages/birthday-alarm", group: "SEO pages" },
  { id: "seo-page-family-birthday-calendar", label: "Family birthday calendar", hint: "/family-birthday-calendar", href: "/seoteam/seo-pages/family-birthday-calendar", group: "SEO pages" },
  { id: "seo-page-anniversary-reminder-app", label: "Anniversary reminder app", hint: "/anniversary-reminder-app", href: "/seoteam/seo-pages/anniversary-reminder-app", group: "SEO pages" },
  { id: "seo-page-free", label: "Free birthday reminder app", hint: "/free", href: "/seoteam/seo-pages/free", group: "SEO pages" },
];

export function CommandPalette() {
  const router = useRouter();
  // The login screen is the one public page under /seoteam — no shortcut there.
  const onLoginScreen = usePathname() === "/seoteam/login";
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);
  const [dynamic, setDynamic] = React.useState<Command[] | null>(null);

  // Ctrl/Cmd+K anywhere, plus the header button's event.
  // Opening always starts from a clean slate — reset here rather than in an
  // effect that watches `open`.
  const openPalette = React.useCallback(() => {
    setQuery("");
    setCursor(0);
    setOpen(true);
  }, []);

  React.useEffect(() => {
    if (onLoginScreen) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((wasOpen) => {
          if (wasOpen) return false;
          setQuery("");
          setCursor(0);
          return true;
        });
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, openPalette);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, openPalette);
    };
  }, [onLoginScreen, openPalette]);

  // Load posts and pages the first time it's opened, not on every admin render.
  React.useEffect(() => {
    if (!open || dynamic) return;
    let cancelled = false;
    void (async () => {
      const commands: Command[] = [];
      try {
        const res = await fetch("/seoteam/api/posts");
        const data = (await res.json()) as { posts?: Post[] };
        for (const post of data.posts ?? []) {
          commands.push({
            id: `post-${post.id}`,
            label: post.title,
            hint: `/blog/${post.slug}`,
            href: `/seoteam/posts/${post.id}/edit`,
            group: "Posts",
          });
        }
      } catch {
        /* the palette still works without posts */
      }
      try {
        const res = await fetch("/seoteam/api/pages");
        const data = (await res.json()) as { pages?: SitePage[] };
        for (const page of data.pages ?? []) {
          commands.push({
            id: `page-${page.id}`,
            label: page.title,
            hint: `/${page.slug}`,
            href: `/seoteam/pages/${page.id}/edit`,
            group: "Pages",
          });
        }
      } catch {
        /* likewise */
      }
      if (!cancelled) setDynamic(commands);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, dynamic]);

  const all = React.useMemo(
    () => [...STATIC_COMMANDS, ...(dynamic ?? [])],
    [dynamic],
  );

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 12);
    return all
      .filter(
        (command) =>
          command.label.toLowerCase().includes(q) ||
          command.hint.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [all, query]);

  if (!open || onLoginScreen) return null;

  const go = (command: Command) => {
    setOpen(false);
    if (command.href.startsWith("/seoteam/api/")) window.location.href = command.href;
    else router.push(command.href);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search the admin"
    >
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-xl">
        <div className="flex items-center gap-2 border-b border-border-subtle px-3">
          <Search size={17} className="shrink-0 text-ink-muted" aria-hidden="true" />
          <Input
            // The field mounts with the palette, so autoFocus is enough — no
            // effect needed to steal focus.
            autoFocus
            value={query}
            placeholder="Search screens, posts, and pages…"
            aria-label="Search the admin"
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter" && results[cursor]) {
                e.preventDefault();
                go(results[cursor]);
              }
            }}
            className="border-0 bg-transparent px-0 focus:border-0"
          />
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            Nothing matches “{query}”.
          </p>
        ) : (
          <ul className="max-h-[50vh] overflow-y-auto py-1">
            {results.map((command, i) => (
              <li key={command.id}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(command)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2 text-left",
                    i === cursor ? "bg-biro-tint" : "hover:bg-surface-sunken",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{command.label}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {command.hint}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-muted">
                    {command.group}
                  </span>
                  {i === cursor && (
                    <CornerDownLeft size={14} className="shrink-0 text-biro" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
