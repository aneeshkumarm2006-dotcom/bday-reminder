import { Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal-page";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with the ${siteConfig.name} team.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact"
      intro="Found a bug, have an idea, or need a hand? We'd love to hear from you."
    >
      <p>
        {siteConfig.name} is a small, free project. The fastest way to reach us is email.
        We read every message.
      </p>

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
        <Link href={`mailto:${siteConfig.contactEmail}`} className={buttonVariants()}>
          {siteConfig.contactEmail}
        </Link>
      </div>

      <p>
        For privacy questions, see our{" "}
        <Link href="/privacy">privacy policy</Link>. For the terms of use, see our{" "}
        <Link href="/terms">terms</Link>.
      </p>
    </LegalPage>
  );
}
