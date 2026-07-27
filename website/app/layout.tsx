import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Inter } from "next/font/google";

import { AnalyticsScripts } from "@/components/analytics-scripts";
import { ThemeProvider } from "@/components/theme-provider";
import { AppProviders } from "@/providers/app-providers";
import { getSiteSettings } from "@/lib/content/get";
import { siteConfig } from "@/lib/site";

import "./globals.css";

// Display / numerals + body / UI (DESIGN.md §4, §12.3). Two weights each; the
// ring's day-number is a Hanken hero, everything functional is Inter.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-hanken",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
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
  const { identity, seo } = settings;
  const indexable = seo.indexingEnabled;

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
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { analytics } = await getSiteSettings();

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
        <ThemeProvider>
          <AppProviders>{children}</AppProviders>
        </ThemeProvider>

        {/* Tag IDs come from Site settings; never a raw script blob. */}
        <AnalyticsScripts analytics={analytics} />
      </body>
    </html>
  );
}
