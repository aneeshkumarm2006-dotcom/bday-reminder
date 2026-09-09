import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { AnalyticsScripts } from "@/components/analytics-scripts";
import { ThemeProvider } from "@/components/theme-provider";
import { AppProviders } from "@/providers/app-providers";
import { getSiteSettings } from "@/lib/content/get";
import { siteConfig } from "@/lib/site";

import "./globals.css";

// Display / numerals + body / UI (DESIGN.md §4, §12.3). Two weights each; the
// ring's day-number is a Hanken hero, everything functional is Inter.
//
// These are vendored in `app/fonts/` rather than pulled from `next/font/google`
// on purpose. The Google loader downloads the woff2 files at build time, and
// Google rotates the hashed filenames in its CSS: once Turbopack's build cache
// held a stale stylesheet, every `src: url(...)` in it 404'd and the deploy
// died with "Can't resolve @vercel/turbopack-next/internal/font/google/font".
// Vendoring makes the build hermetic — nothing to fetch, nothing to go stale.
//
// Regenerate with `npm run fonts:build` after changing a family or weight.
const hanken = localFont({
  src: [
    { path: "./fonts/HankenGrotesk-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/HankenGrotesk-SemiBold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-hanken",
  display: "swap",
});

const inter = localFont({
  src: [
    { path: "./fonts/Inter-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Inter-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Root metadata is admin-driven (Site settings → SEO defaults), with the
 * hardcoded values in `lib/content/defaults.ts` as the fallback — so this
 * renders identically whether or not a database is configured.
 *
 * `metadataBase` stays env-driven on purpose: the origin is a deploy concern,
 * not a content one, and getting it from the DB would let a bad edit break
 * every canonical and OG URL at once.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const { brand, identity, seo } = settings;
  const indexable = seo.indexingEnabled;
  // With no uploaded favicon, Next's own file conventions win (`app/icon.tsx`
  // draws the ring around today's date). An uploaded one has to be declared
  // explicitly, or the generated icon would keep taking precedence.
  const favicon = brand.faviconUrl.trim();

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: seo.defaultTitle,
      template: seo.titleTemplate,
    },
    description: seo.defaultDescription,
    applicationName: identity.name,
    keywords: seo.keywords,
    authors: [{ name: identity.name }],
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: identity.name,
      title: seo.defaultTitle,
      description: seo.defaultDescription,
      url: siteConfig.url,
      ...(seo.ogImage ? { images: [{ url: seo.ogImage }] } : {}),
      // US-first, with Canada signalled as an alternate (both share +1 / English).
      locale: "en_US",
      alternateLocale: ["en_CA"],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.defaultTitle,
      description: seo.defaultDescription,
      ...(seo.twitterHandle ? { site: seo.twitterHandle, creator: seo.twitterHandle } : {}),
      ...(seo.ogImage ? { images: [seo.ogImage] } : {}),
    },
    // The sitewide kill-switch: one toggle in the admin's danger zone.
    robots: {
      index: indexable,
      follow: indexable,
      ...(indexable ? {} : { googleBot: { index: false, follow: false } }),
    },
    ...(favicon ? { icons: { icon: favicon, shortcut: favicon, apple: favicon } } : {}),
    verification: {
      ...(seo.verification.google ? { google: seo.verification.google } : {}),
      ...(seo.verification.bing ? { other: { "msvalidate.01": seo.verification.bing } } : {}),
      ...(seo.verification.pinterest ? { pinterest: seo.verification.pinterest } : {}),
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfbf8" },
    { media: "(prefers-color-scheme: dark)", color: "#18171a" },
  ],
  // Shrink the layout viewport when the on-screen keyboard opens, so a `fixed`
  // bottom-sheet dialog is laid out above it instead of behind it. Chromium
  // honours this; Safari ignores it, which is why Dialog also measures
  // `visualViewport` itself (see components/ui/dialog.tsx).
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { analytics, appearance } = await getSiteSettings();

  return (
    <html
      lang="en-US"
      suppressHydrationWarning
      className={`${hanken.variable} ${inter.variable} h-full`}
    >
      <body
        suppressHydrationWarning
        className="flex min-h-full flex-col bg-paper font-body text-ink antialiased"
      >
        <ThemeProvider defaultTheme={appearance.defaultTheme}>
          <AppProviders>{children}</AppProviders>
        </ThemeProvider>

        {/* Tag IDs come from Site settings; never a raw script blob. */}
        <AnalyticsScripts analytics={analytics} />
      </body>
    </html>
  );
}
