import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";
import { PageGraph } from "@/components/page-graph";
import { getLegalDoc, getPageMeta } from "@/lib/content/get";
import { metadataForPath } from "@/lib/content/metadata";

// Admin-managed (/seoteam/meta for SEO, /seoteam/legal for the copy); both fall
// back to the hardcoded defaults when no database is configured.
export function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/terms");
}

export default async function TermsPage() {
  const [doc, meta] = await Promise.all([getLegalDoc("terms"), getPageMeta("/terms")]);

  return (
    <>
      {/* No `dateModified` — see the privacy page for why `doc.updated` can't
          become one. */}
      <PageGraph
        path="/terms"
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
