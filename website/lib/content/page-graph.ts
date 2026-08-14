import { cloudinaryFill } from "@/lib/blog/image-url";
import { readingTimeMinutes } from "@/lib/blog/reading-time";
import { buildPostDescription, wordCount } from "@/lib/blog/seo-meta";
import type { Post, TemplateKey } from "@/lib/blog/types";
import { isHttpUrl } from "@/lib/blog/url";
import { siteConfig } from "@/lib/site";

import {
  APP_ID,
  ORG_ID,
  WEBSITE_ID,
  appNode,
  authorNode,
  logoNode,
  organizationNode,
  webSiteNode,
  type JsonLdNode,
} from "./site-json-ld";
import type { FaqItem, LandingSection, PageBlock, SiteSettings } from "./types";

/**
 * Builds the one `@graph` a public page emits.
 *
 * The point of a single graph per page — rather than the handful of unrelated
 * `<script>` tags this replaced — is that the nodes reference each other by
 * `@id`. A consumer reading one page can then follow page → site → organisation
 * → product without guessing, which is what both Google's entity understanding
 * and the LLM-backed answer engines actually consume. Freestanding blocks give
 * them four facts; a graph gives them a small knowledge graph.
 *
 * Pure and free of React/Mongo imports on purpose: the unit tests only glob
 * `lib/**\/__tests__/**\/*.ts`, so logic that lives in a component can't be
 * covered. Components here do nothing but call `buildPageGraph` and stringify.
 */

/** A crumb; the last one in a trail omits `path` so Google infers the page URL. */
export interface Crumb {
  name: string;
  path?: string;
}

export type PageNodeType =
  | "WebPage"
  | "CollectionPage"
  | "ContactPage"
  | "AboutPage"
  | "ItemPage";

export interface PageGraphInput {
  settings: SiteSettings;
  /** Leading slash, no trailing slash: "/", "/blog", "/blog/some-post". */
  path: string;
  name: string;
  type?: PageNodeType;
  /**
   * Extra types to co-type the page node with — `Blog` on the index, so the
   * archive is both a collection and a blog without inventing a second node for
   * the same URL.
   */
  additionalTypes?: string[];
  description?: string;
  /** Overrides the canonical URL — used by `/blog?page=2`, which self-canonicalises. */
  url?: string;
  /** Fewer than two entries emits no BreadcrumbList: Google requires at least two. */
  breadcrumb?: Crumb[];
  /** Non-empty co-types the page node as a FAQPage and fills its `mainEntity`. */
  faq?: { q: string; a: string }[];
  about?: "app" | "organization";
  /**
   * Describe the Organization in full rather than as a stub. True only on the
   * two pages that are about the company: `/` and `/contact`.
   */
  fullOrganization?: boolean;
  /** Emit the WebApplication node itself. Homepage only — see `appNode`. */
  includeApp?: boolean;
  featureList?: string[];
  /** Extra nodes (BlogPosting, ItemList, ImageObject…) appended to the graph. */
  nodes?: JsonLdNode[];
  /** `mainEntity` target when the page isn't an FAQ — e.g. the post or the list. */
  mainEntityId?: string;
  primaryImageId?: string;
  datePublished?: string;
  dateModified?: string;
}

/* ----------------------------------- ids ---------------------------------- */

