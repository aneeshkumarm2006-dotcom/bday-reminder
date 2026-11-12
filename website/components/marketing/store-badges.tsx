import { getSiteSettings } from "@/lib/content/get";
import type { StoreBadgeConfig } from "@/lib/content/types";

/**
 * App Store and Google Play badges, driven by Site settings → App stores.
 *
 * Each badge is a "coming soon" chip until its store is enabled with a URL, then
 * the same slot becomes a real link, so a store launch is a content change, not
 * a deploy. They read settings themselves (request-cached) because the same
 * badges render on the homepage and on every keyword page.
 *
 * The marks follow the stores' own badge convention: a black lozenge, the
 * platform mark, a small eyebrow line and the store name. Logos are inline SVG
 * so they need no network request and stay crisp at any size.
 */

type Tone = "light" | "dark";

/** The Apple mark, single colour (inherits `fill` from `currentColor`). */
export function AppleLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.15 6.9c-.95 0-2.42-1.08-3.96-1.04-2.04.03-3.91 1.18-4.96 3.01-2.12 3.68-.55 9.1 1.52 12.09 1.01 1.45 2.21 3.09 3.79 3.04 1.52-.07 2.09-.99 3.94-.99 1.83 0 2.35.99 3.96.95 1.64-.03 2.68-1.48 3.68-2.95 1.16-1.69 1.64-3.33 1.66-3.42-.04-.01-3.18-1.22-3.22-4.86-.03-3.04 2.48-4.49 2.6-4.56-1.43-2.09-3.62-2.32-4.39-2.38-2-.16-3.68 1.09-4.62 1.09zM15.53 3.83c.84-1.01 1.4-2.43 1.25-3.83-1.21.05-2.66.8-3.53 1.82-.78.9-1.45 2.34-1.27 3.71 1.34.1 2.71-.69 3.55-1.7" />
    </svg>
  );
}

/** The four-colour Google Play mark. */
export function GooglePlayLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size * (22 / 24)} height={size} viewBox="0 0 22 24" aria-hidden="true">
      <path d="M1 1.2 12.3 12 1 22.8c-.3-.3-.5-.8-.5-1.3V2.5c0-.5.2-1 .5-1.3z" fill="#2196F3" />
      <path d="M1 1.2c.5-.4 1.2-.5 1.9-.1l13 7.4L12.3 12z" fill="#34A853" />
      <path d="M1 22.8 12.3 12l3.6 3.5-13 7.4c-.7.4-1.4.3-1.9-.1z" fill="#EA4335" />
      <path d="m15.9 8.5 4.2 2.4c.9.5.9 1.7 0 2.2l-4.2 2.4L12.3 12z" fill="#FBBC04" />
    </svg>
  );
}

type Platform = "appStore" | "googlePlay";

const PLATFORM: Record<Platform, { name: string; eyebrow: string }> = {
  appStore: { name: "App Store", eyebrow: "Download on the" },
  googlePlay: { name: "Google Play", eyebrow: "GET IT ON" },
};

export function isStoreLive(config: StoreBadgeConfig): boolean {
  return config.enabled && config.url.trim() !== "";
}

export function StoreBadge({
  platform,
  config,
  appName,
  tone = "light",
}: {
  platform: Platform;
  config: StoreBadgeConfig;
  /** Spoken in the link's accessible name, e.g. "Download Circle the date on the App Store". */
  appName?: string;
  /** `dark` adds a hairline so the black badge still reads on a dark band. */
  tone?: Tone;
}) {
  const defaults = PLATFORM[platform];
  const name = config.label.trim() || defaults.name;
  const live = isStoreLive(config);
  const logo = platform === "appStore" ? <AppleLogo size={24} /> : <GooglePlayLogo size={24} />;

  if (!live) {
    return (
      <span
        className="inline-flex h-14 cursor-default items-center gap-2.5 rounded-xl border border-border-strong bg-surface px-4 text-ink-muted opacity-80"
        aria-label={`${name} - coming soon`}
      >
        {logo}
        <span className="flex flex-col items-start leading-none">
          <span className="text-[11px]">Coming soon to</span>
          <span className="mt-0.5 text-base font-semibold text-ink-secondary">{name}</span>
        </span>
      </span>
    );
  }

  const eyebrow = config.eyebrow.trim() || defaults.eyebrow;
  const label = appName
    ? `${platform === "appStore" ? "Download" : "Get"} ${appName} on ${name}`
    : `${eyebrow} ${name}`;

  return (
    <a
      href={config.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={`inline-flex h-[52px] items-center gap-2 rounded-xl bg-black pl-3 pr-4 text-white sm:h-14 sm:gap-2.5 sm:pl-4 sm:pr-5 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(0,0,0,0.55)] ${
        tone === "dark" ? "border border-white/25" : ""
      }`}
    >
      {logo}
      <span className="flex flex-col items-start leading-none">
        <span className="whitespace-nowrap text-[10px] sm:text-[11px]">{eyebrow}</span>
        <span className="mt-0.5 whitespace-nowrap text-lg font-semibold tracking-[-0.01em] sm:text-xl">{name}</span>
      </span>
    </a>
  );
}

/**
 * Both badges side by side.
 *
 * `onlyLive` hides any store that isn't launched yet, for places (the hero)
 * where a "coming soon" chip would sit in the most valuable spot on the page.
 * With nothing live it renders nothing, so the caller can fall back to its
 * ordinary buttons.
 */
export async function StoreBadges({
  className = "mt-6 justify-center",
  onlyLive = false,
  appName,
  tone = "light",
}: {
  className?: string;
  onlyLive?: boolean;
  appName?: string;
  tone?: Tone;
}) {
  const { appStores } = await getSiteSettings();
  const platforms = (["appStore", "googlePlay"] as const).filter(
    (p) => !onlyLive || isStoreLive(appStores[p]),
  );
  if (platforms.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2.5 sm:gap-3 ${className}`}>
      {platforms.map((p) => (
        <StoreBadge key={p} platform={p} config={appStores[p]} appName={appName} tone={tone} />
      ))}
    </div>
  );
}

/** Whether at least one store is live, so a caller can choose its layout. */
export async function anyStoreLive(): Promise<boolean> {
  const { appStores } = await getSiteSettings();
  return isStoreLive(appStores.appStore) || isStoreLive(appStores.googlePlay);
}
