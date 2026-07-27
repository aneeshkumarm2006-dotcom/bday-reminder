import type { SeoLandingPageDef } from "./types";

/**
 * Targets the "free birthday reminder app" cluster — the one query where the
 * competition is beatable on facts rather than features, because most of the
 * apps ranking for it are freemium: a contact cap, an ad-supported tier, or
 * reminders behind a subscription. So the wedge here isn't "we're free too",
 * it's auditing the word itself. Every section re-frames a capability the
 * sibling pages sell on merit (the widget, greetings, calendar sync, shared
 * lists) as the thing other apps charge for and we don't, and the FAQ mirrors
 * the People Also Ask block for the term. The homepage mentions "no paid tier"
 * in one line on purpose — this page carries the argument, so the two don't
 * compete for the same query.
 */
export const freePage: SeoLandingPageDef = {
  slug: "free",
  label: "Free birthday reminder app",
  blurb: "Every feature included at no cost — no ads, no premium tier, nothing to upgrade to.",
  // The brief's meta title ends "| Birthday Reminder" (singular); that's a typo
  // in the brief — the brand is "Birthday Reminders" (`lib/site.ts`) and the
  // other five briefs and pages all use the plural. Body copy stays singular,
  // verbatim from the brief, exactly as on the sibling pages.
  title: "Free Birthday Reminder App | Birthday Reminders",
  description:
    "No paid tier, no ads, no premium upsell. Birthday Reminder is a completely free birthday reminder app with reminders, a widget, and one-tap greetings.",
  keywords: [
    "free birthday reminder app",
    "best free birthday reminder app",
    "free birthday apps",
    "app to remind me of birthdays for free",
  ],
  hero: {
    badge: "Free birthday reminder app, forever",
    heading: "A genuinely free birthday reminder app — no catch",
    subheading:
      "Not a free trial. Not a limited tier that pushes you to upgrade. Birthday Reminder is free on web, iOS, and Android, with every feature included, forever.",
    primaryCta: { label: "Start for free", href: "/signup" },
    footnote: "Free on web, iOS, and Android. No ads, no paid tier.",
    visuals: ["app", "reminder"],
  },
  contrast: {
    headingParts: {
      lead: "Most",
      muted: "“free”",
      mid: " birthday apps aren't",
      accent: "actually free",
      tail: "",
    },
    body: "A lot of apps ranking for this term cap you at a handful of contacts, lock reminders behind a subscription, or run ads to make up the difference. Birthday Reminder doesn't do any of that — there's no premium membership, no ad-supported tier, and no feature gated behind a paywall.",
  },
  features: {
    heading: "Everything included, at no cost",
    sub: "Every reminder channel, the widget, calendar sync, and shared lists are included — there is no paid version to compare this one against.",
    rows: [
      {
        id: "row-people",
        icon: "Users",
        eyebrow: "No cap on people",
        title: "No limit on how many people you track",
        body: "Add everyone who matters — family, friends, pets, anniversaries, custom events — without hitting a contact cap that pushes you toward a paid tier.",
        points: [
          "Works for birthdays, anniversaries, pets, and custom events",
          "Automatic sorting by nearest date",
          "Year is optional; ages appear only when known",
        ],
        preview: "app",
      },
      {
        id: "row-greetings",
        icon: "MessageCircle",
        eyebrow: "Sending stays free",
        title: "One-tap greetings, no upsell",
        body: "Turning a reminder into a sent message is often where “free” apps ask for payment. Not here.",
        points: [
          "Pre-filled, editable template: “Happy birthday, [Name]! 🎉”",
          "Opens your own WhatsApp or SMS, addressed to them",
          "You always review and send it yourself — never auto-sent",
        ],
        preview: "reminder",
      },
      {
        id: "row-widget",
        icon: "Smartphone",
        eyebrow: "On your home screen",
        title: "The widget, free",
        body: "Some apps charge extra or upsell for a home-screen widget. Here, it's included from the start.",
        points: [
          "Name, date, and days remaining at a glance",
          "Updates on its own as days pass",
          "Tap a name to jump straight to their profile",
        ],
        preview: "widget",
      },
    ],
    cards: [
      {
        id: "card-channels",
        icon: "Bell",
        title: "Every reminder channel, included",
        body: "Push, email, SMS/WhatsApp, and an in-app feed are all available at no cost — not held back for a paid plan.",
        points: [
          "Multiple lead times per event (7 days before and on the day)",
          "SMS/WhatsApp included with a fair-use cap, then falls back to push and email",
          "Reminders fire at your local time, and re-anchor automatically when you travel",
        ],
      },
      {
        id: "card-shared-lists",
        icon: "Share2",
        title: "Shared family lists, included",
        body: "Invite family to the same list at no extra cost — no per-seat pricing.",
        points: [],
      },
      {
        id: "card-calendar-sync",
        icon: "CalendarDays",
        title: "Calendar sync, included",
        body: "Subscribe to your birthdays in Apple, Google, or Outlook, with no premium requirement.",
        points: [],
      },
      {
        id: "card-everywhere",
        icon: "Globe",
        title: "One account, everywhere",
        body: "Web, iOS, and Android, same data, instantly synced — one free account covers every device.",
        points: [],
      },
    ],
  },
  howItWorks: {
    heading: "Three steps, nothing to pay at any of them",
    steps: [
      {
        id: "step-add",
        offset: -7,
        title: "Add the people who matter",
        body: "Type a name and date, or import from contacts or a spreadsheet. Year is optional.",
      },
      {
        id: "step-remind",
        offset: -1,
        title: "Get reminded in time",
        body: "Choose how far ahead and which channels, all included.",
      },
      {
        id: "step-greet",
        offset: 0,
        title: "Send a greeting",
        body: "On the day, open your messages with a ready-to-send note, then mark it done.",
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    sub: "What “free” means here, and what other birthday apps usually charge for.",
    items: [
      {
        id: "faq-1",
        q: "Is Birthday Reminder actually free, or is there a paid version?",
        a: "Birthday Reminder is free on web, iOS, and Android, with no ads and no paid tier. Every feature — reminders, the widget, calendar sync, and shared family lists — is included.",
      },
      {
        id: "faq-2",
        q: "What is the best free birthday reminder app?",
        a: "The best free option is one that doesn't cap the number of people you can track or gate reminders behind a subscription. Birthday Reminder includes unlimited people, multiple reminder channels, a home-screen widget, and calendar sync at no cost.",
      },
      {
        id: "faq-3",
        q: "Do free birthday reminder apps usually have limits?",
        a: "Many do — a maximum number of contacts, ad-supported screens, or premium-only reminder channels are common. Birthday Reminder doesn't impose any of these limits.",
      },
      {
        id: "faq-4",
        q: "Is there an app to remind me of birthdays for free, including SMS or WhatsApp?",
        a: "Yes. Birthday Reminder includes SMS/WhatsApp reminders at no cost, with a fair-use cap before falling back to push and email.",
      },
      {
        id: "faq-5",
        q: "How do I get my phone to remind me of birthdays without paying?",
        a: "Add the birthdays you want to track in Birthday Reminder, set your preferred reminder channel and lead time, and it will notify you automatically — the entire setup and ongoing use are free.",
      },
      {
        id: "faq-6",
        q: "Does the free version include the home-screen widget?",
        a: "Yes. The widget showing your next three birthdays is included at no cost, not an upsell.",
      },
    ],
  },
  cta: {
    heading: "Start free, stay free",
    body: "No trial period, no premium tier to hit later. Use it on the web right now, or get it on your phone for reminders and the home-screen widget.",
    ctaLabel: "Start for free",
    ctaHref: "/signup",
    footnote: "Mobile apps coming soon.",
  },
};
