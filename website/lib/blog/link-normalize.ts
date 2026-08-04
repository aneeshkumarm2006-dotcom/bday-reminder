// `@/lib/content/routes` re-exports this, but importing it from there would
// drag that module's Mongo reads into the blog editor's client bundle.
import { STATIC_ROUTES } from "@/lib/content/static-routes";
import { siteConfig } from "@/lib/site";

/**
 * Repairs the hrefs inside post bodies that were written before the rename and
 * before the site settled on one canonical origin.
 *
 * Post HTML lives in Mongo and is edited by hand, so it still carries three
 * kinds of stale link that a crawler counts against us: the dead former brand
 * domain (`circlethedate.app`), plain-`http://` links to our own site, and apex
 * links that 308 to the `www.` canonical. None of them can be fixed in the
 * database from here, so they're fixed on the way out — at render time, on the
 * one seam both the public post page and the /seoteam preview share.
 */

const CANONICAL_HOST = new URL(siteConfig.url).hostname.toLowerCase();
const APEX_HOST = CANONICAL_HOST.replace(/^www\./, "");

/**
 * Hosts that *are* this site. Whichever of them a link used, the fix is the
 * same: emit a root-relative href. That's redirect-proof (no scheme, no host, so
 * it can never point at the side of the apex/`www.` 308 that costs a hop) and it
 * keeps working if NEXT_PUBLIC_SITE_URL is ever flipped between the two.
 */
const OWN_HOSTS = new Set([CANONICAL_HOST, APEX_HOST, `www.${APEX_HOST}`]);

/**
 * The retired brand domain. It no longer resolves, so every link still pointing
 * at it is a broken external link — but the paths mostly still exist here, so
 * they're worth carrying over rather than deleting.
 */
const RETIRED_HOSTS = new Set(["circlethedate.app", "www.circlethedate.app"]);

/**
 * The paths we're willing to carry a retired-domain link over to. Anything else
 * would trade a broken external link for a fresh 404, which is worse, so it goes
 * to the homepage instead.
 */
const KNOWN_PATHS = new Set(STATIC_ROUTES.map((route) => route.path.toLowerCase()));

/** Posts are generated from slugs, so they can't be listed in the route registry. */
const BLOG_POST_PATH = /^\/blog\/[^/]+$/;

/** Matches an anchor's opening tag; the body is well-formed (sanitize.ts wrote it). */
const ANCHOR_TAG = /<a\b[^>]*>/gi;

/**
 * The `href` attribute inside one such tag, in any of the three quoting styles.
 * The leading `\s` is what keeps `data-href` and friends out of the match.
 */
const HREF_ATTR = /(\shref\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

function decodeAttr(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Path + query + hash, i.e. everything that survives dropping our own origin.
 * The trailing slash goes with it: Next serves these routes without one, so
 * `/privacy/` would redirect exactly the way the apex host does.
 */
function toRootRelative(url: URL): string {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return `${path}${url.search}${url.hash}`;
}

function isKnownPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "").toLowerCase() || "/";
  return KNOWN_PATHS.has(path) || BLOG_POST_PATH.test(path);
}

/**
 * The whole rewrite, for one href. Exported on its own because the same rule has
 * to apply to hrefs that never pass through a post body: the ones an editor
 * types into the sanitizer, and the destination URLs on keyword backlink rows.
 *
 * Anything it doesn't recognise — relative paths, bare fragments, `mailto:`,
 * `tel:`, other people's sites, values that aren't URLs at all — comes back
 * byte-identical, so it is safe to run over every link on the page.
 */
export function normalizeHref(href: string): string {
  if (!href) return href;
  const raw = href.trim();
  if (!raw) return href;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return href;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return href;

  const host = url.hostname.toLowerCase();
  if (OWN_HOSTS.has(host)) return toRootRelative(url);
  if (RETIRED_HOSTS.has(host)) {
    return isKnownPath(url.pathname) ? toRootRelative(url) : "/";
  }

  // Our other subdomains (the web app) are real, separate origins, so they keep
  // their absolute href — but there's no reason for one of them to be http.
  if (host.endsWith(`.${APEX_HOST}`)) {
    if (url.protocol === "http:") {
      url.protocol = "https:";
      return url.toString();
    }
  }

  return href;
}

/**
 * Rewrites every anchor href in a post body.
 *
 * Deliberately rewrites the `href` attribute in place instead of re-parsing and
 * re-serialising the document: the body is already sanitize-html's own output,
 * so a second full pass would buy nothing and would rewrite markup we have no
 * business touching. Every tag whose href doesn't change is returned untouched,
 * which also makes the function idempotent.
 *
 * `rel` is left alone on purpose — sanitize.ts already merges
 * `noopener noreferrer` onto anything with `target="_blank"` at save time, and
 * adding it again here would mutate anchors this pass has no reason to touch.
 */
export function normalizePostLinks(html: string): string {
  if (!html) return html;
  return html.replace(ANCHOR_TAG, (tag) => {
    const match = HREF_ATTR.exec(tag);
    if (!match) return tag;
    const current = decodeAttr(match[2] ?? match[3] ?? match[4] ?? "");
    const next = normalizeHref(current);
    if (next === current) return tag;
    return (
      tag.slice(0, match.index) +
      `${match[1]}"${escapeAttr(next)}"` +
      tag.slice(match.index + match[0].length)
    );
  });
}

/** True for the hrefs this module emits for our own pages (they need no `target`). */
export function isInternalHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}
