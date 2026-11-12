import Image from "next/image";
import { Bell, CalendarCheck, LayoutGrid, Users } from "lucide-react";

import { CircleIcon } from "@/components/circle-icon";
import { Reveal } from "@/components/reveal";

/**
 * The real app, shown on the marketing site.
 *
 * Every phone here is an actual iOS screenshot of Circle the date (the same
 * captures the App Store listing uses, `store/ios/screenshots/6.9-inch`),
 * resized to 720px and saved as WebP under `public/app-screens/`. They are
 * pictures of the shipping UI, not a redraw, so they can't drift from the app
 * the way a hand-built mock would. Re-export them after a visible UI change.
 */

const SCREEN = { width: 720, height: 1564 } as const;

export const APP_SCREENS = [
  {
    id: "reminders",
    src: "/app-screens/reminders.webp",
    alt: "Circle the date reminders screen: a birthday today with Send greeting, Mark as done and Snooze",
    title: "Reminders",
    caption: "Send a greeting, mark done or snooze",
  },
  {
    id: "widget",
    src: "/app-screens/widget-home-screen.webp",
    alt: "Circle the date home-screen widget listing the next three birthdays",
    title: "Widget",
    caption: "Next three birthdays on your home screen",
  },
  {
    id: "people",
    src: "/app-screens/people.webp",
    alt: "Circle the date people screen listing everyone with their upcoming dates",
    title: "People",
    caption: "Everyone, with ages and gift notes",
  },
  {
    id: "calendar",
    src: "/app-screens/calendar.webp",
    alt: "Circle the date calendar screen with birthdays circled on the month",
    title: "Calendar",
    caption: "The whole year, circled",
  },
  {
    id: "lists",
    src: "/app-screens/shared-lists.webp",
    alt: "Circle the date shared lists screen for a family birthday list",
    title: "Shared lists",
    caption: "One family calendar, not six",
  },
] as const;

type Screen = (typeof APP_SCREENS)[number];

const byId = (id: Screen["id"]) => APP_SCREENS.find((s) => s.id === id)!;

/** A screenshot in a plain phone bezel. */
function Phone({
  screen,
  className = "",
  sizes,
  preload = false,
}: {
  screen: Screen;
  className?: string;
  sizes: string;
  preload?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[2.5rem] border-[10px] border-[#232020] bg-[#232020] ${className}`}
    >
      <Image
        src={screen.src}
        alt={screen.alt}
        width={SCREEN.width}
        height={SCREEN.height}
        sizes={sizes}
        preload={preload}
        className="block h-auto w-full rounded-[1.9rem]"
      />
    </div>
  );
}

/**
 * One real screen in a phone, for feature rows and keyword-page heroes. Takes
 * over from the hand-built mocks in `components/app-preview.tsx`, so every
 * phone on the marketing site shows the actual app.
 */
export function ScreenPhone({ id, className = "" }: { id: Screen["id"]; className?: string }) {
  return (
    <Phone
      screen={byId(id)}
      sizes="(min-width: 640px) 280px, 240px"
      className={`w-[240px] shadow-[0_28px_70px_-24px_rgba(44,75,216,0.4)] sm:w-[280px] ${className}`}
    />
  );
}

/* ------------------------------- hero demo -------------------------------- */

/** The screens the hero phone cycles through, in order (3s each). */
const DEMO_SEQUENCE: Screen["id"][] = ["reminders", "people", "calendar", "lists"];

/**
 * The hero's product shot: the widget on a home screen behind, and a front
 * phone that loops through the main screens like a short demo video. On the
 * Reminders screen a ring "taps" Send greeting, the same circle the app draws
 * around a date.
 *
 * It's a CSS crossfade over four stills rather than an MP4: about 110KB
 * instead of megabytes, sharp at any density, and nothing to decode. With
 * reduced motion it holds on the first screen (see `.app-demo-*` in
 * globals.css). The first screen is preloaded because it's the hero's largest
 * image.
 */
export function AppDemo() {
  const widget = byId("widget");
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-end justify-center">
        <Phone
          screen={widget}
          sizes="(min-width: 640px) 220px, 170px"
          className="-mr-10 mb-10 hidden w-[170px] shadow-[0_24px_60px_-20px_rgba(35,32,32,0.35)] sm:block sm:w-[200px] lg:w-[220px]"
        />
        <div className="relative w-[250px] overflow-hidden rounded-[2.75rem] border-[11px] border-[#232020] bg-[#232020] shadow-[0_32px_80px_-24px_rgba(44,75,216,0.45)] sm:w-[280px]">
          <div
            role="img"
            aria-label="Demo of the Circle the date app showing reminders, people, the calendar and shared lists"
            className="relative w-full overflow-hidden rounded-[2.05rem] bg-paper"
            style={{ aspectRatio: `${SCREEN.width} / ${SCREEN.height}` }}
          >
            {DEMO_SEQUENCE.map((id, i) => (
              <Image
                key={id}
                src={byId(id).src}
                alt=""
                fill
                sizes="(min-width: 640px) 280px, 250px"
                preload={i === 0}
                className={`app-demo-screen object-cover ${i === 0 ? "app-demo-first" : ""}`}
                style={{ animationDelay: `${i * 3}s` }}
              />
            ))}
            {/* Sits over the Send greeting button on the reminders screenshot. */}
            <span aria-hidden="true" className="app-demo-tap" style={{ left: "24.5%", top: "34.5%" }} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <span aria-hidden="true" className="flex gap-2">
          {DEMO_SEQUENCE.map((id, i) => (
            <span key={id} className="app-demo-dot" style={{ animationDelay: `${i * 3}s` }} />
          ))}
        </span>
        <span>Reminders · People · Calendar · Shared lists</span>
      </div>
    </div>
  );
}

