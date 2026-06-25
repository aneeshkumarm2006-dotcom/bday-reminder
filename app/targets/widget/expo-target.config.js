/**
 * iOS WidgetKit target (TODO Stage 10; FR-48/49/50, DESIGN.md §8.13), generated
 * by `@bacons/apple-targets` at prebuild. Shares data with the app through the
 * App Group below - the app writes the next-3 payload via `ExtensionStorage`
 * (see `src/lib/widget.ios.ts`) and the Swift timeline provider reads it.
 *
 * The design tokens (DESIGN.md §3) are exposed to Swift as named colors with
 * light + dark values, so the widget stays on-brand and warm in dark mode.
 *
 * @type {import('@bacons/apple-targets').Config}
 */
module.exports = {
  type: 'widget',
  name: 'Birthdays',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.circlethedate.app.widget'],
  },
  colors: {
    paper: { light: '#FCFBF8', dark: '#18171A' },
    surface: { light: '#FFFFFF', dark: '#201F23' },
    borderSubtle: { light: '#ECE9E2', dark: '#2C2B30' },
    ink: { light: '#232020', dark: '#F4F2EC' },
    inkSecondary: { light: '#5C574F', dark: '#B7B2A8' },
    inkMuted: { light: '#8B847C', dark: '#87827A' },
    biro: { light: '#2C4BD8', dark: '#7E93F0' },
  },
};
