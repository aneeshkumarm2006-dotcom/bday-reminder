import { PreferredSourceButton } from "@/components/preferred-source/preferred-source-button";
import {
  PREFERRED_SOURCE_DEFAULT_BODY,
  PREFERRED_SOURCE_DEFAULT_HEADING,
  preferredSourceDeeplink,
} from "@/lib/preferred-source";
import { cn } from "@/lib/utils";

/**
 * The preferred-source card: a short pitch and the button. Used at the end of
 * every blog post, wherever `[preferred-source]` sits in a post body, and as the
 * "Preferred source" page-builder block. Server component — only the button
 * inside it ships JavaScript.
 *
 * Styled like the page builder's Callout block so it reads as part of the site,
 * not as an embed.
 */
export function PreferredSourceCallout({
  heading = PREFERRED_SOURCE_DEFAULT_HEADING,
  body = PREFERRED_SOURCE_DEFAULT_BODY,
  className,
}: {
  heading?: string;
  body?: string;
  className?: string;
}) {
  return (
    <aside
      aria-label="Follow us on Google"
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface p-5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {heading && <p className="font-display text-lg font-semibold text-ink">{heading}</p>}
        {body && (
          <p className="mt-1 text-pretty text-sm leading-relaxed text-ink-secondary">{body}</p>
        )}
      </div>
      <PreferredSourceButton href={preferredSourceDeeplink()} className="shrink-0 sm:self-center" />
    </aside>
  );
}
