import Link from "next/link";

import { BrandRing } from "@/components/brand-ring";
import { siteConfig } from "@/lib/site";

/** Centered card used by the login + signup pages. Brand ring up top, no chrome. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex flex-col items-center gap-3" aria-label={`${siteConfig.name} — home`}>
          <BrandRing size="lg" />
          <span className="font-display text-lg font-semibold text-ink">{siteConfig.name}</span>
        </Link>

        <div className="rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8">
          <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-secondary">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-6 text-center text-sm text-ink-secondary">{footer}</div>}
      </div>
    </div>
  );
}
