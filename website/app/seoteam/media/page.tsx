import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MediaGallery } from "@/components/seoteam/media/media-gallery";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { isCloudinaryConfigured } from "@/lib/blog/cloudinary";
import { isDbConfigured } from "@/lib/blog/db";
import { getMediaRows } from "@/lib/blog/images";
import type { MediaRow } from "@/lib/blog/types";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage() {
  // Defense in depth: enforce auth in the data layer, not just the proxy matcher.
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  let rows: MediaRow[] = [];
  let dbReady = isDbConfigured();
  if (dbReady) {
    try {
      rows = await getMediaRows();
    } catch {
      dbReady = false;
    }
  }

  return (
    <>
      <SeoTeamHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-ink">Media library</h1>
          <p className="text-sm text-ink-muted">
            Audit alt text, tags, and where each image is used across your posts.
          </p>
        </div>

        {!dbReady ? (
          <div className="rounded-lg border border-border-subtle bg-warn-bg p-5 text-sm text-warn-fg">
            <p className="font-medium">The database isn&apos;t connected.</p>
            <p className="mt-1">
              Set <code>MONGODB_URI</code> in <code>website/.env.local</code> to manage media.
            </p>
          </div>
        ) : (
          <MediaGallery initialRows={rows} cloudinaryReady={isCloudinaryConfigured()} />
        )}
      </main>
    </>
  );
}
