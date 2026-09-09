import type { BlockType, PageBlock } from "./types";

/**
 * The page builder's palette. Each entry describes a block for the "add block"
 * menu and knows how to mint an empty one.
 *
 * Blocks reuse the landing page's section styling, so a custom page can't drift
 * from the brand — same constraint, same reasoning as the landing editor being
 * section-based rather than free-form.
 */
export type BlockGroup = "Layout" | "Media" | "Content" | "Conversion";

export interface BlockDefinition {
  type: BlockType;
  label: string;
  description: string;
  /** Curated lucide name for the palette (see lib/content/icons.ts). */
  icon: string;
  /** Which heading the block sits under in the "add block" menu. */
  group: BlockGroup;
  create: (id: string) => PageBlock;
}

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    type: "hero",
    label: "Hero",
    description: "Big heading, intro paragraph, and up to two buttons.",
    icon: "Sparkles",
    group: "Layout",
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
    group: "Content",
    create: (id) => ({ id, type: "richText", html: "" }),
  },
  {
    type: "featureGrid",
    label: "Feature grid",
    description: "Icon cards in a responsive grid.",
    icon: "Layers",
    group: "Content",
    create: (id) => ({ id, type: "featureGrid", heading: "", sub: "", items: [] }),
  },
  {
    type: "imageText",
    label: "Image + text",
    description: "An image beside a heading and paragraph.",
    icon: "Camera",
    group: "Media",
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
    group: "Content",
    create: (id) => ({ id, type: "stats", heading: "", items: [] }),
  },
  {
    type: "testimonials",
    label: "Testimonials",
    description: "Quotes with an attribution line.",
    icon: "MessageCircle",
    group: "Content",
    create: (id) => ({ id, type: "testimonials", heading: "", items: [] }),
  },
  {
    type: "comparisonTable",
    label: "Comparison table",
    description: "A simple table of rows and columns.",
    icon: "ListChecks",
    group: "Content",
    create: (id) => ({ id, type: "comparisonTable", heading: "", columns: [], rows: [] }),
  },
  {
    type: "faq",
    label: "FAQ",
    description: "Accordion questions, also emitted as FAQPage structured data.",
    icon: "Search",
    group: "Content",
    create: (id) => ({ id, type: "faq", heading: "", sub: "", items: [] }),
  },
  {
    type: "cta",
    label: "Call to action",
    description: "A bordered panel with a heading and one button.",
    icon: "Rocket",
    group: "Conversion",
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
    group: "Layout",
    create: (id) => ({ id, type: "divider", label: "" }),
  },
  {
    type: "image",
    label: "Image",
    description: "A single image with an optional caption and link.",
    icon: "Image",
    group: "Media",
    create: (id) => ({
      id,
      type: "image",
      imageUrl: "",
      imageAlt: "",
      caption: "",
      width: "wide",
      rounded: true,
      href: "",
    }),
  },
  {
    type: "gallery",
    label: "Image gallery",
    description: "A grid of images, two to four across.",
    icon: "Images",
    group: "Media",
    create: (id) => ({
      id,
      type: "gallery",
      heading: "",
      sub: "",
      columns: 3,
      items: [],
    }),
  },
  {
    type: "video",
    label: "Video",
    description: "A YouTube or Vimeo link, or a video file you host.",
    icon: "Play",
    group: "Media",
    create: (id) => ({
      id,
      type: "video",
      heading: "",
      url: "",
      caption: "",
      width: "wide",
      posterUrl: "",
    }),
  },
  {
    type: "logos",
    label: "Logo strip",
    description: "A quiet row of logos with an optional heading.",
    icon: "Building2",
    group: "Media",
    create: (id) => ({ id, type: "logos", heading: "", items: [], grayscale: true }),
  },
  {
    type: "html",
    label: "Custom HTML",
    description: "Write your own markup. Embeds allowed from known providers.",
    icon: "Code2",
    group: "Layout",
    create: (id) => ({ id, type: "html", html: "", width: "narrow", background: "none" }),
  },
  {
    type: "buttons",
    label: "Buttons",
    description: "A row of links styled as buttons.",
    icon: "MousePointerClick",
    group: "Conversion",
    create: (id) => ({ id, type: "buttons", heading: "", align: "center", items: [] }),
  },
  {
    type: "spacer",
    label: "Spacer",
    description: "Breathing room, with an optional hairline.",
    icon: "Minus",
    group: "Layout",
    create: (id) => ({ id, type: "spacer", size: "md", rule: false }),
  },
  {
    type: "steps",
    label: "Steps",
    description: "A numbered walk-through, three or four across.",
    icon: "Rows3",
    group: "Content",
    create: (id) => ({ id, type: "steps", heading: "", sub: "", numbered: true, items: [] }),
  },
  {
    type: "pricing",
    label: "Pricing",
    description: "Plan cards with a price, a feature list, and a button.",
    icon: "Wallet",
    group: "Conversion",
    create: (id) => ({ id, type: "pricing", heading: "", sub: "", tiers: [] }),
  },
  {
    type: "quote",
    label: "Pull quote",
    description: "One quote, set large, with an attribution.",
    icon: "Quote",
    group: "Content",
    create: (id) => ({ id, type: "quote", quote: "", author: "", role: "", imageUrl: "" }),
  },
  {
    type: "banner",
    label: "Callout",
    description: "A tinted notice with an icon and an optional button.",
    icon: "Info",
    group: "Conversion",
    create: (id) => ({
      id,
      type: "banner",
      tone: "info",
      icon: "Info",
      heading: "",
      body: "",
      cta: { label: "", href: "/" },
    }),
  },
];

export const BLOCK_BY_TYPE: Record<BlockType, BlockDefinition> = Object.fromEntries(
  BLOCK_DEFINITIONS.map((definition) => [definition.type, definition]),
) as Record<BlockType, BlockDefinition>;

/** The palette grouped for the "add block" menu, groups in a fixed order. */
export const BLOCK_GROUP_ORDER: BlockGroup[] = ["Layout", "Content", "Media", "Conversion"];

export function blockDefinitionsByGroup(): { group: BlockGroup; blocks: BlockDefinition[] }[] {
  return BLOCK_GROUP_ORDER.map((group) => ({
    group,
    blocks: BLOCK_DEFINITIONS.filter((definition) => definition.group === group),
  })).filter((entry) => entry.blocks.length > 0);
}

/** First non-empty line of text inside some HTML, for a collapsed row's label. */
function firstTextLine(html: string): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 60);
}

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
    case "gallery":
    case "video":
    case "logos":
    case "steps":
    case "pricing":
    case "buttons":
    case "banner":
      return block.heading || BLOCK_BY_TYPE[block.type].label;
    case "richText":
      return firstTextLine(block.html) || "Rich text";
    case "html":
      return firstTextLine(block.html) || "Custom HTML";
    case "divider":
      return block.label || "Divider";
    case "image":
      return block.imageAlt || block.caption || "Image";
    case "quote":
      return block.author || block.quote.slice(0, 60) || "Pull quote";
    case "spacer":
      return `Spacer (${block.size})`;
    default:
      return "Block";
  }
}
