import Link from "next/link";

import { Brand } from "@/components/brand";
import { siteConfig } from "@/lib/site";

/**
 * Site footer: brand, legal + contact links, and a plain "free, no ads" note
 * (the product is free at launch — PRD §2, §13). Sentence case throughout.
 */
const footerLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border-subtle bg-paper">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Brand />
          <p className="text-sm text-ink-muted">
            Free on web, iOS, and Android. No ads, no paid tier.
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Footer">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-ink-secondary transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-border-subtle">
        <p className="mx-auto w-full max-w-5xl px-5 py-4 text-xs text-ink-muted">
          © {year} {siteConfig.name}. Made for people who don&apos;t want to forget.
        </p>
      </div>
    </footer>
  );
}
