import type * as React from "react";

import { APPEARANCE_SCOPE, AppearanceStyle } from "@/components/appearance-style";
import { MotionPreference } from "@/components/motion-preference";
import { ProductDemoProvider } from "@/components/product-demo-context";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getNavigation, getSiteSettings } from "@/lib/content/get";

/**
 * The public site's header + footer around arbitrary children, with the
 * admin-managed navigation, wordmark, palette and demo data resolved for you.
 *
 * The `(marketing)` layout composes these directly (it also owns the
 * announcement bar and skip link); this wrapper exists for the preview routes
 * under `/seoteam`, which need the real chrome but sit outside that route group.
 * It has to apply the same appearance scope and providers, or a preview would
 * show the built-in palette and the built-in demo cast rather than the site's —
 * which is the one thing a preview must not do.
 */
export async function SiteChrome({ children }: { children: React.ReactNode }) {
  const [navigation, settings] = await Promise.all([getNavigation(), getSiteSettings()]);
  return (
    <div className={`${APPEARANCE_SCOPE} flex min-h-dvh flex-col`}>
      <AppearanceStyle appearance={settings.appearance} />
      <MotionPreference enabled={settings.appearance.animations}>
        <ProductDemoProvider demo={settings.productDemo}>
          <SiteHeader
            navigation={navigation}
            brand={settings.brand}
            siteName={settings.identity.name}
            showThemeToggle={settings.appearance.showThemeToggle}
          />
          {children}
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

/** The amber "this isn't live" strip shown above every draft preview. */
export function PreviewBanner({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border-subtle bg-warn-bg">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm text-warn-fg">
        <span className="font-medium">{message}</span>
        {action}
      </div>
    </div>
  );
}
