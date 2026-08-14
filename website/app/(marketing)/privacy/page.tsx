import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";
import { PageGraph } from "@/components/page-graph";
import { getLegalDoc, getPageMeta } from "@/lib/content/get";
import { metadataForPath } from "@/lib/content/metadata";

// Admin-managed (/seoteam/meta for SEO, /seoteam/legal for the copy); both fall
// back to the hardcoded defaults when no database is configured.
export function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/privacy");
}

export default async function PrivacyPage() {
  const [doc, meta] = await Promise.all([getLegalDoc("privacy"), getPageMeta("/privacy")]);

  return (
    <>
      {/* No `dateModified`: `doc.updated` is free text ("June 2026"), and parsing
          it would publish an invented day of the month. */}
      <PageGraph
        path="/privacy"
        name={meta.title || doc.title}
        description={meta.description}
        breadcrumb={[{ name: "Home", path: "/" }, { name: doc.title }]}
        customJsonLd={meta.customJsonLd}
      />
      {/* `html` is sanitized on write — see the legal API route. */}
      <LegalPage
        title={doc.title}
        updated={doc.updated || undefined}
        intro={doc.intro}
        html={doc.html}
      />
    </>
  );
}
