/** @type {import('tailwindcss').Config} */
// Design system -> NativeWind theme. Color values are CSS variables defined in
// `src/global.css` (light in `:root`, dark in `.dark`), so a single class like
// `bg-surface` resolves to the right value in either mode. Token names mirror
// DESIGN.md §12.2. Fonts use the literal family names registered by
// @expo-google-fonts (these resolve on both web and native, unlike CSS vars).
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        'surface-sunken': 'var(--surface-sunken)',
        'border-subtle': 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        ink: {
          DEFAULT: 'var(--ink)',
          secondary: 'var(--ink-secondary)',
          muted: 'var(--ink-muted)',
        },
        biro: {
          DEFAULT: 'var(--biro)',
          hover: 'var(--biro-hover)',
          pressed: 'var(--biro-pressed)',
          tint: 'var(--biro-tint)',
        },
        // Semantic / state colors (used only on their own UI, never as accents).
        ok: { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)' },
        snooze: { bg: 'var(--snz-bg)', fg: 'var(--snz-fg)' },
        warn: { bg: 'var(--warn-bg)', fg: 'var(--warn-fg)' },
        danger: { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)' },
        // Calendar event-type accents (dot/icon markers in the month grid).
        cal: {
          birthday: 'var(--cal-birthday)',
          anniversary: 'var(--cal-anniversary)',
          custom: 'var(--cal-custom)',
        },
      },
      borderRadius: {
        sm: '8px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        full: '999px',
      },
      fontFamily: {
        // display = Hanken Grotesk 600 (ring numbers, titles, headings, names)
        display: ['HankenGrotesk_600SemiBold'],
        'display-medium': ['HankenGrotesk_500Medium'],
        // body = Inter 400 (default text); body-medium = Inter 500 (labels, buttons)
        body: ['Inter_400Regular'],
        'body-medium': ['Inter_500Medium'],
      },
    },
  },
  plugins: [],
};
