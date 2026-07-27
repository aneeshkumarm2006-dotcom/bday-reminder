import type { BlockType, PageBlock } from "./types";

/**
 * The page builder's palette. Each entry describes a block for the "add block"
 * menu and knows how to mint an empty one.
 *
 * Blocks reuse the landing page's section styling, so a custom page can't drift
 * from the brand — same constraint, same reasoning as the landing editor being
 * section-based rather than free-form.
 */
export interface BlockDefinition {
  type: BlockType;
  label: string;
  description: string;
  /** Curated lucide name for the palette (see lib/content/icons.ts). */
  icon: string;
  create: (id: string) => PageBlock;
}

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    type: "hero",
    label: "Hero",
    description: "Big heading, intro paragraph, and up to two buttons.",
    icon: "Sparkles",
    create: (id) => ({
      id,
      type: "hero",
      eyebrow: "",
      heading: "",
      body: "",
      primaryCta: { label: "", href: "/" },
      secondaryCta: { label: "", href: "/" },
    }),
  },
  {
    type: "richText",
    label: "Rich text",
    description: "Formatted prose, lists, links, and images.",
    icon: "ListChecks",
    create: (id) => ({ id, type: "richText", html: "" }),
  },
  {
    type: "featureGrid",
    label: "Feature grid",
    description: "Icon cards in a responsive grid.",
    icon: "Layers",
    create: (id) => ({ id, type: "featureGrid", heading: "", sub: "", items: [] }),
  },
  {
    type: "imageText",
    label: "Image + text",
    description: "An image beside a heading and paragraph.",
    icon: "Camera",
    create: (id) => ({
      id,
      type: "imageText",
      heading: "",
      body: "",
      imageUrl: "",
      imageAlt: "",
      imageSide: "left",
      cta: { label: "", href: "/" },
    }),
  },
  {
    type: "stats",
    label: "Stats",
    description: "A row of big numbers with labels.",
    icon: "TrendingUp",
    create: (id) => ({ id, type: "stats", heading: "", items: [] }),
  },
  {
    type: "testimonials",
    label: "Testimonials",
    description: "Quotes with an attribution line.",
    icon: "MessageCircle",
    create: (id) => ({ id, type: "testimonials", heading: "", items: [] }),
  },
  {
    type: "comparisonTable",
    label: "Comparison table",
    description: "A simple table of rows and columns.",
    icon: "ListChecks",
    create: (id) => ({ id, type: "comparisonTable", heading: "", columns: [], rows: [] }),
  },
  {
    type: "faq",
    label: "FAQ",
    description: "Accordion questions, also emitted as FAQPage structured data.",
    icon: "Search",
    create: (id) => ({ id, type: "faq", heading: "", sub: "", items: [] }),
  },
  {
    type: "cta",
    label: "Call to action",
    description: "A bordered panel with a heading and one button.",
    icon: "Rocket",
    create: (id) => ({
      id,
      type: "cta",
      heading: "",
      body: "",
      cta: { label: "", href: "/signup" },
      footnote: "",
    }),
  },
  {
    type: "divider",
    label: "Divider",
    description: "A hairline rule, optionally labelled.",
    icon: "Repeat",
    create: (id) => ({ id, type: "divider", label: "" }),
  },
];

export const BLOCK_BY_TYPE: Record<BlockType, BlockDefinition> = Object.fromEntries(
  BLOCK_DEFINITIONS.map((definition) => [definition.type, definition]),
) as Record<BlockType, BlockDefinition>;

/** Human label for a block row in the builder's list. */
export function blockTitle(block: PageBlock): string {
  switch (block.type) {
    case "hero":
    case "featureGrid":
    case "faq":
    case "cta":
    case "imageText":
    case "stats":
    case "testimonials":
    case "comparisonTable":
      return block.heading || BLOCK_BY_TYPE[block.type].label;
    case "richText": {
      const text = block.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      return text ? text.slice(0, 60) : "Rich text";
    }
    case "divider":
      return block.label || "Divider";
    default:
      return "Block";
  }
}