/** Absolute URL for a route, matching what `app/sitemap.ts` emits (no trailing slash). */
export function canonicalUrl(path: string): string {
  if (!path || path === "/") return siteConfig.url;
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageId(path: string): string {
  return `${canonicalUrl(path)}#webpage`;
}

export function breadcrumbId(path: string): string {
  return `${canonicalUrl(path)}#breadcrumb`;
}

export function primaryImageId(path: string): string {
  return `${canonicalUrl(path)}#primaryimage`;
}

export function itemListId(path: string): string {
  return `${canonicalUrl(path)}#posts`;
}

export function articleId(slug: string): string {
  return `${canonicalUrl(`/blog/${slug}`)}#article`;
}

/** The blog index's page node, which every post's `isPartOf` points at. */
export const BLOG_ID = pageId("/blog");

/* -------------------------------- extractors ------------------------------ */

/**
 * FAQ items from the landing sections.
 *
 * Applies the same `visible` filter the renderer does. Without it, hiding the
 * FAQ section in the admin would leave the markup describing questions that are
 * no longer on the page — the one structured-data rule Google states flatly.
 */
export function faqItemsFromLandingSections(
  sections: LandingSection[],
): { q: string; a: string }[] {
  return sections
    .filter((section): section is Extract<LandingSection, { type: "faq" }> =>
      section.type === "faq" && section.visible,
    )
    .flatMap((section) => faqPairs(section.items));
}

/** FAQ items from a builder page's blocks (blocks have no visibility flag). */
export function faqItemsFromBlocks(blocks: PageBlock[]): { q: string; a: string }[] {
  return blocks
    .filter((block): block is Extract<PageBlock, { type: "faq" }> => block.type === "faq")
    .flatMap((block) => faqPairs(block.items));
}

function faqPairs(items: FaqItem[]): { q: string; a: string }[] {
  return items
    .filter((item) => item.q.trim() && item.a.trim())
    .map((item) => ({ q: item.q.trim(), a: item.a.trim() }));
}

/**
 * `featureList` for the app node, read off the visible features section.
 *
 * Derived rather than stored for the same reason as the FAQ: a stored list keeps
 * claiming features after an admin hides the section that showed them.
 */
export function featureListFromSections(sections: LandingSection[]): string[] {
  return sections
    .filter((section): section is Extract<LandingSection, { type: "features" }> =>
      section.type === "features" && section.visible,
    )
    .flatMap((section) => [
      ...section.rows.map((row) => row.title),
      ...section.cards.map((card) => card.title),
    ])
    .map((title) => title.trim())
    .filter(Boolean);
}

/* --------------------------------- builder -------------------------------- */

export function buildPageGraph(input: PageGraphInput): {
  "@context": string;
  "@graph": JsonLdNode[];
} {
  const {
    settings,
    path,
    name,
    type = "WebPage",
    additionalTypes = [],
    description,
    url,
    breadcrumb = [],
    faq = [],
    about,
    fullOrganization = false,
    includeApp = false,
    featureList = [],
    nodes = [],
    mainEntityId,
    primaryImageId: imageId,
    datePublished,
    dateModified,
  } = input;

  const graph: JsonLdNode[] = [];

  const org = organizationNode(settings, { full: fullOrganization });
  if (org) graph.push(org);
  // The logo node only accompanies the full Organization; a stub referencing an
  // ImageObject that isn't in the graph would be a dangling pointer.
  if (fullOrganization) {
    const logo = logoNode(settings);
    if (logo) graph.push(logo);
  }

  const website = webSiteNode(settings, { full: path === "/" });
  if (website) graph.push(website);

  if (includeApp) {
    const app = appNode(settings, { featureList });
    if (app) graph.push(app);
  }

  const inLanguage = settings.structuredData.website.inLanguage || "en-US";
  const hasBreadcrumb = breadcrumb.length >= 2;

  // FAQPage is a subtype of WebPage, so a page with an FAQ *is* an FAQPage — it
  // can't own one as a separate node. Co-typing keeps a single page entity with
  // a single @id, and the questions hang off it directly.
  const extraTypes = [...additionalTypes, ...(faq.length > 0 ? ["FAQPage"] : [])];
  const pageType = extraTypes.length > 0 ? [type, ...extraTypes] : type;

  graph.push({
    "@type": pageType,
    "@id": pageId(path),
    url: url ?? canonicalUrl(path),
    // A route whose SEO title has never been filled in still needs a name; an
    // empty one would be worse than the site's own.
    name: name.trim() || settings.identity.name,
    ...(description ? { description } : {}),
    inLanguage,
    ...(website ? { isPartOf: { "@id": WEBSITE_ID } } : {}),
    ...(org ? { publisher: { "@id": ORG_ID } } : {}),
    ...(about === "app" ? { about: { "@id": APP_ID } } : {}),
    ...(about === "organization" && org ? { about: { "@id": ORG_ID } } : {}),
    ...(hasBreadcrumb ? { breadcrumb: { "@id": breadcrumbId(path) } } : {}),
    ...(imageId ? { primaryImageOfPage: { "@id": imageId } } : {}),
    ...(faq.length > 0
      ? {
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }
      : mainEntityId
        ? { mainEntity: { "@id": mainEntityId } }
        : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
  });

  if (hasBreadcrumb) {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": breadcrumbId(path),
      itemListElement: breadcrumb.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        // The final crumb deliberately carries no `item`: Google reads the
        // containing page's URL, and repeating it is noise.
        ...(crumb.path !== undefined ? { item: canonicalUrl(crumb.path) } : {}),
      })),
    });
  }

  graph.push(...nodes);

  return { "@context": "https://schema.org", "@graph": graph };
}

/** Every `@id` the graph defines — the reserved list handed to `CustomJsonLd`. */
export function graphIds(graph: { "@graph": JsonLdNode[] }): string[] {
  return graph["@graph"]
    .map((node) => node["@id"])
    .filter((id): id is string => typeof id === "string");
}

/** Every `@type` the graph defines, flattened across co-typed nodes. */
export function graphTypes(graph: { "@graph": JsonLdNode[] }): string[] {
  return graph["@graph"].flatMap((node) => {
    const type = node["@type"];
    return (Array.isArray(type) ? type : [type]).filter(
      (t): t is string => typeof t === "string",
    );
  });
}

/**
 * Types that describe one thing per page. A pasted second copy doesn't add
 * detail, it competes — so if the page graph already emits one, the paste loses.
 */
const SINGLETON_TYPES = new Set([
  "Organization",
  "WebSite",
  "WebPage",
  "CollectionPage",
  "ContactPage",
  "BreadcrumbList",
  "WebApplication",
  "SoftwareApplication",
]);

/**
 * Strip nodes from an admin's pasted JSON-LD that would duplicate the page's own
 * graph. New pastes are refused at write time with an explanation; this is the
 * safety net for documents stored before that check existed.
 *
 * Returns null when nothing survives, so the caller emits no empty script.
 */