/* ---------------------------- highlights strip ---------------------------- */

const HIGHLIGHTS = [
  { icon: Bell, title: "Reminders that reach you", body: "At your time, in your timezone" },
  { icon: LayoutGrid, title: "Home-screen widget", body: "The next three, at a glance" },
  { icon: Users, title: "Shared family lists", body: "Everyone adds, each keeps their own alerts" },
  { icon: CalendarCheck, title: "Calendar sync", body: "Apple, Google or Outlook" },
];

/** Four one-line proof points under the hero, each icon in a date ring. */
export function AppHighlights() {
  return (
    <section aria-label="Highlights" className="border-y border-border-subtle bg-surface-sunken/60">
      <ul className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-x-4 gap-y-6 px-5 py-7 lg:grid-cols-4">
        {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-center gap-3">
            <CircleIcon size="md">
              <Icon size={20} />
            </CircleIcon>
            <span className="text-sm leading-snug">
              <span className="font-semibold text-ink">{title}</span>
              <br />
              <span className="text-ink-secondary">{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------ screenshot row ---------------------------- */

/**
 * All five screens with captions. A row on desktop; a swipeable, snapping
 * carousel on phones.
 */
export function AppScreensGallery({ appName = "Circle the date" }: { appName?: string }) {
  return (
    <section id="screens" className="mx-auto w-full max-w-5xl scroll-mt-20 py-20">
      <Reveal className="mx-auto max-w-2xl px-5 text-center">
        <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-ink">
          See {appName} on your phone
        </h2>
        <p className="mt-4 text-ink-secondary">
          The real app, not a mock-up. Five screens that do the work.
        </p>
      </Reveal>
      <Reveal className="mt-12">
        <ul className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 [scrollbar-width:thin] lg:grid lg:grid-cols-5 lg:overflow-visible">
          {APP_SCREENS.map((screen) => (
            <li key={screen.id} className="w-[200px] shrink-0 snap-center lg:w-auto">
              <figure className="flex flex-col gap-3">
                <Phone
                  screen={screen}
                  sizes="200px"
                  className="rounded-[2rem] border-8 [&_img]:rounded-[1.5rem]"
                />
                <figcaption className="text-center text-sm">
                  <span className="font-semibold text-ink">{screen.title}</span>
                  <br />
                  <span className="text-ink-secondary">{screen.caption}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
