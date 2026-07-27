import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getNavigation, getSiteSettings } from "@/lib/content/get";
import { isAnnouncementLive } from "@/lib/content/schedule";

/**
 * Marketing chrome (DESIGN.md §7) — the public site's announcement bar, sticky
 * header, skip link, and footer. Lives in the (marketing) route group so the
 * authenticated app shell can render without it.
 *
 * Header/footer content and the announcement come from the admin panel, with
 * `lib/content/defaults.ts` as the fallback, so this renders unchanged when no
 * database is configured. The announcement's schedule window is evaluated here,
 * per request — an expired message never reaches the client.
 */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, navigation] = await Promise.all([getSiteSettings(), getNavigation()]);
  const showAnnouncement = isAnnouncementLive(settings.announcement);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only rounded-md bg-surface px-4 py-2 font-display text-ink focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>
      {showAnnouncement && <AnnouncementBar announcement={settings.announcement} />}
      <SiteHeader navigation={navigation} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter navigation={navigation} socials={settings.socials} siteName={settings.identity.name} />
    </div>
  );
}
