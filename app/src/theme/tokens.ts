/**
 * Design tokens as plain JS - the source of truth for imperative styling
 * (SVG stroke/fill, status bar, native controls) where a NativeWind `className`
 * / CSS variable can't reach. These hex values MUST stay in sync with the CSS
 * variables in `src/global.css` (which drive the className utilities).
 *
 * Mirrors DESIGN.md §3 (color), §5 (spacing / radius).
 */

export type Tokens = {
  paper: string;
  surface: string;
  surfaceSunken: string;
  borderSubtle: string;
  borderStrong: string;
  ink: string;
  inkSecondary: string;
  inkMuted: string;
  biro: string;
  biroHover: string;
  biroPressed: string;
  biroTint: string;
  okBg: string;
  okFg: string;
  snoozeBg: string;
  snoozeFg: string;
  warnBg: string;
  warnFg: string;
  dangerBg: string;
  dangerFg: string;
  calBirthday: string;
  calAnniversary: string;
  calCustom: string;
};

export const lightTokens: Tokens = {
  paper: '#FCFBF8',
  surface: '#FFFFFF',
  surfaceSunken: '#F6F4EF',
  borderSubtle: '#ECE9E2',
  borderStrong: '#DAD6CC',
  ink: '#232020',
  inkSecondary: '#5C574F',
  // WCAG AA: ~5.1:1 on the lightest surface (was #8B847C ≈ 3.4:1). Keep in sync
  // with --ink-muted in src/global.css.
  inkMuted: '#6E675F',
  biro: '#2C4BD8',
  biroHover: '#2440B8',
  biroPressed: '#1E37A0',
  biroTint: '#EDF0FC',
  okBg: '#E4F2EA',
  okFg: '#256B4C',
  snoozeBg: '#FAEFD8',
  snoozeFg: '#8A5A12',
  warnBg: '#FBF0DA',
  warnFg: '#8A5A12',
  dangerBg: '#FBE9E7',
  dangerFg: '#A33126',
  calBirthday: '#C44E8E',
  calAnniversary: '#7A57D1',
  calCustom: '#2E8B82',
};

export const darkTokens: Tokens = {
  paper: '#18171A',
  surface: '#201F23',
  surfaceSunken: '#1A191D',
  borderSubtle: '#2C2B30',
  borderStrong: '#3A3940',
  ink: '#F4F2EC',
  inkSecondary: '#B7B2A8',
  // WCAG AA in dark (~5.4:1 on surface; was #87827A ≈ 4.3:1). Sync with global.css.
  inkMuted: '#9A948B',
  biro: '#7E93F0',
  biroHover: '#92A4F4',
  biroPressed: '#B9C5FA',
  biroTint: '#23284A',
  okBg: '#19362A',
  okFg: '#5FBE8E',
  snoozeBg: '#36280F',
  snoozeFg: '#E0A94B',
  warnBg: '#36280F',
  warnFg: '#E0A94B',
  dangerBg: '#3A1F1C',
  dangerFg: '#E8857B',
  calBirthday: '#E590BC',
  calAnniversary: '#B49BF0',
  calCustom: '#67BEB3',
};

/** 4px spacing scale (DESIGN.md §5). */
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** Corner radii (DESIGN.md §5). */
export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

/** Font family names registered by @expo-google-fonts (web + native). */
export const fontFamily = {
  display: 'HankenGrotesk_600SemiBold',
  displayMedium: 'HankenGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
} as const;

/** Web is centered to a comfortable single column (DESIGN.md §5). */
export const MAX_CONTENT_WIDTH = 560;
