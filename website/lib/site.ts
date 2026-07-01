/**
 * Shared marketing-site constants (Stage 11). One source of truth for the name,
 * copy, and outbound links used across metadata, header, footer, sitemap, robots
 * and the OG image. URLs read from env so deploys can point at the real hosts.
 */
export const siteConfig = {
  name: "Circle the date",
  tagline: "Remember, and act.",
  description:
    "Never miss a birthday, and actually do something about it. Circle the date stores birthdays and events for everyone you care about, reminds you across push, email, and SMS (US & Canada), and makes it one tap to send a greeting. Free on web, iOS, and Android.",
  // The marketing site's own origin (used for canonical, OG, sitemap).
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://circlethedate.app",
  // The web app (the deployed Expo web build) - the "open the app" target.
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://app.circlethedate.app",
  contactEmail: "hello@circlethedate.app",
} as const;

export const navLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/#get-the-app", label: "Coming soon" },
] as const;
