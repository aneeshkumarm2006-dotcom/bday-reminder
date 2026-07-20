import Link from "next/link";

import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { navLinks } from "@/lib/site";

/**
 * Sticky site header (DESIGN.md §5 layout): brand, in-page nav, theme toggle,
 * and a "Coming soon" indicator (app not yet public). Flat - a hairline border
 * defines it.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
        <Brand />

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Primary"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Log in
          </Link>
          <span
            className="inline-flex h-9 cursor-default items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink-muted"
            aria-label="App coming soon"
          >
            Coming soon
          </span>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
