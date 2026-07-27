import type { SeoLandingPageDef } from "./types";

/**
 * Targets the "birthday countdown app" cluster — people searching for a number
 * of days, not for a reminder system. The wedge is that a countdown on its own
 * is inert: it can show you the days left but it can't reach you when they run
 * out. So the page leads with the countdown they searched for (the Upcoming
 * feed already reads as one), then argues its way to the reminder and the
 * one-tap greeting, which is the part a plain countdown app never has. Kept off
 * the homepage so it can own the keyword without diluting "birthday reminder
 * app".
 */
export const birthdayCountdownAppPage: SeoLandingPageDef = {
  slug: "birthday-countdown-app",
  label: "Birthday countdown app",
  blurb: "See the days left to every birthday, then act before the countdown reaches zero.",
  title: "Birthday Countdown App | Birthday Reminders",
  description:
    "Never lose track again: this birthday countdown app shows exactly how many days are left until every birthday you care about. Free to start today.",
  keywords: ["birthday countdown app", "birthday countdown", "countdown app"],
  hero: {
    badge: "Live countdowns for every birthday",
    heading: "The birthday countdown app that reminds you to actually do something",
    subheading:
      "Most countdown apps just show you a number. Birthday Reminder counts down to every birthday, then reminds you in time and helps you send a greeting before the moment passes.",
    primaryCta: { label: "Start counting down for free", href: "/signup" },
    footnote: "Free on web, iOS, and Android. No ads, no paid tier.",
    visuals: ["app", "reminder"],
  },
  contrast: {
    headingParts: {
      lead: "A",
      muted: "countdown",
      mid: " is only useful if it",
      accent: "leads to something",
      tail: "",
    },
    body: "Plenty of birthday countdown apps stop at the number of days left. Birthday Reminder shows you the countdown for every birthday and event, then does the two things a countdown can't: reminds you at the right moment, and gets a greeting ready to send.",
  },
  features: {
    heading: "Everything a birthday countdown app should do",
    sub: "A live countdown for every date you add, a widget that keeps the nearest ones in view, and a reminder that turns the last day into a greeting.",
    rows: [
      {
        id: "row-countdowns",
        icon: "Timer",
        eyebrow: "Countdowns at a glance",
        title: "Live countdowns for everyone you track",
        body: "See days remaining for each person at a glance — “Today,” “in 3 days,” “in 16 days” — sorted automatically so the nearest birthday is always on top.",
        points: [
          "Countdown for birthdays, anniversaries, pets, and custom events",
          "Automatic sorting by nearest date",
          "Age shown automatically when the birth year is known",
        ],
        preview: "app",
      },
      {
        id: "row-widget",
        icon: "Smartphone",
        eyebrow: "On your home screen",
        title: "A home-screen widget that counts down on its own",
        body: "Keep the next three countdowns one glance away, right on your home screen.",
        points: [
          "Name, date, and days remaining at a glance",
          "Updates on its own — no need to open the app",
          "Tap a name to jump straight to their profile",
        ],
        preview: "widget",
      },
      {
        id: "row-greeting",
        icon: "MessageCircle",
        eyebrow: "From countdown to greeting",
        title: "Turn the countdown into a greeting",
        body: "When the countdown reaches the day, the reminder opens your messaging app with a friendly, editable message ready to send.",
        points: [
          "Pre-filled template: “Happy birthday, [Name]! 🎉”",
          "You always review and send it yourself — never auto-sent",
          "Mark as done or snooze right from the reminder",
        ],
        preview: "reminder",
      },
    ],
    cards: [
      {
        id: "card-reminders",
        icon: "BellRing",
        title: "Reminders that fire when the countdown hits zero (or before)",
        body: "Set a lead time — 7 days before, on the day, or both — and get notified on the channel you prefer, in your own timezone.",
        points: [
          "Push, email, SMS/WhatsApp, or an in-app feed",
          "Reminders re-anchor automatically when you travel",
          "Multiple lead times per person",
        ],
      },
      {
        id: "card-shared",
        icon: "Users",
        title: "Shared countdowns for the whole family",
        body: "Track the same list of birthdays together with family or a group.",
        points: [
          "Everyone can add and edit",
          "Each person keeps their own reminder settings",
          "Works for family, friend groups, or teams",
        ],
      },
      {
        id: "card-calendar",
        icon: "CalendarDays",
        title: "Calendar sync",
        body: "Subscribe to your countdowns in Apple, Google, or Outlook, and stay in sync as you add, edit, or remove people.",
        points: [],
      },
    ],
  },
  howItWorks: {
    heading: "Three steps, then the countdown does the rest",
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
        title: "Watch the countdown, get reminded in time",
        body: "Choose how far ahead and which channel. Reminders arrive at your time, in your timezone.",
      },
      {
        id: "step-greet",
        offset: 0,
        title: "Send a greeting when it hits zero",
        body: "Open your messages with a ready-to-send note, then mark it done.",
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    sub: "Common questions about birthday countdowns, reminders, and the home-screen widget.",
    items: [
      {
        id: "faq-1",
        q: "What is a birthday countdown app?",
        a: "A birthday countdown app tracks how many days remain until someone's birthday and shows that countdown at a glance. Birthday Reminder goes a step further, pairing the countdown with reminders and a one-tap way to send a greeting when the day arrives.",
      },
      {
        id: "faq-2",
        q: "How does a birthday countdown app remind you before the day arrives?",
        a: "A good countdown app lets you set a lead time — for example, 7 days before and on the day — and sends a reminder through push, email, or SMS/WhatsApp at a time you choose, in your own timezone.",
      },
      {
        id: "faq-3",
        q: "Can a birthday countdown app track more than one person?",
        a: "Yes. Birthday Reminder shows a countdown for every birthday, anniversary, pet, or custom event you add, automatically sorted so the soonest one appears first.",
      },
      {
        id: "faq-4",
        q: "Is there a widget that shows the countdown without opening the app?",
        a: "Yes. The home-screen widget shows the next three countdowns — name, date, and days remaining — and updates on its own.",
      },
      {
        id: "faq-5",
        q: "Can family members see the same countdown together?",
        a: "Yes. Shared lists let family or friends add and manage birthdays together, while each person keeps their own reminder settings.",
      },
      {
        id: "faq-6",
        q: "Is Birthday Reminder free to use as a birthday countdown app?",
        a: "Yes. It's free on web, iOS, and Android, with no ads and no paid tier.",
      },
    ],
  },
  cta: {
    heading: "Start your first countdown",
    body: "Free forever. Use it on the web right now, or get it on your phone for reminders and the home-screen widget.",
    ctaLabel: "Start for free",
    ctaHref: "/signup",
    footnote: "Mobile apps coming soon.",
  },
};
