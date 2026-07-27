import type * as React from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getNavigation, getSiteSettings } from "@/lib/content/get";

/**
 * The public site's header + footer around arbitrary children, with the
 * admin-managed navigation resolved for you.
 *
 * The `(marketing)` layout composes these directly (it also owns the
 * announcement bar and skip link); this wrapper exists for the preview routes
 * under `/seoteam`, which need the real chrome but sit outside that route group.
 */
export async function SiteChrome({ children }: { children: React.ReactNode }) {
  const [navigation, settings] = await Promise.all([getNavigation(), getSiteSettings()]);
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader navigation={navigation} />
      {children}
      <SiteFooter
        navigation={navigation}
        socials={settings.socials}
        siteName={settings.identity.name}
      />
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
