import sanitizeHtml from "sanitize-html";

import { normalizeHref } from "@/lib/blog/link-normalize";

/**
 * The sanitizer for the page builder's **HTML block** — the "put anything here"
 * escape hatch.
 *
 * It is deliberately wider than `lib/blog/sanitize.ts` (which powers the blog
 * body and the rich-text block, and stays narrow so pasted Word markup is
 * flattened): here the admin is *writing* markup on purpose, so tables, layout
 * divs, spans, classes, inline styles, and embeds all have to survive.
 *
 * What it still refuses, because a shared-password admin is exactly the threat
 * model that needs a second lock:
 *
 *   - `<script>`, `<style>`, `<object>`, `<embed>`, `<form>`, `<input>` — no
 *     executable markup and no credential-shaped inputs;
 *   - every `on*` handler attribute (they are simply not on any allow-list);
 *   - `javascript:` in any URL — the scheme allow-list drops it;
 *   - `<iframe>` from anywhere but `EMBED_HOSTS`, and never without sandboxing
 *     attributes it doesn't need;
 *   - CSS values containing `javascript:`, `expression(`, `@import` or
 *     `behavior:`.
 *
 * The result is a block that can hold a YouTube embed, a Google Map, a pricing
 * table, or a hand-written layout — and cannot hold a payload.
 */

/** Hosts an `<iframe>` may point at. Add a line to allow another provider. */
export const EMBED_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "vimeo.com",
  "www.google.com",
  "maps.google.com",
  "open.spotify.com",
  "w.soundcloud.com",
  "docs.google.com",
  "drive.google.com",
  "calendly.com",
  "form.typeform.com",
  "share.transistor.fm",
  "www.loom.com",
  "share.descript.com",
];

/**
 * A CSS value we'll keep. Blocks the four constructs that turn a style
 * attribute into code, and anything with markup in it; everything else — colour
 * functions, `url(https://…)`, custom properties — passes through.
 */
