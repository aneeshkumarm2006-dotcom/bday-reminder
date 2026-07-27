import { jsonLdScript } from "@/lib/blog/url";
import { validateJsonLd } from "@/lib/content/validation";

/**
 * Renders the per-page custom JSON-LD an editor entered in the Meta manager.
 *
 * Three locks, because this is the one field where an admin supplies markup:
 * it's validated on write (parseable JSON, allowlisted `@type`), re-validated
 * here on read (a document could predate a tightened allowlist), and emitted
 * through `jsonLdScript()`, which escapes `<`, `>` and `&` so a `</script>`
 * inside a string can't break out of the tag.
 */
export function CustomJsonLd({ json }: { json: string }) {
  const value = json?.trim();
  if (!value) return null;
  if (!validateJsonLd(value).ok) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScript(parsed) }}
    />
  );
}
