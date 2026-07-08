import { brandMark } from "@/lib/brand-mark";

/**
 * Stable-URL PWA icons for the web app manifest. Unlike the generated
 * `icon`/`apple-icon` file conventions (whose URLs carry a build hash), these
 * live at predictable paths — `/icons/192`, `/icons/512`, `/icons/maskable` —
 * so `manifest.ts` and the Organization `logo` in structured data can reference
 * them directly. Regenerated hourly to keep the date current.
 */
export const revalidate = 3600;
export const dynamicParams = false;

const SPECS: Record<string, { pixels: number; safe: boolean }> = {
  "192": { pixels: 192, safe: false },
  "512": { pixels: 512, safe: false },
  maskable: { pixels: 512, safe: true },
};

export function generateStaticParams() {
  return Object.keys(SPECS).map((icon) => ({ icon }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ icon: string }> },
) {
  const { icon } = await params;
  const spec = SPECS[icon];
  if (!spec) {
    return new Response("Not found", { status: 404 });
  }
  return brandMark(spec.pixels, { bleed: true, safe: spec.safe });
}
