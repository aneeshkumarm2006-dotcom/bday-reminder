import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Inter } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { AppProviders } from "@/providers/app-providers";
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

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} - ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "birthday reminder",
    "birthday app",
    "reminder app",
    "anniversary reminder",
    "shared family calendar",
    "family birthday calendar",
    "SMS birthday reminders",
    "group birthday tracker",
    "never miss a birthday",
  ],
  authors: [{ name: siteConfig.name }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: `${siteConfig.name} - ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: siteConfig.url,
    // US-first, with Canada signalled as an alternate (both share +1 / English).
    locale: "en_US",
    alternateLocale: ["en_CA"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} - ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfbf8" },
    { media: "(prefers-color-scheme: dark)", color: "#18171a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
      </body>
    </html>
  );
}