export function filterCustomNodes(
  parsed: unknown,
  reserved: { ids: string[]; types: string[] },
): unknown {
  const reservedIds = new Set(reserved.ids);
  const reservedTypes = new Set(reserved.types.filter((t) => SINGLETON_TYPES.has(t)));

  const nodes = toNodeList(parsed);
  if (nodes === null) return parsed; // not a shape we understand — leave it alone

  const kept = nodes.filter((node) => {
    if (!node || typeof node !== "object") return false;
    const rec = node as JsonLdNode;
    const id = rec["@id"];
    if (typeof id === "string" && reservedIds.has(id)) return false;
    const type = rec["@type"];
    const types = (Array.isArray(type) ? type : [type]).filter(
      (t): t is string => typeof t === "string",
    );
    return !types.some((t) => reservedTypes.has(t));
  });

  if (kept.length === 0) return null;
  if (kept.length === 1) return kept[0];
  return { "@context": "https://schema.org", "@graph": kept };
}

/** A single node, an array of nodes, or an `@graph` → a flat node list. */
function toNodeList(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return null;
  const graph = (parsed as Record<string, unknown>)["@graph"];
  if (Array.isArray(graph)) return graph;
  return [parsed];
}

/* ----------------------------------- blog --------------------------------- */

/** `template` is a writing format, but it's the closest thing the blog has to a section. */
const ARTICLE_SECTIONS: Partial<Record<TemplateKey, string>> = {
  "how-to": "How-to",
  listicle: "Listicle",
  comparison: "Comparison",
  review: "Review",
  news: "News",
  // "generic" deliberately absent — an empty label is worse than no property.
};

const OG_IMAGE = {
  url: `${siteConfig.url}/opengraph-image`,
  width: 1200,
  height: 630,
};

/**
 * The cover as an `ImageObject`.
 *
 * Dimensions are only stated when they're known to be true: a Cloudinary URL is
 * re-minted with an exact `c_fill` crop, so 1200×675 is a fact, and the site's
 * own OG route declares its size. A cover hosted somewhere else gets no width or
 * height rather than a guess.
 */
export function postImageNode(post: Post, path: string): JsonLdNode {
  const caption = post.coverImageAlt || post.title;
  const id = primaryImageId(path);

  if (isHttpUrl(post.coverImage)) {
    const filled = cloudinaryFill(post.coverImage, 1200, 675);
    const isCloudinary = filled !== post.coverImage;
    return {
      "@type": "ImageObject",
      "@id": id,
      url: filled,
      contentUrl: filled,
      ...(isCloudinary ? { width: 1200, height: 675 } : {}),
      ...(caption ? { caption } : {}),
    };
  }

  return {
    "@type": "ImageObject",
    "@id": id,
    url: OG_IMAGE.url,
    contentUrl: OG_IMAGE.url,
    width: OG_IMAGE.width,
    height: OG_IMAGE.height,
    ...(caption ? { caption } : {}),
  };
}

/**
 * The `BlogPosting` and its cover, as graph nodes.
 *
 * `post.keywords` is never emitted as `keywords`: those rows are backlink targets
 * for the body renderer, not topics the post is about.
 */
export function blogPostingNodes({
  post,
  path,
  siteName,
  inLanguage,
}: {
  post: Post;
  path: string;
  siteName: string;
  inLanguage: string;
}): JsonLdNode[] {
  const description = buildPostDescription(post);
  const section = ARTICLE_SECTIONS[post.template];
  const words = wordCount(post.body);
  const image = postImageNode(post, path);

  return [
    // A stub of the blog itself, on the same terms as the Organization and
    // WebSite stubs: the article's `isPartOf` has to resolve inside the page a
    // crawler is actually reading, and the index's full node is on another URL.
    {
      "@type": "Blog",
      "@id": BLOG_ID,
      name: "Blog",
      url: canonicalUrl("/blog"),
    },
    {
      "@type": "BlogPosting",
      "@id": articleId(post.slug),
      headline: post.metaTitle || post.title,
      name: post.title,
      ...(description ? { description } : {}),
      url: canonicalUrl(path),
      inLanguage,
      datePublished: post.publishedAt ?? post.createdAt,
      dateModified: post.updatedAt,
      author: authorNode(post.author, siteName),
      publisher: { "@id": ORG_ID },
      image: { "@id": image["@id"] },
      isPartOf: { "@id": BLOG_ID },
      mainEntityOfPage: { "@id": pageId(path) },
      ...(words > 0 ? { wordCount: words } : {}),
      ...(section ? { articleSection: section } : {}),
      // Matches the "N min read" the page renders, from the same helper.
      timeRequired: `PT${readingTimeMinutes(post.body)}M`,
    },
    image,
  ];
}

/** The blog index's `ItemList` — the posts on *this* pagination page, in order. */
export function postListItems(posts: { slug: string; title: string }[]): JsonLdNode[] {
  return posts.map((post, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: canonicalUrl(`/blog/${post.slug}`),
    name: post.title,
  }));
}
