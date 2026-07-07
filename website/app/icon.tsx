import { ImageResponse } from "next/og";

/**
 * Generated favicon (Stage 11 SEO), replacing the old static `icon.svg`. The
 * mark is the brand ring circling *today's* day number, so the tab icon reads
 * as the current date instead of a frozen "12".
 *
 * `revalidate` regenerates the PNG so it keeps up with the calendar; note that
 * browsers cache favicons aggressively, so a given tab may lag until its cache
 * expires - but a fresh load always gets today.
 */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";
export const revalidate = 3600;

// The wobbly ring blob, kept from the original favicon so the mark is unchanged
// apart from the (now dynamic) number.
const BLOB_PATH =
  "M33 12 C46 11 53 21 52 32 C51 44 39 52 27 50 C16 48 11 37 13 26 C15 16 23 12 35 13";

export default function Icon() {
  const day = new Date().getDate();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#FCFBF8",
          borderRadius: 14,
        }}
      >
        <svg
          width={64}
          height={64}
          viewBox="0 0 64 64"
          style={{ transform: "rotate(-4deg)" }}
        >
          <path d={BLOB_PATH} fill="#2C4BD8" />
        </svg>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 64,
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: day >= 10 ? 26 : 32,
            fontWeight: 600,
            color: "#FCFBF8",
          }}
        >
          {day}
        </div>
      </div>
    ),
    { ...size },
  );
}
