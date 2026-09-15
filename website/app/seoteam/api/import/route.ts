import { NextResponse, type NextRequest } from "next/server";

import { connectDb } from "@/lib/blog/db";
import { logAction } from "@/lib/content/audit";
import { getEditorName } from "@/lib/content/editor-server";
import {
  getAllPageMeta,
  getBuiltInPages,
  getLandingContent,
  getLegalDoc,
  getNavigation,
  getSeoPageContent,
  getSiteSettings,
  isSitePageLive,
} from "@/lib/content/get";
import {
  BuiltInPagesModel,
  LandingContentModel,
  LegalDocModel,
  NavigationConfigModel,
  PageMetaModel,
  RedirectModel,
  SINGLETON,
  SeoPageContentModel,
  SiteSettingsModel,
} from "@/lib/content/models";
import { createSitePage } from "@/lib/content/pages";
import { revalidateFor, revalidateRedirects } from "@/lib/content/revalidate";
import { saveRevision } from "@/lib/content/revisions";
import {
  badRequest,
  firstError,
  guardAdminRoute,
  readJson,
  serverError,
} from "@/lib/content/route-utils";
import { getSeoLandingPage } from "@/lib/content/seo-pages";
import { GRAPH_ROUTES } from "@/lib/content/static-routes";
import { importBundleSchema } from "@/lib/content/validation";
import { pingIndexNow } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

/**
 * Restore an exported bundle.
 *
 * Every section is optional, so a partial file (say, just the redirects) is a
 * valid import. Before anything is written, the *current* state of each section
 * being touched is snapshotted as a revision — an import is the single most
 * destructive action in this admin, and it has to be undoable.
 *
 * Pages are created rather than overwritten: slugs de-duplicate through the same
 * uniqueness logic as the builder, so importing into a populated site adds
 * copies instead of silently replacing someone's work.
 */
