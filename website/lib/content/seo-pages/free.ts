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
  // in the brief — the brand is "Birthday Reminders" (`lib/site.ts`), which is
  // what the body copy uses throughout, here and on the sibling pages.
  title: "Free Birthday Reminder App | Birthday Reminders",
  description:
    "A birthday reminder app that's free the boring way: no contact cap, no ads, no premium tier. Reminders, the widget, and calendar sync are all included.",
  keywords: [
    "free birthday reminder app",
    "best free birthday reminder app",
    "free birthday apps",
    "app to remind me of birthdays for free",
  ],
  hero: {
    badge: "Free birthday reminder app, forever",
    heading: "Free in the boring sense of the word",
    subheading:
      "No trial that ends, no tenth contact that asks for a card, no reminder channel held back for the paid plan. Birthday Reminders is free on web, iOS, and Android, and there is nothing to upgrade to.",
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
    body: "You know the pattern. It's free until the eleventh person, or free with a banner across the reminder, or free except the notification you actually wanted. We don't have a premium plan to funnel you into, there's no ad slot anywhere in the app, and nothing you can see in the interface is greyed out waiting for payment.",
  },
  features: {
    heading: "Everything, at no cost",
    sub: "Every channel, the widget, calendar sync, shared lists. There's no paid version to hold this one up against.",
    rows: [
      {
        id: "row-people",
        icon: "Users",
        eyebrow: "No cap on people",
        title: "Add as many people as you actually have",
        body: "Family, friends, colleagues, pets, and the anniversaries you're expected to know. No counter in the corner, and no point where adding one more name triggers a payment screen.",
        points: [
          "Birthdays, anniversaries, pets, and any date you name",
          "Sorted by whichever date is closest",
          "The birth year is optional",
        ],
        preview: "app",
      },
      {
        id: "row-greetings",
        icon: "MessageCircle",
        eyebrow: "Sending stays free",
        title: "One-tap greetings, with no upsell in the way",
        body: "Turning the reminder into a sent message is exactly where a lot of free apps stop and ask for money. Here it's a tap, and it opens your own WhatsApp or SMS thread.",
        points: [
          "Starts you off with “Happy birthday, [Name]! 🎉”",
          "Opens your own WhatsApp or SMS, addressed to them",
          "It's your thumb on send — nothing goes out on its own",
        ],
        preview: "reminder",
      },
      {
        id: "row-widget",
        icon: "Smartphone",
        eyebrow: "On your home screen",
        title: "The widget, included",
        body: "Some apps put the home-screen widget behind the upgrade. This one's there from the first birthday you add.",
        points: [
          "Name, date, and how many days are left",
          "Redraws itself as the days pass",
          "Tap a name to open their profile",
        ],
        preview: "widget",
      },
    ],
    cards: [
      {
        id: "card-channels",
        icon: "Bell",
        title: "Every reminder channel",
        body: "Push, email, SMS, WhatsApp, and the in-app feed, all included. SMS and WhatsApp carry a monthly fair-use cap — they cost us real money per message — and past it your reminders still arrive by push and email.",
        points: [
          "More than one lead time per date: a week ahead, the day itself, or both",
          "Fires at your local hour, and follows you across timezones",
          "Nothing is reserved for a plan that doesn't exist",
        ],
      },
      {
        id: "card-shared-lists",
        icon: "Share2",
        title: "Shared family lists",
        body: "Invite as many relatives as you like. There's no per-seat pricing, because there's no pricing.",
        points: [],
      },
      {
        id: "card-calendar-sync",
        icon: "CalendarDays",
        title: "Calendar sync",
        body: "Subscribe to your birthdays in Apple, Google, or Outlook. No premium requirement, no export limit.",
        points: [],
      },
      {
        id: "card-everywhere",
        icon: "Globe",
        title: "One account, everywhere",
        body: "Web, iOS, and Android on the same account, with the same data. Log in on a new phone and it's all there.",
        points: [],
      },
    ],
  },
  howItWorks: {
    heading: "Three steps, and no card at any of them",
    steps: [
      {
        id: "step-add",
        offset: -7,
        title: "Add the dates",
        body: "Type a name and a date, or import from your contacts or a spreadsheet. The year is optional.",
      },
      {
        id: "step-remind",
        offset: -1,
        title: "Pick your reminders",
        body: "Choose how far ahead and which channels. All of them are included.",
      },
      {
        id: "step-greet",
        offset: 0,
        title: "Send a greeting",
        body: "Open your messages with a note ready to go, then mark it done.",
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    sub: "What free means here, and what other birthday apps tend to charge for.",
    items: [
      {
        id: "faq-1",
        q: "Is Birthday Reminders actually free, or is there a paid version?",
        a: "There's no paid version. Reminders, the widget, calendar sync, and shared family lists are all in the free account, and there's no ad slot anywhere in the app.",
      },
      {
        id: "faq-2",
        q: "What is the best free birthday reminder app?",
        a: "The one that doesn't run out on you — no cap on how many people you track, and no reminder channel held back for subscribers. That's the standard we built to: unlimited people, every channel, the widget, and calendar sync, at no cost.",
      },
      {
        id: "faq-3",
        q: "Do free birthday reminder apps usually have limits?",
        a: "Usually, yes. A contact cap somewhere around ten, ads on the screens you use most, or SMS and email reminders reserved for the paid tier. None of those apply here.",
      },
      {
        id: "faq-4",
        q: "Is there an app to remind me of birthdays for free, including SMS or WhatsApp?",
        a: "Yes. SMS and WhatsApp reminders are included at no cost, with a monthly fair-use cap since each message costs us money to send. Past the cap, the reminder still reaches you by push and email.",
      },
      {
        id: "faq-5",
        q: "How do I get my phone to remind me of birthdays without paying?",
        a: "Add the dates, choose a channel and how far ahead you want telling, and leave it. Setup and everything after it are free.",
      },
      {
        id: "faq-6",
        q: "Does the free version include the home-screen widget?",
        a: "Yes. There's only one version, and the widget showing your next three birthdays is part of it.",
      },
    ],
  },
  cta: {
    heading: "Start free, stay free",
    body: "No trial to run out, no plan to hit later. Add a birthday and see.",
    ctaLabel: "Start for free",
    ctaHref: "/signup",
    footnote: "Mobile apps coming soon.",
  },
};
