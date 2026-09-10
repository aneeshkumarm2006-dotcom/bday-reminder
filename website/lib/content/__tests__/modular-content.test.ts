import { describe, expect, it } from "vitest";

import { BLOCK_DEFINITIONS, blockDefinitionsByGroup, blockTitle } from "../blocks";
import {
  ADDABLE_SECTION_TYPES,
  DEFAULT_BUILT_IN_PAGES,
  DEFAULT_LANDING,
  SECTION_TEMPLATES,
} from "../defaults";
import { isKnownIcon } from "../icons";
import { sanitizeBlocks, sanitizeLandingSections } from "../sanitize-blocks";
import { SEO_LANDING_PAGES } from "../seo-pages";
import { DEFAULT_SEO_SECTION_ORDER } from "../seo-pages/types";
import type { PageBlock } from "../types";
import {
  builtInPagesSchema,
  landingSectionSchema,
  pageBlockSchema,
  seoPageContentSchema,
} from "../validation";

/**
 * The modular-content contract: every block in the palette can be created,
 * validated, titled and rendered; every surface that holds blocks sanitizes
 * them; and every keyword page ships a complete layout.
 */
describe("the block palette", () => {
  it("mints a valid block for every entry", () => {
    for (const definition of BLOCK_DEFINITIONS) {
      const created = definition.create(`test-${definition.type}`);
      const parsed = pageBlockSchema.safeParse(created);
      expect(parsed.success, `${definition.type}: ${JSON.stringify(parsed)}`).toBe(true);
    }
  });

  it("gives every block a title, even an empty one", () => {
    for (const definition of BLOCK_DEFINITIONS) {
      const title = blockTitle(definition.create(`test-${definition.type}`));
      expect(title.length, definition.type).toBeGreaterThan(0);
    }
  });

  it("uses only icons the renderer can resolve", () => {
    for (const definition of BLOCK_DEFINITIONS) {
      expect(isKnownIcon(definition.icon), definition.icon).toBe(true);
    }
  });

  it("puts every block in exactly one group", () => {
    const grouped = blockDefinitionsByGroup().flatMap((group) => group.blocks);
    expect(grouped).toHaveLength(BLOCK_DEFINITIONS.length);
    expect(new Set(grouped.map((b) => b.type)).size).toBe(BLOCK_DEFINITIONS.length);
  });

  it("covers the blocks the goal called for: images, HTML, video", () => {
    const types = BLOCK_DEFINITIONS.map((definition) => definition.type);
    expect(types).toContain("image");
    expect(types).toContain("gallery");
    expect(types).toContain("html");
    expect(types).toContain("video");
  });
});

