import Link from "next/link";

import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { visibleHeaderLinks } from "@/lib/content/get";
import type { NavigationConfig } from "@/lib/content/types";

/**
 * Sticky site header (DESIGN.md §5 layout): brand, in-page nav, theme toggle,
 * and the sign-in / sign-up calls to action. Flat — a hairline border defines it.
 *
 * Links and CTA labels are admin-managed (`/seoteam/navigation`). An empty
 * sign-up href keeps today's static "Coming soon" chip; set one and the same
 * slot becomes a real button, so launching the app is a content change.
 */
export function SiteHeader({ navigation }: { navigation: NavigationConfig }) {
  const links = visibleHeaderLinks(navigation);
  const { ctas } = navigation.header;

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
        <Brand />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              {...(link.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {ctas.show && (
            <div className="hidden items-center gap-1.5 md:flex">
              {ctas.loginLabel && (
                <Link
                  href="/login"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  {ctas.loginLabel}
                </Link>
              )}
              {ctas.signupLabel &&
                (ctas.signupHref ? (
                  <Link href={ctas.signupHref} className={buttonVariants({ size: "sm" })}>
                    {ctas.signupLabel}
                  </Link>
                ) : (
                  <span
                    className="inline-flex h-9 cursor-default items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink-muted"
                    aria-label={`${ctas.signupLabel} — not available yet`}
                  >
                    {ctas.signupLabel}
                  </span>
                ))}
            </div>
          )}
          <MobileNav links={links} ctas={ctas} />
        </div>
      </div>
    </header>
  );
}
