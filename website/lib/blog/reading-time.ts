import { parse } from "node-html-parser";

/** Rough reading time in minutes (≈220 wpm), minimum 1. Accepts HTML or text. */
export function readingTimeMinutes(html: string): number {
  let text = html || "";
  if (/[<>]/.test(text)) {
    try {
      text = parse(text).text;
    } catch {
      // fall back to the raw string
    }
  }
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