export async function POST(req: NextRequest) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const json = await readJson(req);
  if (json === null) return badRequest("That file isn't valid JSON.");

  const parsed = importBundleSchema.safeParse(json);
  if (!parsed.success) return badRequest(firstError(parsed.error));

  const bundle = parsed.data;
  const applied: string[] = [];
  // Every public URL this import actually changes, gathered as we go so the
  // whole restore leaves in a single IndexNow request rather than a dozen.
  const changedUrls = new Set<string>();

  try {
    const editor = await getEditorName();
    await connectDb();

    if (bundle.settings) {
      await saveRevision("site", SINGLETON, await getSiteSettings(), editor);
      await SiteSettingsModel.findOneAndUpdate(
        { key: SINGLETON },
        { $set: { ...bundle.settings, key: SINGLETON } },
        { upsert: true, setDefaultsOnInsert: true },
      );
      revalidateFor("site");
      // Title template, JSON-LD, the announcement bar: site settings reach every
      // page that emits a graph, which is every public page.
      for (const path of GRAPH_ROUTES) changedUrls.add(path);
      applied.push("site settings");
    }

    if (bundle.landing) {
      await saveRevision("landing", SINGLETON, await getLandingContent("published"), editor);
      // Imported into the draft only — review and publish deliberately.
      await LandingContentModel.findOneAndUpdate(
        { key: SINGLETON },
        { $set: { key: SINGLETON, draft: { sections: bundle.landing.sections } } },
        { upsert: true, setDefaultsOnInsert: true },
      );
      applied.push("landing page (as a draft)");
    }

    if (bundle.navigation) {
      await saveRevision("navigation", SINGLETON, await getNavigation(), editor);
      await NavigationConfigModel.findOneAndUpdate(
        { key: SINGLETON },
        { $set: { ...bundle.navigation, key: SINGLETON } },
        { upsert: true, setDefaultsOnInsert: true },
      );
      revalidateFor("navigation");
      // Header and footer render on every page, and the footer is real internal
      // linking — a restored nav changes what each page links to.
      for (const path of GRAPH_ROUTES) changedUrls.add(path);
      applied.push("navigation");
    }

    if (bundle.meta && bundle.meta.length > 0) {
      const existing = await getAllPageMeta();
      for (const entry of bundle.meta) {
        const { path, ...fields } = entry;
        if (existing[path]) await saveRevision("meta", path, existing[path], editor);
        await PageMetaModel.findOneAndUpdate(
          { path },
          { $set: { ...fields, path } },
          { upsert: true, setDefaultsOnInsert: true },
        );
        revalidateFor("meta", { path });
        changedUrls.add(path);
      }
      applied.push(`${bundle.meta.length} page SEO record(s)`);
    }

    if (bundle.legal && bundle.legal.length > 0) {
      for (const doc of bundle.legal) {
        await saveRevision("legal", doc.key, await getLegalDoc(doc.key), editor);
        await LegalDocModel.findOneAndUpdate(
          { key: doc.key },
          { $set: doc },
          { upsert: true, setDefaultsOnInsert: true },
        );
        revalidateFor("legal", { legalKey: doc.key });
        changedUrls.add(`/${doc.key}`);
      }
      applied.push(`${bundle.legal.length} legal page(s)`);
    }

    if (bundle.pages && bundle.pages.length > 0) {
      for (const page of bundle.pages) {
        const created = await createSitePage({ ...page, author: page.author || editor });
        revalidateFor("page", { slug: created.slug });
        if (isSitePageLive(created)) changedUrls.add(`/${created.slug}`);
      }
      applied.push(`${bundle.pages.length} custom page(s)`);
    }

    if (bundle.seoPages && bundle.seoPages.length > 0) {
      let restored = 0;
      for (const entry of bundle.seoPages) {
        // The route files — not the bundle — decide which keyword pages exist,
        // so a slug from an older build is skipped rather than stored as an
        // override nothing renders.
        if (!getSeoLandingPage(entry.slug)) continue;
        await saveRevision(
          "seo-page",
          entry.slug,
          await getSeoPageContent(entry.slug, "published"),
          editor,
        );
        // Draft only, like the landing page above — review and publish deliberately.
        await SeoPageContentModel.findOneAndUpdate(
          { slug: entry.slug },
          { $set: { slug: entry.slug, draft: entry.content } },
          { upsert: true, setDefaultsOnInsert: true },
        );
        restored += 1;
      }
      if (restored > 0) applied.push(`${restored} keyword landing page(s) (as drafts)`);
    }

    if (bundle.builtIn) {
      await saveRevision("built-in", SINGLETON, await getBuiltInPages(), editor);
      await BuiltInPagesModel.findOneAndUpdate(
        { key: SINGLETON },
        { $set: { ...bundle.builtIn, key: SINGLETON } },
        { upsert: true, setDefaultsOnInsert: true },
      );
      revalidateFor("built-in");
      changedUrls.add("/blog");
      changedUrls.add("/contact");
      applied.push("built-in pages");
    }

    if (bundle.redirects && bundle.redirects.length > 0) {
      for (const rule of bundle.redirects) {
        // Upsert so re-importing the same bundle updates rather than 11000s.
        await RedirectModel.findOneAndUpdate(
          { from: rule.from },
          { $set: rule },
          { upsert: true, setDefaultsOnInsert: true },
        );
      }
      revalidateRedirects();
      // The `from` URLs now answer with a redirect; submitting them is how the
      // engine learns to follow it instead of re-serving the old target. A rule
      // that arrives disabled changes nothing, so it announces nothing.
      for (const rule of bundle.redirects) {
        if (rule.enabled) changedUrls.add(rule.from);
      }
      applied.push(`${bundle.redirects.length} redirect(s)`);
    }

    // One request for the whole restore. `force` because an import is exactly
    // the bulk edit that can flip pages to noindex or excluded — and a URL whose
    // robots directive just changed is a URL an engine has to come back and read.
    // (The landing page and the keyword pages import as *drafts*, so nothing
    // public changed for them and neither appears here.)
    pingIndexNow([...changedUrls], { force: true });

    await logAction({
      action: "import",
      entityType: "site",
      entityId: SINGLETON,
      summary: `Imported ${applied.join(", ") || "nothing"}`,
      editor,
    });

    return NextResponse.json({ applied });
  } catch (err) {
    return serverError("POST /seoteam/api/import", err);
  }
}
