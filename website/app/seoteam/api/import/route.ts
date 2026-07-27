import { NextResponse, type NextRequest } from "next/server";

import { connectDb } from "@/lib/blog/db";
import { logAction } from "@/lib/content/audit";
import { getEditorName } from "@/lib/content/editor-server";
import {
  getAllPageMeta,
  getLandingContent,
  getLegalDoc,
  getNavigation,
  getSiteSettings,
} from "@/lib/content/get";
import {
  LandingContentModel,
  LegalDocModel,
  NavigationConfigModel,
  PageMetaModel,
  RedirectModel,
  SINGLETON,
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
import { importBundleSchema } from "@/lib/content/validation";

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
      }
      applied.push(`${bundle.legal.length} legal page(s)`);
    }

    if (bundle.pages && bundle.pages.length > 0) {
      for (const page of bundle.pages) {
        const created = await createSitePage({ ...page, author: page.author || editor });
        revalidateFor("page", { slug: created.slug });
      }
      applied.push(`${bundle.pages.length} custom page(s)`);
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
      applied.push(`${bundle.redirects.length} redirect(s)`);
    }

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
