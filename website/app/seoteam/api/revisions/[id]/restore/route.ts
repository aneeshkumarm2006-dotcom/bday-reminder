import { NextResponse, type NextRequest } from "next/server";

import { connectDb } from "@/lib/blog/db";
import { logAction } from "@/lib/content/audit";
import { getEditorName } from "@/lib/content/editor-server";
import {
  LandingContentModel,
  LegalDocModel,
  NavigationConfigModel,
  PageMetaModel,
  SINGLETON,
  SeoPageContentModel,
  SiteSettingsModel,
} from "@/lib/content/models";
import { updateSitePage } from "@/lib/content/pages";
import { revalidateFor } from "@/lib/content/revalidate";
import { getRevision } from "@/lib/content/revisions";
import {
  badRequest,
  guardAdminRoute,
  notFound,
  serverError,
} from "@/lib/content/route-utils";
import { getSeoLandingPage } from "@/lib/content/seo-pages";
import type { PageBlock } from "@/lib/content/types";

export const dynamic = "force-dynamic";

/**
 * Restore a snapshot.
 *
 * Restoring never publishes. Where an entity has a draft/published split (the
 * landing page, the keyword landing pages) the snapshot lands in `draft`, so it
 * can be previewed and then published deliberately. Where a custom page is
 * concerned, the *content* comes back but its current status is left alone —
 * restoring an old version of a live page must not silently take it offline,
 * and restoring an old version of a draft must not silently put it online.
 *
 * The remaining entities (site settings, navigation, per-page meta, structured
 * data, legal copy) have no draft concept; for those, applying the snapshot *is*
 * the restore. Each one snapshots the pre-restore state first, so a restore can
 * itself be undone.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const { id } = await params;
  const revision = await getRevision(id);
  if (!revision) return notFound("Revision not found.");

  const snapshot = revision.snapshot as Record<string, unknown> | null;
  if (!snapshot || typeof snapshot !== "object") {
    return badRequest("That revision has no usable snapshot.");
  }

  try {
    const editor = await getEditorName();
    await connectDb();
    let summary = "";

    switch (revision.entityType) {
      case "site": {
        const { identity, seo, analytics, socials, announcement, robotsExtraDisallows, llmsTxtEnabled, structuredData } =
          snapshot as Record<string, unknown>;
        await SiteSettingsModel.findOneAndUpdate(
          { key: SINGLETON },
          {
            $set: {
              key: SINGLETON,
              identity,
              seo,
              analytics,
              socials,
              announcement,
              robotsExtraDisallows,
              llmsTxtEnabled,
              structuredData,
            },
          },
          { upsert: true, setDefaultsOnInsert: true },
        );
        revalidateFor("site");
        summary = "Restored site settings";
        break;
      }

      case "structured-data": {
        await SiteSettingsModel.findOneAndUpdate(
          { key: SINGLETON },
          { $set: { key: SINGLETON, structuredData: snapshot } },
          { upsert: true, setDefaultsOnInsert: true },
        );
        revalidateFor("structured-data");
        summary = "Restored structured data";
        break;
      }

      case "landing": {
        // Draft only — the live homepage is untouched until someone publishes.
        await LandingContentModel.findOneAndUpdate(
          { key: SINGLETON },
          { $set: { key: SINGLETON, draft: { sections: snapshot.sections ?? [] } } },
          { upsert: true, setDefaultsOnInsert: true },
        );
        summary = "Restored a landing page revision as the current draft";
        break;
      }

      case "seo-page": {
        // The slug is the key, and the route files own which keys exist — a
        // revision can outlive the page it belongs to (a deleted route file),
        // and writing it back would be an override nothing reads.
        const slug = revision.entityId;
        if (!getSeoLandingPage(slug)) {
          return badRequest(
            "That landing page no longer exists, so its copy can't be restored.",
          );
        }
        // A snapshot is *effective* content, so it carries the slug it was taken
        // from. Strip it, the same way `meta` below strips its path: the key is
        // the URL, and a stored override that carried its own slug could outvote
        // it the next time the page is read.
        const draft = { ...snapshot };
        delete draft.slug;
        // Draft only — the live URL is untouched until someone publishes.
        await SeoPageContentModel.findOneAndUpdate(
          { slug },
          { $set: { slug, draft } },
          { upsert: true, setDefaultsOnInsert: true },
        );
        summary = `Restored a /${slug} landing page revision as the current draft`;
        break;
      }

      case "navigation": {
        await NavigationConfigModel.findOneAndUpdate(
          { key: SINGLETON },
          { $set: { key: SINGLETON, header: snapshot.header, footer: snapshot.footer } },
          { upsert: true, setDefaultsOnInsert: true },
        );
        revalidateFor("navigation");
        summary = "Restored navigation";
        break;
      }

      case "meta": {
        const path = String(snapshot.path ?? revision.entityId);
        const fields = { ...(snapshot as Record<string, unknown>) };
        delete fields.path; // the path is the key, set explicitly below
        await PageMetaModel.findOneAndUpdate(
          { path },
          { $set: { ...fields, path } },
          { upsert: true, setDefaultsOnInsert: true },
        );
        revalidateFor("meta", { path });
        summary = `Restored SEO for ${path}`;
        break;
      }

      case "legal": {
        const key = String(snapshot.key ?? revision.entityId);
        await LegalDocModel.findOneAndUpdate(
          { key },
          {
            $set: {
              key,
              title: snapshot.title,
              intro: snapshot.intro,
              updated: snapshot.updated,
              html: snapshot.html,
            },
          },
          { upsert: true, setDefaultsOnInsert: true },
        );
        revalidateFor("legal", { legalKey: key });
        summary = `Restored the ${key} page`;
        break;
      }

      case "page": {
        // Content comes back; publish state deliberately does not.
        const restored = await updateSitePage(revision.entityId, {
          title: String(snapshot.title ?? ""),
          blocks: (snapshot.blocks ?? []) as PageBlock[],
        });
        if (!restored) {
          return badRequest(
            "That page no longer exists, so its content can't be restored in place.",
          );
        }
        revalidateFor("page", { slug: restored.slug });
        summary = `Restored the content of /${restored.slug} (publish state unchanged)`;
        break;
      }

      default:
        return badRequest("That entity type can't be restored.");
    }

    await logAction({
      action: "restore",
      entityType: revision.entityType,
      entityId: revision.entityId,
      summary,
      editor,
    });

    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return serverError("POST /seoteam/api/revisions/[id]/restore", err);
  }
}
