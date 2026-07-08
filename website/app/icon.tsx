import { brandMark } from "@/lib/brand-mark";

/**
 * Generated favicon (Stage 11 SEO), replacing the old static `icon.svg`. The
 * mark is the brand ring circling *today's* day number, so the tab icon reads
 * as the current date instead of a frozen "12". `revalidate` regenerates the PNG
 * hourly so it keeps up with the calendar.
 */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";
export const revalidate = 3600;

export default function Icon() {
  return brandMark(size.width);
}
