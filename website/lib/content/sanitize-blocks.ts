import { sanitizePostHtml } from "@/lib/blog/sanitize";

import { sanitizeEmbedHtml } from "./sanitize-embed";
import type { LandingSection, PageBlock } from "./types";
import type { SeoLayoutItem } from "./seo-pages/types";

/**
 * Clean every piece of editor-supplied markup on its way into Mongo.
 *
 * Two policies, because the two blocks mean different things:
 *   - `richText` is the WYSIWYG block, so it gets the blog's narrow policy —
 *     pasting from Word must not smuggle a wall of `<span style>` into the page.
 *   - `html` is the deliberate escape hatch, so it gets the wider embed policy
 *     (`sanitize-embed.ts`): tables, layout divs, inline styles and allow-listed
 *     iframes survive; scripts, handlers and unknown embed hosts do not.
 *
 * Sanitizing here rather than in each route handler means every write path —
 * the page builder, the landing editor, the keyword pages, the built-in pages,
 * and the import bundle — is covered by construction. Nothing that renders
 * `dangerouslySetInnerHTML` reads a string that didn't pass through here.
 */
export function sanitizeBlocks(blocks: PageBlock[]): PageBlock[] {
  return blocks.map((block) => {
    if (block.type === "richText") return { ...block, html: sanitizePostHtml(block.html) };
    if (block.type === "html") return { ...block, html: sanitizeEmbedHtml(block.html) };
    return block;
  });
}

/** The same pass over a landing page's sections — only `blocks` sections carry markup. */
export function sanitizeLandingSections(sections: LandingSection[]): LandingSection[] {
  return sections.map((section) =>
    section.type === "blocks" ? { ...section, blocks: sanitizeBlocks(section.blocks) } : section,
  );
}

/** …and over a keyword page's layout rows. */
export function sanitizeSeoLayout(layout: SeoLayoutItem[]): SeoLayoutItem[] {
  return layout.map((item) =>
    item.kind === "blocks" ? { ...item, blocks: sanitizeBlocks(item.blocks) } : item,
  );
}
