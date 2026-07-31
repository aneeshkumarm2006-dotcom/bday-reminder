import type { SeoLandingPageDef } from "./types";

/**
 * Targets "birthday tracker printable" — the one query in the cluster where the
 * searcher does not want an app. They want a sheet of paper, and a page that
 * answers with a signup form instead of a file deserves the bounce it gets.
 *
 * So this page leads with the download and earns the rest: the printable is
 * real, free, and given away with no email gate (`public/`, one click, done).
 * The argument only turns to the product at the contrast band, on the single
 * honest weakness paper has — it can't tap you on the shoulder. Everything
 * claimed about the PDF below is checked against the file itself: twelve month
 * blocks, Name / Date / Turning columns, three lines each, and a gift-notes
 * line at the foot. If the PDF is ever regenerated with more rows, the copy
 * here and the FAQ's "36" have to move with it.
 */
export const birthdayTrackerPrintablePage: SeoLandingPageDef = {
  slug: "birthday-tracker-printable",
  label: "Printable birthday tracker",
  blurb: "A free one-page PDF: twelve months, filled in by hand, pinned where you'll see it.",
  title: "Free Printable Birthday Tracker | Birthday Reminders",
  description:
    "Download a free printable birthday tracker to log every birthday in one place — or skip the paper and let Birthday Reminders remind you automatically.",
  keywords: [
    "birthday tracker printable",
    "printable birthday tracker",
    "free printable birthday tracker",
    "birthday tracker pdf",
    "printable birthday list",
  ],
  hero: {
    badge: "Free PDF — no email required",
    heading: "A free printable birthday tracker, one page for the whole year",
    subheading:
      "Sometimes the simplest way to keep track of birthdays is on paper — pinned to a fridge, kept in a planner, filled in once and never lost inside an app you forget to open. This tracker gives you one page for every birthday you need to remember, organized by month.",
    primaryCta: { label: "Download the PDF", href: "/birthday-tracker-printable.pdf" },
    footnote: "No email, no account, no watermark. The file downloads on click.",
    visuals: ["app", "reminder"],
  },
  download: {
    heading: "Download the printable birthday tracker",
    body: "One page, twelve months, ready for a pen. Print it, pin it up, and fill in birthdays as you learn them.",
    href: "/birthday-tracker-printable.pdf",
    ctaLabel: "Download the PDF",
    fileName: "birthday-tracker-printable.pdf",
    meta: "PDF · 1 page · US Letter and A4",
    points: [
      "All twelve months on a single sheet, two columns across",
      "Name, date, and “turning” columns, with three lines under each month",
      "A gift ideas & notes line at the foot, so next year doesn't start from scratch",
      "Prints cleanly at home, in colour or greyscale",
    ],
    secondaryCta: { label: "Or set up automatic reminders instead", href: "/signup" },
  },
  contrast: {
    headingParts: {
      lead: "A",
      muted: "printed page",
      mid: " only reminds you",
      accent: "if you remember",
      tail: "to look at it",
    },
    body: "A printable works well if you like having something physical, don't want another app on your phone, or are building a family binder anyone can write in. The tradeoff is the one thing paper can't do: there's no notification when a birthday is close, so the tracker only works on the days you happen to glance at it. Plenty of people keep both — the printable on the fridge for a quick look, and Birthday Reminders for the nudge that actually arrives in time.",
  },
  features: {
    heading: "Keep the paper. Add the part paper can't do.",
    sub: "The printable is yours for free either way. Here's what changes when the same list lives somewhere that can reach you.",
    rows: [
      {
        id: "row-list",
        icon: "ListChecks",
        eyebrow: "Written once, not every year",
        title: "The same list, without re-writing it each January",
        body: "A paper tracker starts over with every new sheet. Add a birthday to Birthday Reminders once and it stays there, sorted so the nearest date is always at the top.",
        points: [
          "Birthdays, anniversaries, pets, and custom dates in one list",
          "Sorted automatically by whichever date is closest",
          "The birth year is optional — ages show only when you know them",
        ],
        preview: "app",
      },
      {
        id: "row-remind",
        icon: "BellRing",
        eyebrow: "The bit a printout can't do",
        title: "A reminder that arrives before the day, on its own",
        body: "This is the whole gap between paper and an app: the tracker waits for you to check it, a reminder comes to you a week out, the night before, or both.",
        points: [
          "Push, email, SMS/WhatsApp, or an in-app feed — your choice per person",
          "Pick how far ahead each reminder lands",
          "Opens your messages with an editable greeting when the day comes",
        ],
        preview: "reminder",
      },
      {
        id: "row-widget",
        icon: "Smartphone",
        eyebrow: "A fridge door for your phone",
        title: "The next three birthdays on your home screen",
        body: "If what you liked about the printable was seeing it without looking anything up, the widget is the same idea — it just travels with you.",
        points: [
          "Name, date, and days remaining at a glance",
          "Updates itself as the days pass",
          "Tap a name to open their profile",
        ],
        preview: "widget",
      },
    ],
    cards: [
      {
        id: "card-included",
        icon: "FileText",
        title: "What's on the sheet",
        body: "Twelve labelled month blocks laid out two across, each with Name, Date, and Turning columns and three lines to fill in — 36 birthdays on one page.",
        points: [],
      },
      {
        id: "card-print",
        icon: "Printer",
        title: "Prints on Letter or A4",
        body: "The layout has enough margin for both standard paper sizes, so it prints edge-safe on any home printer without scaling.",
        points: [],
      },
      {
        id: "card-free",
        icon: "Download",
        title: "Free, with nothing asked for",
        body: "No email gate, no account, no sign-up wall in front of the file. Click the button and the PDF downloads.",
        points: [],
      },
      {
        id: "card-both",
        icon: "Layers",
        title: "Made to be used alongside the app",
        body: "Fill in the sheet for the quick visual reference, then add the same dates to Birthday Reminders so something tells you before each one arrives.",
        points: [],
      },
    ],
  },
  howItWorks: {
    heading: "From printed sheet to a reminder that actually reaches you",
    steps: [
      {
        id: "step-print",
        offset: -7,
        title: "Print it and fill in the months",
        body: "Pin it somewhere visible — a planner, the fridge, a family binder — and add birthdays as you learn them.",
      },
      {
        id: "step-add",
        offset: -1,
        title: "Add the same dates to Birthday Reminders",
        body: "Type them in, or import them from your contacts or a spreadsheet in one step.",
      },
      {
        id: "step-remind",
        offset: 0,
        title: "Stop checking the page",
        body: "The reminder finds you before the day, with a ready-to-send greeting when it arrives.",
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    sub: "What's on the printable, how to print it, and what to do if you'd rather not use paper at all.",
    items: [
      {
        id: "faq-1",
        q: "Is the printable birthday tracker really free?",
        a: "Yes — no email required, no account needed, and nothing watermarked. Click the download button and the PDF saves straight to your device.",
      },
      {
        id: "faq-2",
        q: "What size paper does it print on?",
        a: "Standard US Letter and A4, so it should print fine on any home printer without changing the scaling.",
      },
      {
        id: "faq-3",
        q: "How many birthdays fit on the page?",
        a: "Thirty-six — three lines under each of the twelve months. If one month runs over, print a second copy and use it for the busy months.",
      },
      {
        id: "faq-4",
        q: "Can I track birthdays without printing anything?",
        a: "Yes. Birthday Reminders lets you add birthdays digitally and reminds you automatically before each one, if you'd rather skip paper entirely.",
      },
      {
        id: "faq-5",
        q: "What's the difference between a printable tracker and a birthday reminder app?",
        a: "A printable stores the dates; an app stores them and tells you about them. Paper only works on the days you remember to look at it, while an app sends a reminder ahead of time on its own.",
      },
      {
        id: "faq-6",
        q: "Can I use the printable and the app together?",
        a: "That's how most people use it. The sheet gives you a quick visual reference on the wall, and the app is what nudges you before the date arrives.",
      },
      {
        id: "faq-7",
        q: "Can I print more than one copy?",
        a: "As many as you like — one per household, one per side of the family, or a fresh sheet whenever the first gets too marked up.",
      },
    ],
  },
  cta: {
    heading: "Keep the printable. Add the reminder.",
    body: "The PDF is free and always will be. So is the app that makes sure you don't walk past the fridge on the wrong morning.",
    ctaLabel: "Start for free",
    ctaHref: "/signup",
    footnote: "Free on web, iOS, and Android. No ads, no paid tier.",
  },
};
