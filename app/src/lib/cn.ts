/** Join class name fragments, dropping falsy ones. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * The shared visible focus ring (DESIGN.md §11): 2px biro, 2px offset, web-only
 * (`focus-visible`). Applied to every interactive element so keyboard users get
 * a consistent indicator. Mirrors the literal used inside Button/Input.
 */
export const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-biro';
