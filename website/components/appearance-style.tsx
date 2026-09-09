import type { AppearanceConfig } from "@/lib/content/types";

/**
 * Site-settings colours and radii, emitted as CSS custom properties.
 *
 * `globals.css` maps every Tailwind utility to `var(--biro)`, `var(--radius-md)`
 * and friends with `@theme inline`, so redefining those variables on a wrapper
 * element repaints everything nested inside it — no class rewriting, no build
 * step, and no chance of a half-restyled page.
 *
 * A style *element* rather than an inline `style` attribute because the dark
 * accent has to live behind `.dark`, which an inline style can't express. Values
 * are validated as CSS colours on write (`cssColor` in `validation.ts`) and the
 * radius is an integer, so nothing user-shaped reaches this string; the scope
 * class keeps it off the admin panel and the authenticated app either way.
 */
export const APPEARANCE_SCOPE = "site-appearance";

/** The `--radius-*` scale, keyed off the one value the admin sets. */
function radiusVars(base: number): string {
  return [
    `--radius-sm:${Math.max(2, Math.round(base * 0.6))}px`,
    `--radius-md:${base}px`,
    `--radius-lg:${Math.round(base * 1.4)}px`,
    `--radius-xl:${Math.round(base * 2)}px`,
    `--radius-2xl:${Math.round(base * 2.8)}px`,
  ].join(";");
}

export function AppearanceStyle({ appearance }: { appearance: AppearanceConfig }) {
  const accent = appearance.accent.trim();
  const accentDark = appearance.accentDark.trim() || accent;
  const radius = appearance.radius;

  const rules: string[] = [];

  const base: string[] = [];
  if (accent) {
    // `--biro-tint` is the wash behind chips and hero gradients. Deriving it
    // from the accent with colour-mix keeps the pair in step; a hand-set tint
    // would be one more thing to get wrong.
    base.push(
      `--biro:${accent}`,
      `--biro-hover:color-mix(in oklab, ${accent} 88%, black)`,
      `--biro-pressed:color-mix(in oklab, ${accent} 76%, black)`,
      `--biro-tint:color-mix(in oklab, ${accent} 10%, white)`,
    );
  }
  if (radius > 0) base.push(radiusVars(radius));
  if (base.length > 0) rules.push(`.${APPEARANCE_SCOPE}{${base.join(";")}}`);

  if (accentDark) {
    rules.push(
      `.dark .${APPEARANCE_SCOPE}{--biro:${accentDark};--biro-hover:color-mix(in oklab, ${accentDark} 88%, white);--biro-pressed:color-mix(in oklab, ${accentDark} 72%, white);--biro-tint:color-mix(in oklab, ${accentDark} 22%, black)}`,
    );
  }

  // Respecting the toggle here rather than in every `<Reveal>` keeps one rule to
  // reason about, and it matches how `prefers-reduced-motion` already works.
  if (!appearance.animations) {
    rules.push(
      `.${APPEARANCE_SCOPE} *,.${APPEARANCE_SCOPE} *::before,.${APPEARANCE_SCOPE} *::after{animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important}`,
    );
  }

  if (rules.length === 0) return null;
  return <style>{rules.join("")}</style>;
}
