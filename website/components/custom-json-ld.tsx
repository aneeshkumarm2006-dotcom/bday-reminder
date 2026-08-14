import { jsonLdScript } from "@/lib/blog/url";
import { filterCustomNodes } from "@/lib/content/page-graph";
import { validateJsonLd } from "@/lib/content/validation";

/**
 * Renders the per-page custom JSON-LD an editor entered in the Meta manager.
 *
 * Four locks, because this is the one field where an admin supplies markup:
 * it's validated on write (parseable JSON, allowlisted `@type`, plus route-aware
 * conflict checks), re-validated here on read (a document could predate a
 * tightened allowlist), filtered against what the page's own graph already
 * claims, and emitted through `jsonLdScript()`, which escapes `<`, `>` and `&`
 * so a `</script>` inside a string can't break out of the tag.
 *
 * The filter is the safety net rather than the main defence — new pastes are
 * refused at write time with an explanation, because a silent strip leaves an
 * editor looking at a field that saved fine and does nothing. It exists for
 * documents stored before that check did.
 *
 * Kept as its own `<script>` rather than merged into the page graph: multiple
 * ld+json blocks on a page are fine, and merging would mean rewriting an
 * editor's markup into a shape they didn't author.
 */
export function CustomJsonLd({
  json,
  reserved,
}: {
  json: string;
  reserved?: { ids: string[]; types: string[] };
}) {
  const value = json?.trim();
  if (!value) return null;
  if (!validateJsonLd(value).ok) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  const filtered = reserved ? filterCustomNodes(parsed, reserved) : parsed;
  if (filtered === null) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScript(filtered) }}
    />
  );
}
