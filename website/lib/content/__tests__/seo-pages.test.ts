import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_NAV, DEFAULT_PAGE_META } from "../defaults";
import { isKnownIcon } from "../icons";
import { deepMerge } from "../merge";
import { isReservedSlug } from "../reserved-slugs";
import { STATIC_ROUTES } from "../routes";
import { SEO_LANDING_PAGES } from "../seo-pages";
import { seoPageContentSchema } from "../validation";

/**
 * The keyword landing pages are data, so the things that would silently break
 * them — an icon that isn't in the registry, a preview used twice, a slug the
 * page builder could shadow — are checked here rather than discovered in a
 * render. Each `it` runs across every page in the registry, so adding one is
 * covered by writing its data file and nothing else.
 */
describe("seo landing pages", () => {
  it("has a unique slug per page", () => {
    const slugs = SEO_LANDING_PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("reserves every slug so a custom page can't shadow the route file", () => {
    for (const page of SEO_LANDING_PAGES) {
      expect(isReservedSlug(page.slug), page.slug).toBe(true);
    }
  });

  it("registers every page in the route registry, sitemap included", () => {
    const paths = new Set(STATIC_ROUTES.map((r) => r.path));
    for (const page of SEO_LANDING_PAGES) {
      expect(paths.has(`/${page.slug}`), page.slug).toBe(true);
    }
  });

  it("ships default metadata for every page", () => {
    for (const page of SEO_LANDING_PAGES) {
      const meta = DEFAULT_PAGE_META[`/${page.slug}`];
      expect(meta, page.slug).toBeDefined();
      expect(meta.title).toBe(page.title);
      expect(meta.canonical).toBe(`/${page.slug}`);
      expect(meta.keywords.length).toBeGreaterThan(0);
      expect(meta.noindex).toBe(false);
      expect(meta.sitemap.exclude).toBe(false);
    }
  });

  it("keeps titles and descriptions inside what search engines render", () => {
    for (const page of SEO_LANDING_PAGES) {
      expect(page.title.trim(), page.slug).not.toBe("");
      expect(page.description.length, `${page.slug} description`).toBeLessThanOrEqual(165);
      expect(page.description.length, `${page.slug} description`).toBeGreaterThan(50);
      expect(page.blurb.trim(), page.slug).not.toBe("");
    }
  });

  it("only references icons that exist in the registry", () => {
    for (const page of SEO_LANDING_PAGES) {
      for (const row of page.features.rows) {
        expect(isKnownIcon(row.icon), `${page.slug}/${row.id}: ${row.icon}`).toBe(true);
      }
      for (const card of page.features.cards) {
        expect(isKnownIcon(card.icon), `${page.slug}/${card.id}: ${card.icon}`).toBe(true);
      }
    }
  });

  it("gives each feature row its own product shot", () => {
    for (const page of SEO_LANDING_PAGES) {
      const previews = page.features.rows.map((r) => r.preview);
      expect(previews.length, page.slug).toBe(3);
      expect(new Set(previews), page.slug).toEqual(new Set(["app", "reminder", "widget"]));
    }
  });

  it("uses valid hero visuals", () => {
    for (const page of SEO_LANDING_PAGES) {
      expect(page.hero.visuals.length, page.slug).toBeGreaterThan(0);
      expect(page.hero.visuals.length, page.slug).toBeLessThanOrEqual(2);
      for (const visual of page.hero.visuals) {
        expect(["app", "reminder", "widget"], page.slug).toContain(visual);
      }
    }
  });

  it("walks the how-it-works rings from a week out to today", () => {
    for (const page of SEO_LANDING_PAGES) {
      expect(page.howItWorks.steps.map((s) => s.offset), page.slug).toEqual([-7, -1, 0]);
    }
  });

  it("has a non-empty FAQ, which is also the FAQPage schema", () => {
    for (const page of SEO_LANDING_PAGES) {
      expect(page.faq.items.length, page.slug).toBeGreaterThanOrEqual(5);
      for (const item of page.faq.items) {
        expect(item.q.trim(), `${page.slug}/${item.id}`).not.toBe("");
        expect(item.a.trim(), `${page.slug}/${item.id}`).not.toBe("");
      }
    }
  });

  it("keeps every id unique within a page", () => {
    for (const page of SEO_LANDING_PAGES) {
      const ids = [
        ...page.features.rows.map((r) => r.id),
        ...page.features.cards.map((c) => c.id),
        ...page.howItWorks.steps.map((s) => s.id),
        ...page.faq.items.map((f) => f.id),
      ];
      expect(new Set(ids).size, page.slug).toBe(ids.length);
    }
  });

  it("splits the contrast heading into parts that carry the argument", () => {
    for (const page of SEO_LANDING_PAGES) {
      const { lead, muted, accent } = page.contrast.headingParts;
      // `mid` and `tail` may legitimately be empty; these three never are, or
      // the heading loses its two coloured spans.
      expect(lead.trim(), page.slug).not.toBe("");
      expect(muted.trim(), page.slug).not.toBe("");
      expect(accent.trim(), page.slug).not.toBe("");
      expect(page.contrast.body.trim(), page.slug).not.toBe("");
    }
  });

  it("sends every CTA somewhere real", () => {
    for (const page of SEO_LANDING_PAGES) {
      expect(page.hero.primaryCta.href, page.slug).toMatch(/^\//);
      expect(page.hero.primaryCta.label.trim(), page.slug).not.toBe("");
      expect(page.cta.ctaHref, page.slug).toMatch(/^\//);
      expect(page.cta.ctaLabel.trim(), page.slug).not.toBe("");
    }
  });

  it("ships the file every download band promises", () => {
    // The whole value of a "free printable" page is that the button hands over
    // a file. A copy edit that renamed the path — or a deploy that dropped the
    // asset — would leave the page promising a download and serving a 404, and
    // nothing else in the suite renders far enough to notice.
    for (const page of SEO_LANDING_PAGES) {
      if (!page.download) continue;
      const { href, ctaLabel, fileName, points } = page.download;
      expect(href, page.slug).toMatch(/^\/[\w./-]+\.\w{2,4}$/);
      expect(ctaLabel.trim(), page.slug).not.toBe("");
      expect(points.length, page.slug).toBeGreaterThan(0);
      expect(
        existsSync(join(process.cwd(), "public", href.replace(/^\//, ""))),
        `${page.slug}: public${href} is missing`,
      ).toBe(true);
      // The save-as name has to match the file the browser is fetching, or the
      // download lands with a name that doesn't open.
      if (fileName) expect(href.endsWith(fileName), page.slug).toBe(true);
    }
  });

  it("gives each page a distinct name and hook for the cross-link cards", () => {
    // Every page renders the other five as cards. Two pages sharing a label or
    // a blurb would make that strip unreadable — and would mean two URLs are
    // arguing for the same thing, which is the cannibalization these separate
    // pages exist to avoid.
    const labels = SEO_LANDING_PAGES.map((p) => p.label.toLowerCase());
    const blurbs = SEO_LANDING_PAGES.map((p) => p.blurb.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(blurbs).size).toBe(blurbs.length);
  });

  it("links every page from the footer", () => {
    const hrefs = new Set(
      DEFAULT_NAV.footer.groups.flatMap((g) => g.links.map((l) => l.href)),
    );
    for (const page of SEO_LANDING_PAGES) {
      expect(hrefs.has(`/${page.slug}`), page.slug).toBe(true);
    }
  });
});

/**
 * The admin stores a page as a partial override deep-merged over the built-in
 * copy, so the two have to agree on the shape. These are the checks that catch
 * them drifting apart — a field added to `SeoLandingPageDef` but not to the Zod
 * schema would otherwise be silently dropped on the first save.
 */
describe("seo landing pages — admin round-trip", () => {
  it("accepts every built-in page as a valid save payload", () => {
    for (const page of SEO_LANDING_PAGES) {
      const parsed = seoPageContentSchema.safeParse(page);
      expect(parsed.success, `${page.slug}: ${parsed.error?.issues[0]?.message}`).toBe(true);
    }
  });

  it("loses nothing on the way through the schema", () => {
    for (const page of SEO_LANDING_PAGES) {
      const parsed = seoPageContentSchema.parse(page);
      // `slug` is deliberately not part of the payload — the route owns it.
      expect(parsed).not.toHaveProperty("slug");
      const content: Record<string, unknown> = { ...page };
      delete content.slug;
      expect(parsed, page.slug).toEqual(content);
    }
  });

  it("is idempotent, so re-saving an unedited page is a no-op", () => {
    for (const page of SEO_LANDING_PAGES) {
      const once = seoPageContentSchema.parse(page);
      expect(seoPageContentSchema.parse(once), page.slug).toEqual(once);
    }
  });

  it("keeps the built-in copy for anything the override doesn't set", () => {
    const [page] = SEO_LANDING_PAGES;
    const merged = deepMerge(page, { hero: { heading: "Edited in the admin" } });

    expect(merged.hero.heading).toBe("Edited in the admin");
    // Untouched siblings of the edited field, and untouched sections, survive.
    expect(merged.hero.subheading).toBe(page.hero.subheading);
    expect(merged.slug).toBe(page.slug);
    expect(merged.faq.items).toEqual(page.faq.items);
    expect(merged.features.rows).toEqual(page.features.rows);
  });

  it("honours an emptied list rather than resurrecting the default", () => {
    const [page] = SEO_LANDING_PAGES;
    // Removing every FAQ has to be possible — otherwise the schema's own
    // "arrays replace wholesale" rule would be a lie for exactly the case that
    // matters (see merge.ts).
    const merged = deepMerge(page, { faq: { items: [] } });
    expect(merged.faq.items).toEqual([]);
    expect(merged.faq.heading).toBe(page.faq.heading);
  });
});
