import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/** Web app manifest (Stage 11 SEO / installability). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: "Circle the date",
    description: siteConfig.description,
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
