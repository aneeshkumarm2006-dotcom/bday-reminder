"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { navLinks } from "@/lib/site";

/**
 * Mobile disclosure menu (Stage 12 a11y). The desktop <nav> is hidden below md;
 * without this the in-page section links are unreachable on phones. A labelled
 * button (aria-expanded / aria-controls) toggles the same links; selecting one
 * closes the panel. Hidden at md and up, where the desktop nav takes over.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className="absolute left-0 right-0 top-16 border-b border-border-subtle bg-paper px-5 py-2 shadow-sm"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-3 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
