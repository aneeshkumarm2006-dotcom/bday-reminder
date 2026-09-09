import { AnnouncementBar } from "@/components/announcement-bar";
import { APPEARANCE_SCOPE, AppearanceStyle } from "@/components/appearance-style";
import { MotionPreference } from "@/components/motion-preference";
import { ProductDemoProvider } from "@/components/product-demo-context";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getNavigation, getSiteSettings } from "@/lib/content/get";
import { isAnnouncementLive } from "@/lib/content/schedule";

/**
 * Marketing chrome (DESIGN.md §7) — the public site's announcement bar, sticky
 * header, skip link, and footer. Lives in the (marketing) route group so the
 * authenticated app shell can render without it.
 *
 * Header/footer content, the wordmark, the announcement, the palette, and the
 * sample data in the rendered product shots all come from the admin panel, with
 * `lib/content/defaults.ts` as the fallback, so this renders unchanged when no
 * database is configured. The announcement's schedule window is evaluated here,
 * per request — an expired message never reaches the client.
 *
 * The appearance overrides are scoped to this subtree, not to `:root`: the
 * admin panel and the authenticated app keep the built-in palette whatever the
 * marketing site is repainted to.
 */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, navigation] = await Promise.all([getSiteSettings(), getNavigation()]);
  const showAnnouncement = isAnnouncementLive(settings.announcement);

  return (
    <div className={`${APPEARANCE_SCOPE} flex min-h-dvh flex-col`}>
      <AppearanceStyle appearance={settings.appearance} />
      <MotionPreference enabled={settings.appearance.animations}>
        <ProductDemoProvider demo={settings.productDemo}>
          <a
            href="#main"
            className="sr-only rounded-md bg-surface px-4 py-2 font-display text-ink focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
          >
            Skip to content
          </a>
          {showAnnouncement && <AnnouncementBar announcement={settings.announcement} />}
          <SiteHeader
            navigation={navigation}
            brand={settings.brand}
            siteName={settings.identity.name}
            showThemeToggle={settings.appearance.showThemeToggle}
          />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter
            navigation={navigation}
            socials={settings.socials}
            siteName={settings.identity.name}
            brand={settings.brand}
          />
        </ProductDemoProvider>
      </MotionPreference>
    </div>
  );
}
