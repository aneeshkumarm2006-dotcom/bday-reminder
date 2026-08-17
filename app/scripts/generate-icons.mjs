/**
 * Regenerates every app icon / splash asset from the one brand mark, so the
 * launcher, the notification tray, the splash and the Play listing can never
 * drift apart - and can never silently fall back to the Expo template icons,
 * which is what shipped in 1.0.2.
 *
 * The mark is the `DateRing` "today" state from `src/components/date-ring.tsx`:
 * the hand-drawn wobbly circle tilted -4deg, filled biro, with the day number
 * knocked out in paper. Same path, same colours, same display font as the app,
 * and the same filled treatment the website already uses for its touch icon.
 *
 * Rendered in headless Chromium rather than a rasteriser like sharp purely so
 * the number is set in the real Hanken Grotesk face instead of a system
 * substitute. Playwright and the font live in sibling workspaces and are
 * resolved by path - this is a dev-only tool and is never bundled.
 *
 *   node scripts/generate-icons.mjs
 */

import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const OUT = path.join(APP, 'assets', 'images');
const WEBSITE = path.resolve(APP, '..', 'website');

const require = createRequire(path.join(WEBSITE, 'package.json'));
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('This tool borrows Playwright from ../website. Run `npm install` there first.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Brand constants - keep in sync with src/components/date-ring.tsx + tokens.ts.
// ---------------------------------------------------------------------------

const RING_PATH =
  'M33 8 C49 7 58 19 57 32 C56 47 41 57 26 55 C12 53 6 39 9 25 C12 13 22 8 36 9';

/**
 * The tilted path's real bounding box inside the 64x64 viewBox (measured, not
 * guessed - it is neither centred nor square). Everything is laid out from this
 * so the mark sits dead centre and `visual` below means what it says.
 */
const MARK = { cx: 33.43, cy: 32.35, size: 52.01 };

const LIGHT = { paper: '#FCFBF8', biro: '#2C4BD8' };
const DARK = { paper: '#18171A', biro: '#7E93F0' };

/**
 * The day inside the *static* mark - the frozen "12" the brand mark started life
 * as. It is the icon shipped in the binary, so it is what shows before the app
 * has ever run; once it has, the dynamic icon below takes over with the real
 * date. Also the splash and notification mark, which are not date-aware.
 */
const DAY = '12';

const FONT_PATH = path.join(
  APP,
  'node_modules/@expo-google-fonts/hanken-grotesk/700Bold/HankenGrotesk_700Bold.ttf',
);
const FONT_DATA_URI = `data:font/ttf;base64,${readFileSync(FONT_PATH).toString('base64')}`;

/**
 * One page of markup for one asset.
 *
 * @param {object}  o
 * @param {number}  o.size        Output edge in px.
 * @param {number}  o.visual      Mark edge as a fraction of `size` - measured on
 *                                the ink, not on a padded box.
 * @param {string}  [o.bg]        Background fill; transparent when omitted.
 * @param {string}  o.markColor   Ring fill.
 * @param {string}  [o.numberColor] Day-number fill. Ignored when `knockout`.
 * @param {boolean} [o.knockout]  Punch the number out of the ring as real
 *                                transparency, for Android's monochrome and
 *                                notification icons (both keep only alpha).
 */
function html({ size, visual, bg, markColor, numberColor, knockout = false, day = DAY }) {
  // Scale the viewBox up so the mark's bbox - not the 64-unit box - hits `visual`.
  const svgPx = (size * visual * 64) / MARK.size;
  // Two-digit days need a smaller glyph to stay inside the ring (the rule the
  // website's brand-mark uses), expressed in viewBox units.
  const fontSize = day.length > 1 ? 26 : 32;
  const dx = 32 - MARK.cx;
  const dy = 32 - MARK.cy;

  const ring = (fill) => `<path d="${RING_PATH}" fill="${fill}" transform="rotate(-4 32 32)"/>`;
  const glyph = (fill) =>
    `<text x="32" y="32" fill="${fill}" font-family="HankenGrotesk" font-size="${fontSize}"
           font-weight="700" text-anchor="middle" dominant-baseline="central">${day}</text>`;

  const inner = knockout
    ? `<mask id="cut">${ring('#fff')}${glyph('#000')}</mask>
       <rect x="0" y="0" width="64" height="64" fill="${markColor}" mask="url(#cut)"/>`
    : `${ring(markColor)}${glyph(numberColor)}`;

  const svg = visual
    ? `<svg width="${svgPx}" height="${svgPx}" viewBox="0 0 64 64">
         <g transform="translate(${dx} ${dy})">${inner}</g>
       </svg>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face {
      font-family: 'HankenGrotesk';
      src: url('${FONT_DATA_URI}') format('truetype');
      font-weight: 700;
    }
    html, body { margin: 0; padding: 0; }
    body {
      width: ${size}px; height: ${size}px;
      display: flex; align-items: center; justify-content: center;
      background: ${bg ?? 'transparent'};
    }
  </style></head><body>${svg}</body></html>`;
}

/**
 * Every generated asset. `visual` differs per surface because each one is
 * cropped differently: Android masks an adaptive foreground down to a central
 * circle ~66% wide, iOS rounds the corners of a full-bleed square, and a splash
 * image floats free on its background at whatever `imageWidth` says.
 */
const ASSETS = [
  // Full-bleed square: iOS app icon, Android legacy icon, web.
  { file: 'icon.png', size: 1024, visual: 0.68, bg: LIGHT.paper, markColor: LIGHT.biro, numberColor: LIGHT.paper },
  // Uploaded by hand to the Play Console listing ("App icon", 512x512, no alpha).
  { file: 'play-store-icon.png', size: 512, visual: 0.68, bg: LIGHT.paper, markColor: LIGHT.biro, numberColor: LIGHT.paper },
  { file: 'favicon.png', size: 48, visual: 0.72, bg: LIGHT.paper, markColor: LIGHT.biro, numberColor: LIGHT.paper },

  // Android adaptive icon: the foreground has to survive a circular mask.
  { file: 'android-icon-foreground.png', size: 512, visual: 0.58, markColor: LIGHT.biro, numberColor: LIGHT.paper },
  { file: 'android-icon-background.png', size: 512, visual: 0, bg: LIGHT.paper, markColor: 'none' },
  // Themed icons: Android keeps only the alpha and recolours it, so the number
  // has to be a real hole rather than a lighter fill.
  { file: 'android-icon-monochrome.png', size: 512, visual: 0.58, markColor: '#000', knockout: true },

  // Status-bar icon - Android flattens this to alpha too, hence knockout.
  { file: 'notification-icon.png', size: 96, visual: 0.86, markColor: '#fff', knockout: true },

  // Splash: floats on the plugin's backgroundColor, so it carries none itself.
  { file: 'splash-icon.png', size: 512, visual: 0.94, markColor: LIGHT.biro, numberColor: LIGHT.paper },
  { file: 'splash-icon-dark.png', size: 512, visual: 0.94, markColor: DARK.biro, numberColor: DARK.paper },
];

/**
 * The 31 dated launcher icons behind the dynamic app icon (see
 * `src/lib/app-icon.ts`). One per day of the month, in the two shapes the
 * dynamic-icon plugin asks for: a full-bleed square for iOS, and a transparent
 * adaptive foreground for Android.
 *
 * iOS ships these at 1024 because that is the only size Apple accepts for an
 * alternate icon; the Android foregrounds are 512 and the plugin rasterises the
 * five densities from them.
 */
const DAY_ICON_DIR = path.join(OUT, 'day-icons');
const DAYS_IN_MONTH = 31;

const dayIcon = (day, platform) =>
  platform === 'ios'
    ? { size: 1024, visual: 0.68, bg: LIGHT.paper, markColor: LIGHT.biro, numberColor: LIGHT.paper, day }
    : { size: 512, visual: 0.58, markColor: LIGHT.biro, numberColor: LIGHT.paper, day };

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
await mkdir(OUT, { recursive: true });
await mkdir(path.join(DAY_ICON_DIR, 'ios'), { recursive: true });
await mkdir(path.join(DAY_ICON_DIR, 'android'), { recursive: true });

async function shoot(spec, target) {
  await page.setViewportSize({ width: spec.size, height: spec.size });
  await page.setContent(html(spec), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await writeFile(target, await page.screenshot({ omitBackground: !spec.bg }));
}

for (const { file, ...spec } of ASSETS) {
  await shoot(spec, path.join(OUT, file));
  console.log(`  ${file}  ${spec.size}x${spec.size}`);
}

for (let day = 1; day <= DAYS_IN_MONTH; day += 1) {
  const name = `${String(day).padStart(2, '0')}.png`;
  for (const platform of ['ios', 'android']) {
    await shoot(dayIcon(String(day), platform), path.join(DAY_ICON_DIR, platform, name));
  }
}
console.log(`  day-icons/{ios,android}/01..${DAYS_IN_MONTH}.png`);

await browser.close();

// The plugin block is 31 near-identical entries - generate it rather than hand-
// maintain it, and print it so a mismatch with app.json is obvious in review.
const pluginConfig = Object.fromEntries(
  Array.from({ length: DAYS_IN_MONTH }, (_, i) => {
    const nn = String(i + 1).padStart(2, '0');
    return [
      `day${nn}`,
      {
        ios: `./assets/images/day-icons/ios/${nn}.png`,
        android: {
          foregroundImage: `./assets/images/day-icons/android/${nn}.png`,
          backgroundColor: LIGHT.paper,
        },
      },
    ];
  }),
);
await writeFile(
  path.join(HERE, 'dynamic-icon-config.json'),
  `${JSON.stringify(pluginConfig, null, 2)}\n`,
);

console.log('\nIcons regenerated in assets/images.');
console.log('Plugin config written to scripts/dynamic-icon-config.json - paste into app.json.');
