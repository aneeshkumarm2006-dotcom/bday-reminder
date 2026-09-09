import type { Metadata } from "next";
import Link from "next/link";

import { ContentIcon } from "@/components/content-icon";
import { LegalPage } from "@/components/legal-page";
import { PageBlocks } from "@/components/marketing/page-blocks";
import { PageGraph } from "@/components/page-graph";
import { buttonVariants } from "@/components/ui/button";
import {
  getBuiltInPages,
  getLegalDoc,
  getPageMeta,
  getSiteSettings,
} from "@/lib/content/get";
import { metadataForPath } from "@/lib/content/metadata";

// Admin-managed end to end: /seoteam/meta for the SEO, /seoteam/legal for the
// body copy, /seoteam/built-in for the email card and the guidance beneath it.
// All three fall back to the hardcoded defaults when no database is configured.
export function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/contact");
}

export default async function ContactPage() {
  const [doc, meta, settings, builtIn] = await Promise.all([
    getLegalDoc("contact"),
    getPageMeta("/contact"),
    getSiteSettings(),
    getBuiltInPages(),
  ]);
  // The email is one value, owned by Site settings — the contact card and the
  // Organization structured data both read it from there.
  const email = settings.identity.contactEmail;
  const card = builtIn.contact;

  return (
    <>
      {/* The second of the two pages that describe the company in full, and the
          only one where the address is actually on screen — which is what makes
          a contactPoint here a true representation rather than a claim. */}
      <PageGraph
        path="/contact"
        type="ContactPage"
        name={meta.title || doc.title}
        description={meta.description}
        about="organization"
        fullOrganization
        breadcrumb={[{ name: "Home", path: "/" }, { name: doc.title }]}
        customJsonLd={meta.customJsonLd}
      />
      <LegalPage
        title={doc.title}
        updated={doc.updated || undefined}
        intro={doc.intro}
        html={doc.html}
      >
        {card.cardEnabled && email && (
          <div className="not-prose flex flex-col items-start gap-4 rounded-lg border border-border-subtle bg-surface p-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-biro-tint text-biro">
              <ContentIcon name={card.cardIcon} />
            </span>
            <div>
              <p className="font-display text-lg font-semibold text-ink">{card.cardHeading}</p>
              {card.cardBody && (
                <p className="mt-1 text-sm text-ink-secondary">{card.cardBody}</p>
              )}
            </div>
            <Link href={`mailto:${email}`} className={buttonVariants()}>
              {email}
            </Link>
          </div>
        )}
      </LegalPage>

      {/* The guidance that used to be a hardcoded component here ships as an
          HTML block in the built-in-pages defaults, so it stays in this position
          and is now editable — as is anything else added after it. */}
      <PageBlocks blocks={card.blocksAfter} />
    </>
  );
}
