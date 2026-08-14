import { describe, expect, it } from "vitest";

import { jsonLdScript } from "@/lib/blog/url";
import type { Post } from "@/lib/blog/types";
import { siteConfig } from "@/lib/site";

import { DEFAULT_SETTINGS } from "../defaults";
import {
  blogPostingNodes,
  breadcrumbId,
  buildPageGraph,
  canonicalUrl,
  faqItemsFromBlocks,
  faqItemsFromLandingSections,
  featureListFromSections,
  filterCustomNodes,
  graphIds,
  graphTypes,
  itemListId,
  pageId,
  postImageNode,
  postListItems,
  type PageGraphInput,
} from "../page-graph";
import { APP_ID, ORG_ID, WEBSITE_ID } from "../site-json-ld";
import type { FaqSection, FeaturesSection, LandingSection, PageBlock } from "../types";

type Node = Record<string, unknown>;

function graph(input: Omit<PageGraphInput, "settings">): Node[] {
  return buildPageGraph({ ...input, settings: DEFAULT_SETTINGS })["@graph"];
}

/**
 * Every `{ "@id": … }` used as a pointer — an object whose only key is `@id`.
 * A node that *defines* an entity carries other keys alongside its id, so this
 * finds references without matching definitions.
 */
function references(nodes: Node[]): string[] {
  const found: string[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== "object") return;
    const rec = value as Node;
    const keys = Object.keys(rec);
    if (keys.length === 1 && keys[0] === "@id" && typeof rec["@id"] === "string") {
      found.push(rec["@id"] as string);
      return;
    }
    Object.values(rec).forEach(walk);
  };
  nodes.forEach(walk);
  return found;
}

function typesOf(nodes: Node[]): unknown[] {
  return nodes.map((node) => node["@type"]);
}

const POST: Post = {
  id: "1",
  title: "How to never forget a birthday",
  slug: "never-forget",
  template: "how-to",
  body: "<p>One two three four five.</p><script>ignored words here</script>",
  excerpt: "A short excerpt.",
  metaTitle: "",
  coverImage: "https://res.cloudinary.com/demo/image/upload/v1/blog/cover.jpg",
  coverImageAlt: "A cake",
  keywords: [{ keyword: "birthday app", url: "/", rel: "dofollow" }],
  linkOccurrences: "first",
  status: "published",
  author: "",
  views: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
  publishedAt: "2026-01-15T00:00:00.000Z",
};

/** One input per shape a real route builds, so the invariants below cover them all. */
const ROUTE_SHAPES: Record<string, Omit<PageGraphInput, "settings">> = {
  home: {
    path: "/",
    name: "Birthday App",
    about: "app",
    fullOrganization: true,
    includeApp: true,
    faq: [{ q: "What is it?", a: "A birthday reminder app." }],
  },
  landing: {
    path: "/birthday-calendar",
    name: "Birthday Calendar App",
    about: "app",
    breadcrumb: [{ name: "Home", path: "/" }, { name: "Birthday calendar" }],
    faq: [{ q: "Does it sync?", a: "Yes." }],
  },
  blogIndex: {
    path: "/blog",
    type: "CollectionPage",
    additionalTypes: ["Blog"],
    name: "Blog",
    breadcrumb: [{ name: "Home", path: "/" }, { name: "Blog" }],
    mainEntityId: itemListId("/blog"),
    nodes: [
      {
        "@type": "ItemList",
        "@id": itemListId("/blog"),
        itemListElement: postListItems([{ slug: "never-forget", title: "Never forget" }]),
      },
    ],
  },
  blogPost: {
    path: "/blog/never-forget",
    name: POST.title,
    breadcrumb: [
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: POST.title },
    ],
    mainEntityId: `${canonicalUrl("/blog/never-forget")}#article`,
    primaryImageId: `${canonicalUrl("/blog/never-forget")}#primaryimage`,
    nodes: blogPostingNodes({
      post: POST,
      path: "/blog/never-forget",
      siteName: siteConfig.name,
      inLanguage: "en-US",
    }),
  },
  contact: {
    path: "/contact",
    type: "ContactPage",
    name: "Contact",
    about: "organization",
    fullOrganization: true,
    breadcrumb: [{ name: "Home", path: "/" }, { name: "Contact" }],
  },
  legal: {
    path: "/privacy",
    name: "Privacy policy",
    breadcrumb: [{ name: "Home", path: "/" }, { name: "Privacy policy" }],
  },
};

