import Link from "next/link";

import { Brand } from "@/components/brand";
import { visibleFooterGroups } from "@/lib/content/get";
import type { NavigationConfig, SocialLink } from "@/lib/content/types";

/**
 * Site footer: brand, admin-managed link groups, social profiles, and the legal
 * line. Sentence case throughout.
 *
 * A single untitled group renders as today's flat link row; add a second group
 * (or give one a title) and the same data renders as columns — so the SEO team
 * can grow the footer without a code change.
 */
export function SiteFooter({
  navigation,
  socials = [],
  siteName,
}: {
  navigation: NavigationConfig;
  socials?: SocialLink[];
  siteName: string;
}) {
  const year = new Date().getFullYear();
  const groups = visibleFooterGroups(navigation);
  const flat = groups.length === 1 && !groups[0].title.trim();
  const orderedSocials = [...socials]
    .filter((s) => s.url.trim() && s.platform.trim())
    .sort((a, b) => a.order - b.order);

  const legalLine = navigation.footer.legalLine
    .replace(/\{year\}/g, String(year))
    .replace(/\{name\}/g, siteName);

  return (
    <footer className="border-t border-border-subtle bg-paper">
      <div
        className={
          flat
            ? "mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between"
            : "mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-10 sm:flex-row sm:justify-between"
        }
      >
        <div className="flex flex-col gap-2">
          <Brand />
          {navigation.footer.tagline && (
            <p className="text-sm text-ink-muted">{navigation.footer.tagline}</p>
          )}
          {orderedSocials.length > 0 && (
            <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              {orderedSocials.map((social) => (
                <li key={social.id}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer me"
                    className="text-sm text-ink-secondary transition-colors hover:text-ink"
                  >
                    {social.platform}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {flat ? (
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Footer">
            {groups[0].links.map((link) => (
              <FooterLink key={link.id} label={link.label} href={link.href} external={link.external} />
            ))}
          </nav>
        ) : (
          <nav className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3" aria-label="Footer">
            {groups.map((group) => (
              <div key={group.id} className="flex flex-col gap-2">
                {group.title && (
                  <p className="font-display text-sm font-semibold text-ink">{group.title}</p>
                )}
                {group.links.map((link) => (
                  <FooterLink
                    key={link.id}
                    label={link.label}
                    href={link.href}
                    external={link.external}
                  />
                ))}
              </div>
            ))}
          </nav>
        )}
      </div>
      <div className="border-t border-border-subtle">
        <p className="mx-auto w-full max-w-5xl px-5 py-4 text-xs text-ink-muted">
          {legalLine}
        </p>
      </div>
    </footer>
  );
}

function FooterLink({
  label,
  href,
  external,
}: {
  label: string;
  href: string;
  external: boolean;
}) {
  const className =
    "text-sm text-ink-secondary transition-colors hover:text-ink";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
