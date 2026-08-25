import type * as React from "react";

/**
 * Shared shell for the legal / contact pages - a quiet, readable single column
 * (DESIGN.md §5). Prose styling is applied to plain semantic HTML via child
 * selectors so the pages read as clean markup.
 *
 * Pass `html` for admin-managed copy (sanitized on write) or `children` for
 * pages that are still JSX. `html` sets the prose container's own innerHTML
 * rather than nesting a wrapper div, so the `flex-col gap-6` rhythm applies to
 * the real paragraphs and headings.
 */
export function LegalPage({
  title,
  updated,
  intro,
  html,
  children,
}: {
  title: string;
  updated?: string;
  intro?: string;
  html?: string;
  children?: React.ReactNode;
}) {
  const proseClass =
    "mt-8 flex flex-col gap-6 leading-relaxed text-ink-secondary [&_a:not(.not-prose_*)]:text-biro [&_a:not(.not-prose_*)]:underline [&_a:not(.not-prose_*)]:underline-offset-2 [&_h2]:mt-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-1 [&_h3]:font-display [&_h3]:text-[17px] [&_h3]:font-semibold [&_h3]:text-ink [&_li]:ml-1 [&_strong]:font-medium [&_strong]:text-ink [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5";

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
      {html !== undefined ? (
        <div className={proseClass} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className={proseClass}>{children}</div>
      )}
      {html !== undefined && children ? (
        <div className="mt-8 flex flex-col gap-6">{children}</div>
      ) : null}
    </article>
  );
}
