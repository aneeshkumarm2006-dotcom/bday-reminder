import { brandMark } from "@/lib/brand-mark";

/**
 * Apple touch icon (180×180) for iOS "Add to Home Screen". Rendered opaque and
 * full-bleed — iOS applies its own rounded-rect mask, so we must not round or
 * leave transparent corners (which iOS fills with black).
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const revalidate = 3600;

export default function AppleIcon() {
  return brandMark(size.width, { bleed: true });
}
