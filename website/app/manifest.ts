import type { MetadataRoute } from "next";

import { getSiteSettings } from "@/lib/content/get";

// Regenerated per request so a rename in Site settings reaches installed PWAs.
export const dynamic = "force-dynamic";

/** Web app manifest (Stage 11 SEO / installability), named from Site settings. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { identity } = await getSiteSettings();
  return {
    name: identity.name,
    short_name: identity.name,
    description: identity.description,
    start_url: "/",
    display: "standalone",
    background_color: "#FCFBF8",
    theme_color: "#FCFBF8",
    icons: [
      { src: "/icon", type: "image/png", sizes: "64x64" },
      { src: "/icons/192", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/icons/512", type: "image/png", sizes: "512x512", purpose: "any" },
      { src: "/icons/maskable", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