describe("page graph invariants", () => {
  /**
   * The test the whole stub policy rests on. Non-home pages carry a four-field
   * Organization/WebSite stub precisely so their `isPartOf`/`publisher` pointers
   * resolve inside the page a crawler is reading; if a stub is ever dropped,
   * those become pointers to nothing.
   */
  it("leaves no reference pointing at a node the graph doesn't define", () => {
    for (const [name, input] of Object.entries(ROUTE_SHAPES)) {
      const nodes = graph(input);
      const defined = new Set(graphIds({ "@graph": nodes }));
      for (const ref of references(nodes)) {
        // The app node lives on the homepage alone — repeating it per page would
        // mint a rival software entity for one product, and multiply Google's
        // missing-rating error across the cluster. Landing pages point at it
        // across pages on purpose; everything else must resolve locally.
        if (ref === APP_ID && input.path !== "/") continue;
        expect(defined, `${name} references ${ref}`).toContain(ref);
      }
    }
  });

  it("defines exactly one page node and one Organization per graph", () => {
    for (const [name, input] of Object.entries(ROUTE_SHAPES)) {
      const nodes = graph(input);
      const pageNodes = nodes.filter((node) => node["@id"] === pageId(input.path));
      expect(pageNodes, name).toHaveLength(1);
      expect(pageNodes[0].url).toBe(input.url ?? canonicalUrl(input.path));

      const orgs = nodes.filter((node) => node["@id"] === ORG_ID);
      expect(orgs, name).toHaveLength(1);
      expect(nodes.filter((node) => node["@id"] === WEBSITE_ID), name).toHaveLength(1);
    }
  });

  it("emits no breadcrumb for a trail Google would reject", () => {
    // Google needs at least two items; the homepage is a one-item trail, so it
    // gets nothing rather than an invalid list.
    expect(typesOf(graph(ROUTE_SHAPES.home))).not.toContain("BreadcrumbList");
    expect(
      typesOf(graph({ path: "/x", name: "X", breadcrumb: [{ name: "Home", path: "/" }] })),
    ).not.toContain("BreadcrumbList");
  });

  it("numbers breadcrumbs from one and drops the last item's URL", () => {
    const nodes = graph(ROUTE_SHAPES.blogPost);
    const crumbs = nodes.find((node) => node["@id"] === breadcrumbId("/blog/never-forget"));
    const items = crumbs?.itemListElement as Node[];

    expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(items[0].item).toBe(siteConfig.url);
    expect(items[1].item).toBe(`${siteConfig.url}/blog`);
    // Google reads the containing page's URL for the final crumb; repeating it
    // is noise.
    expect(items[2]).not.toHaveProperty("item");
    for (const item of items.slice(0, -1)) {
      expect(String(item.item).startsWith(siteConfig.url)).toBe(true);
    }
  });

  it("co-types the page node for an FAQ instead of adding a second page entity", () => {
    // FAQPage is a subtype of WebPage — a WebPage whose mainEntity is another
    // WebPage would be describing two pages at one URL.
    const withFaq = graph(ROUTE_SHAPES.landing);
    const page = withFaq.find((node) => node["@id"] === pageId("/birthday-calendar"));
    expect(page?.["@type"]).toEqual(["WebPage", "FAQPage"]);
    expect((page?.mainEntity as Node[]).map((q) => q.name)).toEqual(["Does it sync?"]);
    expect(typesOf(withFaq).filter((t) => t === "FAQPage")).toHaveLength(0);

    const withoutFaq = graph(ROUTE_SHAPES.legal);
    expect(withoutFaq.find((node) => node["@id"] === pageId("/privacy"))?.["@type"]).toBe(
      "WebPage",
    );
  });

  it("escapes anything that could break out of the script tag", () => {
    const nodes = graph({ path: "/x", name: '</script><img onerror="x">' });
    const html = jsonLdScript({ "@graph": nodes });
    expect(html).not.toMatch(/[<>&]/);
  });

  it("builds canonical URLs the way the sitemap does", () => {
    expect(canonicalUrl("/")).toBe(siteConfig.url);
    expect(canonicalUrl("/")).not.toMatch(/\/$/);
    expect(canonicalUrl("/blog")).toBe(`${siteConfig.url}/blog`);
  });
});

