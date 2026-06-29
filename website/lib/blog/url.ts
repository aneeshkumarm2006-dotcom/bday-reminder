/** True for an absolute http(s) URL (i.e. one a crawler can actually fetch). */
export function isHttpUrl(url: string | null | undefined): boolean {
  return Boolean(url && /^https?:\/\//i.test(url.trim()));
}

/**
 * Escape JSON for safe embedding inside a <script type="application/ld+json">.
 * JSON.stringify does NOT escape "<", ">" or "&", so a value containing
 * "</script>" would otherwise close the tag early (breaking the structured data
 * and opening an HTML-injection hole). Escaping them as \uXXXX keeps the JSON
 * valid while preventing premature tag termination.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(
    /[<>&]/g,
    (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}
