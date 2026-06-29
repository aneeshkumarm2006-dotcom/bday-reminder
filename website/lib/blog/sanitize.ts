import sanitizeHtml from "sanitize-html";

/** Merge rel tokens, de-duped, order-stable. */
function mergeRel(existing: string | undefined, add: string): string {
  const set = new Set(
    `${existing ?? ""} ${add}`.split(/\s+/).filter(Boolean),
  );
  return [...set].join(" ");
}

/**
 * Sanitize rich HTML coming from the Tiptap editor (or pasted from Google
 * Docs/Word) before it is stored. This both removes dangerous markup (defense
 * in depth — the editor is password-gated) and strips the junk styling that
 * pasting from a word processor brings. Keyword backlinks are injected later at
 * render time (see keyword-links.ts), against this already-clean HTML.
 */
export function sanitizePostHtml(dirty: string): string {
  if (!dirty) return "";
  return sanitizeHtml(dirty, {
    allowedTags: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "strike", "mark",
      "sub", "sup", "h2", "h3", "h4", "ul", "ol", "li", "blockquote",
      "a", "img", "code", "pre", "hr", "figure", "figcaption",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "title"],
      img: ["src", "alt", "title", "width", "height"],
    },
    // Demote any pasted h1 to h2 so the page keeps a single h1 (the title).
    transformTags: {
      h1: sanitizeHtml.simpleTransform("h2", {}),
      a: (tagName, attribs) => {
        const out: Record<string, string> = { ...attribs };
        if (out.target === "_blank") {
          out.rel = mergeRel(out.rel, "noopener noreferrer");
        }
        return { tagName, attribs: out };
      },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowProtocolRelative: false,
    // `span`, inline styles, and classes aren't in the allow-lists above, so the
    // junk markup pasted from Google Docs/Word is dropped automatically.
  });
}
