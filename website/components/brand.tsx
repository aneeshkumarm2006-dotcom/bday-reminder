import Link from "next/link";

import { BrandRing } from "@/components/brand-ring";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";
import type { BrandConfig } from "@/lib/content/types";

/**
 * The wordmark - a small ring circling today's date + the name in the display
 * face. The ring stays a date, never bare decoration (DESIGN.md §13).
 *
 * The public site passes `brand` and `siteName` down from Site settings, so an
 * uploaded logo, a different wordmark, or a logo-only lockup are all content
 * changes. With no props it renders exactly what it always did, which is what
 * the authenticated app's sidebar (a client component, no settings read) wants.
 */
export function Brand({
  className,
  brand,
  siteName,
}: {
  className?: string;
  brand?: BrandConfig;
  siteName?: string;
}) {
  const name = brand?.wordmark?.trim() || siteName?.trim() || siteConfig.name;
  const showRing = brand ? brand.showRing : true;
  const showWordmark = brand ? brand.showWordmark : true;
  const logo = brand?.logoUrl?.trim() ?? "";
  const logoDark = brand?.logoDarkUrl?.trim() ?? "";
  const height = brand?.logoHeight || 28;

  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2.5 rounded-md", className)}
      aria-label={`${name} - home`}
    >
      {logo ? (
        <>
          {/* Plain <img>: the file comes from the media library or any host the
              admin typed, neither of which next/image has allowlisted. The dark
              variant is a second <img> toggled by CSS rather than a JS theme
              read, so it can't flash the wrong logo on first paint. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt={brand?.logoAlt || name}
            style={{ height }}
            className={cn("w-auto object-contain", logoDark && "dark:hidden")}
          />
          {logoDark && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoDark}
              alt={brand?.logoAlt || name}
              style={{ height }}
              className="hidden w-auto object-contain dark:block"
            />
          )}
        </>
      ) : (
        showRing && <BrandRing size="sm" />
      )}
      {showWordmark && (
        <span className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
          {name}
        </span>
      )}
    </Link>
  );
}
