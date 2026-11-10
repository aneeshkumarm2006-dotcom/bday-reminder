"use client";

import { useEffect, useRef } from "react";

import { GoogleGlyph } from "@/components/google-glyph";
import { buttonVariants } from "@/components/ui/button";
import { PREFERRED_SOURCE_SCRIPT_SRC } from "@/lib/preferred-source";
import { cn } from "@/lib/utils";

/**
 * "Add as a preferred source on Google" — our own button on top of Google's
 * library in manual mode (the docs' "advanced" setup), so it wears the site's
 * button styles instead of Google's widget.
 *
 * Progressive enhancement:
 *   - Server-rendered as a plain link to the deeplink, in a new tab. With no
 *     JavaScript, before the library arrives, or if it's blocked, a click
 *     still works and the reader keeps this page open.
 *   - Once the library has loaded, the click runs `addPreferredSource()`
 *     instead: Google's own flow, which returns the reader to this page.
 *
 * Performance: the library is ~140 KB of script, so it isn't fetched on page
 * load. The first button to come within a screen of the viewport (or be
 * hovered/focused) injects it once, async, into <head> — exactly the tag the
 * docs give, plus `preferred-sources-control="manual"`. A visitor who never
 * scrolls near a button never downloads it. The button is a fixed-size link
 * from the first paint, so nothing shifts when the library lands.
 */

interface PreferredSourceApi {
  init(options: { theme?: "light" | "dark"; lang?: string }): void;
  addPreferredSource(): unknown;
}

type PreferredSourceQueue = { push(callback: (api: PreferredSourceApi) => void): unknown };

declare global {
  interface Window {
    PREFERRED_SOURCE?: PreferredSourceQueue | Array<(api: PreferredSourceApi) => void>;
  }
}

// Module-level so every button on the page shares one script tag and one init.
let requested = false;
let api: PreferredSourceApi | null = null;

function loadLibrary() {
  if (requested || typeof window === "undefined") return;
  requested = true;

  // The docs' callback queue: runs once the library is ready (or right away if
  // it already is).
  (window.PREFERRED_SOURCE = window.PREFERRED_SOURCE || []).push((preferredSource) => {
    try {
      const dark = document.documentElement.classList.contains("dark");
      // No `lang`: the library then follows the page's <html lang="en-US">.
      preferredSource.init({ theme: dark ? "dark" : "light" });
      api = preferredSource;
    } catch {
      // Leave `api` null — the buttons keep working as deeplinks.
    }
  });

  if (document.querySelector(`script[src="${PREFERRED_SOURCE_SCRIPT_SRC}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = PREFERRED_SOURCE_SCRIPT_SRC;
  script.setAttribute("preferred-sources-control", "manual");
  document.head.appendChild(script);
}

function openDeeplink(href: string) {
  window.open(href, "_blank", "noopener,noreferrer");
}

export function PreferredSourceButton({
  href,
  label = "Add as a preferred source on Google",
  variant = "secondary",
  size = "sm",
  className,
}: {
  /** The deeplink, from `preferredSourceDeeplink()` on the server. */
  href: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "default";
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || requested) return;
    if (typeof IntersectionObserver === "undefined") {
      loadLibrary();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadLibrary();
          observer.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    // Let modified clicks (new tab/window) do what the reader asked for.
    if (!api || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    try {
      const result = api.addPreferredSource();
      if (result && typeof (result as Promise<unknown>).catch === "function") {
        (result as Promise<unknown>).catch(() => openDeeplink(href));
      }
    } catch {
      openDeeplink(href);
    }
  }

  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      onPointerEnter={loadLibrary}
      onFocus={loadLibrary}
      className={cn(
        buttonVariants({ variant, size }),
        // Wrap rather than overflow on a 320px phone; keep the 36px+ target.
        "h-auto min-h-9 whitespace-normal py-2 text-left leading-snug",
        size === "default" && "min-h-11",
        className,
      )}
    >
      <GoogleGlyph />
      <span>{label}</span>
    </a>
  );
}
