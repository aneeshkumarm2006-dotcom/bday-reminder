import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Layout primitives shared by every admin editor, so the settings, meta,
 * landing, pages, nav and redirect screens all read as one product rather than
 * nine. Server-safe (no hooks) — the interactive parts live in the client
 * components that compose these.
 */

export function AdminPage({
  title,
  description,
  actions,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full px-5 py-8",
        wide ? "max-w-6xl" : "max-w-4xl",
      )}
    >
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </main>
  );
}

export function AdminSection({
  title,
  description,
  children,
  tone = "default",
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "mb-6 rounded-lg border bg-surface p-5",
        tone === "danger" ? "border-danger-fg/40" : "border-border-subtle",
        className,
      )}
    >
      <div className="mb-4">
        <h2
          className={cn(
            "font-display text-base font-semibold",
            tone === "danger" ? "text-danger-fg" : "text-ink",
          )}
        >
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** Two-column-on-desktop grid for pairs of short fields. */
export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

/** Empty state mirroring the blog dashboard's "no MONGODB_URI" messaging. */
export function DbMissingNotice({ what }: { what: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-warn-bg p-5 text-sm text-warn-fg">
      <p className="font-medium">The database isn&apos;t connected.</p>
      <p className="mt-1">
        Set <code>MONGODB_URI</code> in <code>website/.env.local</code> to edit {what}.
        Until then the public site renders its built-in defaults.
      </p>
    </div>
  );
}
