import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/site";

/**
 * Generated Open Graph / Twitter card (Stage 11 SEO). On-brand: the filled
 * "today" ring on a date, the wordmark, and the tagline on warm paper.
 */
export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const RING_PATH =
  "M33 8 C49 7 58 19 57 32 C56 47 41 57 26 55 C12 53 6 39 9 25 C12 13 22 8 36 9";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#FCFBF8",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <div style={{ position: "relative", display: "flex", width: 150, height: 150 }}>
            <svg
              width={150}
              height={150}
              viewBox="0 0 64 64"
              style={{ transform: "rotate(-4deg)" }}
            >
              <path d={RING_PATH} fill="#2C4BD8" />
            </svg>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 150,
                height: 150,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ fontSize: 52, fontWeight: 700, color: "#FCFBF8", lineHeight: 1 }}>
                12
              </div>
              <div style={{ fontSize: 18, color: "#FCFBF8", opacity: 0.85, marginTop: 2 }}>
                Jun
              </div>
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 600, color: "#232020" }}>
            {siteConfig.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 88, fontWeight: 700, color: "#232020", letterSpacing: "-2px" }}>
            Remember — and act.
          </div>
          <div style={{ fontSize: 34, color: "#5C574F", marginTop: 20 }}>
            Never miss a birthday — free on web, iOS &amp; Android.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