describe("extractors mirror what the page renders", () => {
  const faqSection = (visible: boolean): FaqSection => ({
    id: "faq",
    type: "faq",
    visible,
    anchor: "faq",
    heading: "FAQ",
    sub: "",
    items: [
      { id: "1", q: "Question?", a: "Answer." },
      // An item half-filled in the admin is not a question anyone can read.
      { id: "2", q: "  ", a: "Orphan answer." },
    ],
  });

  const featuresSection = (visible: boolean): FeaturesSection => ({
    id: "features",
    type: "features",
    visible,
    anchor: "features",
    heading: "Features",
    sub: "",
    rows: [
      {
        id: "r1",
        icon: "bell",
        eyebrow: "",
        title: "Reminders that reach you",
        body: "",
        points: [],
        preview: "app",
        reverse: false,
      },
    ],
    cards: [{ id: "c1", icon: "gift", title: "Gift notes", body: "" }],
  });

  it("drops a hidden FAQ section — the markup can't outlive the accordion", () => {
    expect(faqItemsFromLandingSections([faqSection(true)] as LandingSection[])).toEqual([
      { q: "Question?", a: "Answer." },
    ]);
    expect(faqItemsFromLandingSections([faqSection(false)] as LandingSection[])).toEqual([]);
  });

  it("drops a hidden features section for the same reason", () => {
    expect(featureListFromSections([featuresSection(true)] as LandingSection[])).toEqual([
      "Reminders that reach you",
      "Gift notes",
    ]);
    expect(featureListFromSections([featuresSection(false)] as LandingSection[])).toEqual([]);
  });

  it("merges every faq block on a builder page into one list", () => {
    const blocks: PageBlock[] = [
      { id: "a", type: "faq", heading: "", sub: "", items: [{ id: "1", q: "A?", a: "1." }] },
      { id: "b", type: "faq", heading: "", sub: "", items: [{ id: "2", q: "B?", a: "2." }] },
    ];
    expect(faqItemsFromBlocks(blocks)).toEqual([
      { q: "A?", a: "1." },
      { q: "B?", a: "2." },
    ]);
  });
});

describe("blog post nodes", () => {
  /** By type, not by position — the node list grows as the graph fills out. */
  const articleFor = (post: Post): Node =>
    blogPostingNodes({
      post,
      path: "/blog/never-forget",
      siteName: siteConfig.name,
      inLanguage: "en-US",
    }).find((node) => node["@type"] === "BlogPosting") as Node;

  const nodes = blogPostingNodes({
    post: POST,
    path: "/blog/never-forget",
    siteName: siteConfig.name,
    inLanguage: "en-US",
  });
  const article = articleFor(POST);

  it("credits the Organization when no byline is rendered", () => {
    expect(article.author).toEqual({ "@id": ORG_ID });
  });

  it("credits a Person when one is actually named", () => {
    expect(articleFor({ ...POST, author: "Aneesh" }).author).toEqual({
      "@type": "Person",
      name: "Aneesh",
    });
  });

  it("never leaks backlink keywords as topic keywords", () => {
    // post.keywords holds link targets for the body renderer, not subjects.
    expect(JSON.stringify(nodes)).not.toContain("keywords");
    expect(JSON.stringify(nodes)).not.toContain("birthday app");
  });

  it("counts words without counting script contents", () => {
    expect(article.wordCount).toBe(5);
  });

  it("labels the section only when the template names one", () => {
    expect(article.articleSection).toBe("How-to");
    expect(articleFor({ ...POST, template: "generic" })).not.toHaveProperty(
      "articleSection",
    );
  });

  it("states image dimensions only when they're known to be true", () => {
    // Cloudinary is re-minted with an exact crop, so the size is a fact.
    const cloudinary = postImageNode(POST, "/blog/never-forget");
    expect(cloudinary.url).toContain("c_fill");
    expect(cloudinary).toMatchObject({ width: 1200, height: 675, caption: "A cake" });

    // A cover hosted elsewhere is whatever size it is — don't guess.
    const foreign = postImageNode(
      { ...POST, coverImage: "https://example.com/cover.jpg" },
      "/blog/never-forget",
    );
    expect(foreign.url).toBe("https://example.com/cover.jpg");
    expect(foreign).not.toHaveProperty("width");

    // No usable cover falls back to the OG route, whose size the route declares.
    const missing = postImageNode({ ...POST, coverImage: "" }, "/blog/never-forget");
    expect(missing).toMatchObject({
      url: `${siteConfig.url}/opengraph-image`,
      width: 1200,
      height: 630,
    });
  });
});

describe("custom JSON-LD de-duplication", () => {
  const reserved = () => {
    const nodes = graph(ROUTE_SHAPES.home);
    return { ids: graphIds({ "@graph": nodes }), types: graphTypes({ "@graph": nodes }) };
  };

  it("drops a pasted node that duplicates an entity the page already claims", () => {
    expect(filterCustomNodes({ "@type": "Organization", "@id": ORG_ID }, reserved())).toBeNull();
    expect(filterCustomNodes({ "@type": "WebSite", name: "Something else" }, reserved())).toBeNull();
  });

  it("leaves a paste that adds something new alone", () => {
    const event = { "@type": "Event", name: "Launch party" };
    expect(filterCustomNodes(event, reserved())).toEqual(event);
  });

  it("keeps the survivors when only part of a paste collides", () => {
    const pasted = [
      { "@type": "Organization", "@id": ORG_ID },
      { "@type": "Event", name: "Launch party" },
    ];
    expect(filterCustomNodes(pasted, reserved())).toEqual({ "@type": "Event", name: "Launch party" });
  });
});
