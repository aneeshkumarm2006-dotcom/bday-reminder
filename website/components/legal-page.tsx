import type * as React from "react";

/**
 * Shared shell for the legal / contact pages - a quiet, readable single column
 * (DESIGN.md §5). Prose styling is applied to plain semantic HTML via child
 * selectors so the pages read as clean markup.
 */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated?: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-2xl px-5 py-16">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.01em] text-ink sm:text-4xl">
        {title}
      </h1>
      {updated ? (
        <p className="mt-3 text-sm text-ink-muted">Last updated {updated}</p>
      ) : null}
      {intro ? (
        <p className="mt-5 text-lg leading-relaxed text-ink-secondary">{intro}</p>
      ) : null}
      <div
        className="mt-8 flex flex-col gap-6 leading-relaxed text-ink-secondary [&_a]:text-biro [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-1 [&_strong]:font-medium [&_strong]:text-ink [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5"
      >
        {children}
      </div>
    </article>
  );
}
