import type { Metadata } from "next";

import { HubShell } from "@/components/analyticshub/hub-shell";

/** Private dashboard — never indexed (also enforced by robots.ts + proxy header). */
export const metadata: Metadata = {
  title: { default: "Analytics hub", template: "%s · Analytics hub" },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function AnalyticsHubLayout({ children }: { children: React.ReactNode }) {
  return <HubShell>{children}</HubShell>;
}