const SAFE_CSS_VALUE =
  /^(?!.*(?:javascript\s*:|expression\s*\(|@import|behaviou?r\s*:|-moz-binding))[^<>]*$/i;

/** Properties an admin may set inline. Anything else is dropped silently. */
const STYLE_PROPERTIES = [
  "align-content",
  "align-items",
  "align-self",
  "aspect-ratio",
  "background",
  "background-color",
  "background-image",
  "background-position",
  "background-repeat",
  "background-size",
  "border",
  "border-bottom",
  "border-color",
  "border-left",
  "border-radius",
  "border-right",
  "border-style",
  "border-top",
  "border-width",
  "bottom",
  "box-shadow",
  "clear",
  "color",
  "column-gap",
  "cursor",
  "display",
  "flex",
  "flex-basis",
  "flex-direction",
  "flex-grow",
  "flex-shrink",
  "flex-wrap",
  "float",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "gap",
  "grid-column",
  "grid-row",
  "grid-template-columns",
  "grid-template-rows",
  "height",
  "justify-content",
  "justify-items",
  "left",
  "letter-spacing",
  "line-height",
  "list-style",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "object-fit",
  "opacity",
  "order",
  "overflow",
  "overflow-x",
  "overflow-y",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "right",
  "row-gap",
  "text-align",
  "text-decoration",
  "text-transform",
  "top",
  "transform",
  "transition",
  "vertical-align",
  "white-space",
  "width",
  "word-break",
  "z-index",
];

const allowedStyles: Record<string, Record<string, RegExp[]>> = {
  "*": Object.fromEntries(
    STYLE_PROPERTIES.map((property) => [property, [SAFE_CSS_VALUE]]),
  ),
};

/** Merge rel tokens, de-duped, order-stable. */
function mergeRel(existing: string | undefined, add: string): string {
  return [...new Set(`${existing ?? ""} ${add}`.split(/\s+/).filter(Boolean))].join(" ");
}

export function sanitizeEmbedHtml(dirty: string): string {
  if (!dirty) return "";
  return sanitizeHtml(dirty, {
    allowedTags: [
      "p", "br", "hr", "div", "span", "section", "article", "aside", "header",
      "footer", "main", "nav",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "strong", "b", "em", "i", "u", "s", "strike", "mark", "small", "sub", "sup",
      "abbr", "cite", "q", "time", "kbd", "samp", "var",
      "ul", "ol", "li", "dl", "dt", "dd",
      "blockquote", "pre", "code",
      "a", "img", "picture", "source", "figure", "figcaption",
      "video", "audio", "track",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
      "details", "summary",
      "iframe",
      "svg", "path", "circle", "rect", "line", "polyline", "polygon", "g",
    ],
    allowedAttributes: {
      "*": ["class", "id", "style", "title", "dir", "lang", "role", "aria-label", "aria-hidden", "aria-describedby", "data-*"],
      a: ["href", "target", "rel", "download", "name"],
      img: ["src", "srcset", "sizes", "alt", "width", "height", "loading", "decoding"],
      source: ["src", "srcset", "sizes", "type", "media"],
      video: ["src", "poster", "controls", "muted", "loop", "playsinline", "preload", "width", "height"],
      audio: ["src", "controls", "loop", "preload"],
      track: ["src", "kind", "srclang", "label", "default"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "loading", "referrerpolicy", "frameborder"],
      td: ["colspan", "rowspan", "headers", "scope"],
      th: ["colspan", "rowspan", "headers", "scope", "abbr"],
      col: ["span"],
      colgroup: ["span"],
      ol: ["start", "reversed", "type"],
      time: ["datetime"],
      details: ["open"],
      svg: ["viewBox", "xmlns", "width", "height", "fill", "stroke", "stroke-width", "aria-hidden", "focusable"],
      path: ["d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin"],
      circle: ["cx", "cy", "r", "fill", "stroke", "stroke-width"],
      rect: ["x", "y", "width", "height", "rx", "ry", "fill", "stroke", "stroke-width"],
      line: ["x1", "y1", "x2", "y2", "stroke", "stroke-width"],
      polyline: ["points", "fill", "stroke", "stroke-width"],
      polygon: ["points", "fill", "stroke", "stroke-width"],
      g: ["fill", "stroke", "stroke-width", "transform"],
    },
    allowedStyles,
    // Anything not listed above is dropped, `on*` handlers included — there is
    // no wildcard that could let one through.
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"], source: ["http", "https", "data"] },
    allowProtocolRelative: false,
    allowedIframeHostnames: EMBED_HOSTS,
    allowIframeRelativeUrls: false,
    // `script` and `style` bodies are discarded wholesale rather than left as
    // escaped text, which is what `nonTextTags` controls.
    nonTextTags: ["script", "style", "textarea", "option", "noscript"],
    transformTags: {
      a: (tagName, attribs) => {
        const out: Record<string, string> = { ...attribs };
        if (out.href) out.href = normalizeHref(out.href);
        if (out.target === "_blank") out.rel = mergeRel(out.rel, "noopener noreferrer");
        return { tagName, attribs: out };
      },
      iframe: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          loading: attribs.loading || "lazy",
          referrerpolicy: attribs.referrerpolicy || "strict-origin-when-cross-origin",
        },
      }),
    },
  });
}

/**
 * Which hosts an admin's `<iframe>` was rejected for, so the editor can say why
 * an embed vanished instead of silently swallowing it.
 */
export function blockedEmbedHosts(html: string): string[] {
  const out = new Set<string>();
  for (const match of html.matchAll(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const host = new URL(match[1], "https://example.invalid").hostname;
      if (host !== "example.invalid" && !EMBED_HOSTS.includes(host)) out.add(host);
    } catch {
      // An unparseable src is dropped by the sanitizer anyway.
    }
  }
  return [...out];
}