describe("landing sections", () => {
  it("validates the template for every addable section type", () => {
    for (const type of ADDABLE_SECTION_TYPES) {
      const parsed = landingSectionSchema.safeParse(SECTION_TEMPLATES[type]);
      expect(parsed.success, `${type}: ${JSON.stringify(parsed)}`).toBe(true);
    }
  });

  it("never offers a second hero — a page gets one h1", () => {
    expect(ADDABLE_SECTION_TYPES).not.toContain("hero");
  });

  it("accepts a blocks section carrying page-builder blocks", () => {
    const parsed = landingSectionSchema.safeParse({
      id: "extra",
      type: "blocks",
      visible: true,
      anchor: "extra",
      heading: "More",
      sub: "",
      background: "sunken",
      blocks: [{ id: "img", type: "image", imageUrl: "/x.png", imageAlt: "x" }],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("sanitizing on write", () => {
  const dirty: PageBlock[] = [
    { id: "a", type: "html", html: '<p onclick="x()">hi</p><script>bad()</script>', width: "wide", background: "none" },
    { id: "b", type: "richText", html: '<p>ok</p><script>bad()</script>' },
  ];

  it("cleans both markup-bearing block types", () => {
    const [html, rich] = sanitizeBlocks(dirty);
    expect(html.type === "html" && html.html).toContain("hi");
    expect(JSON.stringify(html)).not.toContain("onclick");
    expect(JSON.stringify(html)).not.toContain("bad()");
    expect(JSON.stringify(rich)).not.toContain("bad()");
  });

  it("reaches blocks nested inside a landing section", () => {
    const [section] = sanitizeLandingSections([
      {
        id: "extra",
        type: "blocks",
        visible: true,
        anchor: "",
        heading: "",
        sub: "",
        background: "none",
        blocks: dirty,
      },
    ]);
    expect(JSON.stringify(section)).not.toContain("bad()");
  });

  it("leaves blocks with no markup untouched", () => {
    const blocks: PageBlock[] = [{ id: "s", type: "spacer", size: "md", rule: false }];
    expect(sanitizeBlocks(blocks)).toEqual(blocks);
  });
});

describe("keyword landing pages", () => {
  it("ships a layout covering every band the page actually has", () => {
    for (const page of SEO_LANDING_PAGES) {
      const sections = page.layout
        .filter((item) => item.kind === "section")
        .map((item) => (item.kind === "section" ? item.section : ""));
      const expected = DEFAULT_SEO_SECTION_ORDER.filter(
        (key) => key !== "download" || Boolean(page.download),
      );
      expect(sections, page.slug).toEqual([...expected]);
      expect(page.layout.every((item) => item.visible), page.slug).toBe(true);
    }
  });

  it("ships a photograph with real alt text and a measured size", () => {
    for (const page of SEO_LANDING_PAGES) {
      const { photo } = page;
      expect(photo.imageUrl, page.slug).toMatch(/^https:\/\//);
      // A content image with no alt is the one image-SEO/a11y failure that
      // matters, and the band is only worth having if it's described.
      expect(photo.imageAlt.trim().length, page.slug).toBeGreaterThan(10);
      expect(photo.imageAlt.trim().length, page.slug).toBeLessThanOrEqual(300);
      // Without both dimensions the renderer can't reserve the box, and the
      // photo shoves the rest of the page down as it loads (CLS).
      expect(photo.width, page.slug).toBeGreaterThan(0);
      expect(photo.height, page.slug).toBeGreaterThan(0);
    }
  });

  it("gives each page its own photograph rather than one shared stock shot", () => {
    const urls = SEO_LANDING_PAGES.map((page) => page.photo.imageUrl);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("gives every page a hero second button and a related strip", () => {
    for (const page of SEO_LANDING_PAGES) {
      expect(page.hero.secondaryCta.label, page.slug).not.toBe("");
      expect(page.related.heading, page.slug).not.toBe("");
      expect(page.related.ctaLabel, page.slug).not.toBe("");
    }
  });

  it("accepts a layout with a block group slotted between two bands", () => {
    const page = SEO_LANDING_PAGES[0];
    const parsed = seoPageContentSchema.safeParse({
      ...page,
      layout: [
        { id: "slot-hero", kind: "section", section: "hero", visible: true },
        {
          id: "group-1",
          kind: "blocks",
          visible: true,
          heading: "Extra",
          sub: "",
          background: "none",
          blocks: [{ id: "q", type: "quote", quote: "Good", author: "A", role: "", imageUrl: "" }],
        },
        { id: "slot-faq", kind: "section", section: "faq", visible: false },
      ],
    });
    expect(parsed.success, JSON.stringify(parsed)).toBe(true);
  });
});

describe("built-in pages", () => {
  it("validates the shipped defaults", () => {
    const parsed = builtInPagesSchema.safeParse(DEFAULT_BUILT_IN_PAGES);
    expect(parsed.success, JSON.stringify(parsed)).toBe(true);
  });

  it("keeps the contact guidance as an editable block, not hardcoded JSX", () => {
    const [block] = DEFAULT_BUILT_IN_PAGES.contact.blocksAfter;
    expect(block.type).toBe("html");
    expect(block.type === "html" && block.html).toContain("What to write to us about");
  });

  it("survives the sanitizer it is written through", () => {
    const cleaned = sanitizeBlocks(DEFAULT_BUILT_IN_PAGES.contact.blocksAfter);
    const [block] = cleaned;
    expect(block.type === "html" && block.html).toContain("What to write to us about");
    expect(block.type === "html" && block.html).toContain('href="/privacy"');
  });
});

describe("the homepage photograph", () => {
  const section = DEFAULT_LANDING.sections.find((item) => item.type === "photo");

  it("ships one, described and measured", () => {
    expect(section).toBeDefined();
    if (section?.type !== "photo") throw new Error("not a photo section");
    expect(section.photo.imageUrl).toMatch(/^https:\/\//);
    expect(section.photo.imageAlt.trim().length).toBeGreaterThan(10);
    expect(section.photo.width).toBeGreaterThan(0);
    expect(section.photo.height).toBeGreaterThan(0);
  });

  it("survives a save/validate round trip", () => {
    const parsed = landingSectionSchema.safeParse(section);
    expect(parsed.success, JSON.stringify(parsed)).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual(section);
  });

  it("keeps a bad measurement out of the markup rather than failing the save", () => {
    const parsed = landingSectionSchema.safeParse({
      ...SECTION_TEMPLATES.photo,
      photo: {
        imageUrl: "https://example.com/a.webp",
        imageAlt: "A cake",
        caption: "",
        width: -4,
        height: Number.NaN,
      },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.type === "photo") {
      expect(parsed.data.photo.width).toBe(0);
      expect(parsed.data.photo.height).toBe(0);
    }
  });
});
