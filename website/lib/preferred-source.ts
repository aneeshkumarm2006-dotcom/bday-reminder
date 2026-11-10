import { siteConfig } from "@/lib/site";

/**
 * Google Preferred Sources — the shared constants and the blog shortcode.
 *
 * Follows https://developers.google.com/search/docs/appearance/preferred-sources:
 * the "advanced" setup (Google's library in manual mode, our own button calls
 * `addPreferredSource()`) so the button matches the site, with the plain
 * deeplink as the button's `href` for when the library hasn't loaded, is
 * blocked, or JavaScript is off.
 *
 * Isomorphic on purpose: the server renders the deeplink, the client loads the
 * library, and the blog pipeline strips the shortcode — all from this file.
 */

/** Google's library, exactly as the docs give it. */
export const PREFERRED_SOURCE_SCRIPT_SRC = "https://news.google.com/swg/js/v1/publisher.js";

/**
 * The domain readers add. Taken from the deploy's canonical origin
 * (`NEXT_PUBLIC_SITE_URL`, `https://www.birthdayreminders.us` in production),
 * never from the request, so a preview deployment can't point readers at
 * itself. Google accepts domain- and subdomain-level sites; `www.` is the
 * latter and is the host the live site actually serves.
 */
export function preferredSourceHost(): string {
  try {
    return new URL(siteConfig.url).host;
  } catch {
    return "www.birthdayreminders.us";
  }
}

/** The no-JavaScript route: `https://www.google.com/preferences/source?q=<site>`. */
export function preferredSourceDeeplink(host: string = preferredSourceHost()): string {
  return `https://www.google.com/preferences/source?q=${encodeURIComponent(host)}`;
}

/** The card's pitch, used wherever no admin-written copy replaces it. */
export const PREFERRED_SOURCE_DEFAULT_HEADING = "Want more of our guides in your Google results?";
export const PREFERRED_SOURCE_DEFAULT_BODY =
  "Mark us as a preferred source and Google will show our articles more often in Top Stories when you search for something we've written about.";

/**
 * Typed into a post body on a line of its own, this drops the preferred-source
 * card at that spot. Plain text rather than markup so it survives the editor,
 * the sanitizer, and an HTML-source round trip unchanged.
 */
export const PREFERRED_SOURCE_SHORTCODE = "[preferred-source]";

// A paragraph holding only the shortcode (what the editor produces), or the
// bare token anywhere else. Case-insensitive; `&nbsp;` padding tolerated.
const SHORTCODE_PATTERN =
  /<p\b[^>]*>(?:\s|&nbsp;)*\[preferred-source\](?:\s|&nbsp;)*<\/p>|\[preferred-source\]/gi;

/**
 * Split sanitized post HTML at each shortcode. One segment means no shortcode;
 * N segments means N-1 cards go between them. Empty segments are kept so the
 * caller can tell "card at the very top" from "no card".
 */
export function splitOnPreferredSource(html: string): string[] {
  return (html || "").split(SHORTCODE_PATTERN);
}

/** Remove the shortcode from text or HTML (meta descriptions, word counts). */
export function stripPreferredSourceShortcode(text: string): string {
  return (text || "").replace(SHORTCODE_PATTERN, " ");
}
