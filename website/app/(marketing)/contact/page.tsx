import { Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CustomJsonLd } from "@/components/custom-json-ld";
import { LegalPage } from "@/components/legal-page";
import { buttonVariants } from "@/components/ui/button";
import { getLegalDoc, getPageMeta, getSiteSettings } from "@/lib/content/get";
import { metadataForPath } from "@/lib/content/metadata";

// Admin-managed (/seoteam/meta for SEO, /seoteam/legal for the copy); both fall
// back to the hardcoded defaults when no database is configured.
export function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/contact");
}

export default async function ContactPage() {
  const [doc, meta, settings] = await Promise.all([
    getLegalDoc("contact"),
    getPageMeta("/contact"),
    getSiteSettings(),
  ]);
  // The email is one value, owned by Site settings — the contact card and the
  // Organization structured data both read it from there.
  const email = settings.identity.contactEmail;

  return (
    <>
      <CustomJsonLd json={meta.customJsonLd} />
      <LegalPage
        title={doc.title}
        updated={doc.updated || undefined}
        intro={doc.intro}
        html={doc.html}
      >
        {email && (
          <div className="not-prose flex flex-col items-start gap-4 rounded-lg border border-border-subtle bg-surface p-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-biro-tint text-biro">
              <Mail size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-lg font-semibold text-ink">Email us</p>
              <p className="mt-1 text-sm text-ink-secondary">
                We usually reply within a couple of days.
              </p>
            </div>
            <Link href={`mailto:${email}`} className={buttonVariants()}>
              {email}
            </Link>
          </div>
        )}
      </LegalPage>
    </>
  );
}
