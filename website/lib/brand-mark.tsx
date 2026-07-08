import { ImageResponse } from "next/og";

/**
 * The brand mark — the wobbly ring circling *today's* day number — rendered as a
 * PNG at an arbitrary size. Shared by the favicon (app/icon.tsx), the
 * apple-touch-icon (app/apple-icon.tsx) and the PWA manifest icons
 * (app/icons/[icon]/route.tsx) so the mark stays pixel-identical across every
 * surface. Callers set `revalidate` so the date stays current (browsers cache
 * icons hard, so a given surface may lag until its cache expires).
 */

// The ring blob in the 0–64 viewBox the original favicon used.
const BLOB_PATH =
  "M33 12 C46 11 53 21 52 32 C51 44 39 52 27 50 C16 48 11 37 13 26 C15 16 23 12 35 13";

const PAPER = "#FCFBF8";
const BIRO = "#2C4BD8";

type BrandMarkOptions = {
  /** Fill the whole square with an opaque tile (no rounded corners). Use for
   *  apple-touch and Android icons, which get masked/rounded by the OS. */
  bleed?: boolean;
  /** Shrink the mark into the central ~72% safe zone so an adaptive/maskable
   *  mask can clip it to any shape without cropping the number. */
  safe?: boolean;
};

export function brandMark(
  pixels: number,
  { bleed = false, safe = false }: BrandMarkOptions = {},
): ImageResponse {
  const day = new Date().getDate();
  const markPx = Math.round(pixels * (safe ? 0.72 : 1));
  // Two-digit days need a smaller glyph to stay inside the ring.
  const numberFont = Math.round(markPx * (day >= 10 ? 0.4 : 0.5));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          backgroundColor: PAPER,
          borderRadius: bleed ? 0 : pixels * 0.22,
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            width: markPx,
            height: markPx,
          }}
        >
          <svg
            width={markPx}
            height={markPx}
            viewBox="0 0 64 64"
            style={{ transform: "rotate(-4deg)" }}
          >
            <path d={BLOB_PATH} fill={BIRO} />
          </svg>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: markPx,
              height: markPx,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: numberFont,
              fontWeight: 600,
              color: PAPER,
            }}
          >
            {day}
          </div>
        </div>
      </div>
    ),
    { width: pixels, height: pixels },
  );
}
