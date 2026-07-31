import type { SeoLandingPageDef } from "./types";

/**
 * Targets the "birthday alarm app" / "birthday scheduler" cluster.
 *
 * People searching "alarm" already know how to set one — they're searching
 * because setting one per person, per year, by hand doesn't hold. So the wedge
 * here is the literal promise the word makes and that a one-off phone alarm (or
 * a greeting-card site) never keeps: schedule it once, and it fires again every
 * year on its own. Repetition and automation carry the page; the countdown,
 * calendar, and tracker angles belong to the sibling pages.
 */
export const birthdayAlarmPage: SeoLandingPageDef = {
  slug: "birthday-alarm",
  label: "Birthday alarm app",
  blurb: "Set the alarm once and it fires again every year, on the channel you pick.",
  title: "Birthday Alarm App & Scheduler | Birthday Reminders",
  description:
    "Set a birthday alarm once and it goes off every year on its own — no resetting each January, and on the channel and lead time you choose.",
  keywords: [
    "birthday alarm app",
    "birthday scheduler",
    "birthday alarm",
    "birthday schedule",
  ],
  hero: {
    badge: "Birthday alarms that repeat every year",
    heading: "A birthday alarm you only have to set once",
    subheading:
      "You already know how to set an alarm. The problem is setting thirty of them, again, every January. Schedule a birthday here and it fires on its own next year and the year after, on the channel you picked and at the hour you picked.",
    primaryCta: { label: "Start for free", href: "/signup" },
    footnote: "Free on web, iOS, and Android. No ads, no paid tier.",
    visuals: ["app", "reminder"],
  },
  contrast: {
    headingParts: {
      lead: "One",
      muted: "alarm a year",
      mid: " isn't",
      accent: "a system",
      tail: "",
    },
    body: "A phone alarm for one birthday is fine. The trouble starts at fifteen people, because now it's fifteen alarms to set, fifteen to reset next year, and one you'll forget to carry over to your next phone. Birthday Reminders takes the schedule once and keeps firing it — for every birthday, anniversary, and date you add after that.",
  },
  features: {
    heading: "Set once, fires every year",
    sub: "Each alarm has its own lead time, its own channel, and its own hour — and none of them need resetting.",
    rows: [
      {
        id: "row-scheduler",
        icon: "ListChecks",
        eyebrow: "Scheduling that runs itself",
        title: "The schedule runs whether you open the app or not",
        body: "Nothing here waits for you to check in. Alarms go off on their own, and the in-app feed keeps the receipts: what's coming, what already fired, what you marked done.",
        points: [
          "Scheduled automatically, with nothing to trigger by hand",
          "An in-app feed as the running record",
          "SMS and WhatsApp have a fair-use cap; past it, alarms fall back to push and email",
        ],
        preview: "app",
      },
      {
        id: "row-greeting",
        icon: "MessageCircle",
        eyebrow: "Act on the day",
        title: "The alarm hands you the message",
        body: "An alarm that only makes noise still leaves you to write something. This one opens your own messaging app with a line already there — change it or send it as it stands.",
        points: [
          "Starts you off with “Happy birthday, [Name]! 🎉”",
          "It's your thumb on send — nothing goes out on its own",
          "Snooze it or mark it done from the alarm",
        ],
        preview: "reminder",
      },
      {
        id: "row-widget",
        icon: "Smartphone",
        eyebrow: "Always in view",
        title: "What's scheduled next, on your home screen",
        body: "The next three names sit on your home screen with the days remaining, so you can see what's queued up without going looking for it.",
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
        id: "card-repeats",
        icon: "Repeat",
        title: "It repeats without being asked",
        body: "Add the date and the schedule once. Next year it fires again, and the year after that, without you touching it.",
        points: [
          "Works for birthdays, anniversaries, pets, and any date you name",
          "The birth year is optional; ages show when you know it",
          "Nothing to re-arm each January",
        ],
      },
      {
        id: "card-multiple-alarms",
        icon: "BellRing",
        title: "More than one alarm per person",
        body: "A heads-up a week out for the people you need to post something to, and a morning-of nudge for everyone else. Or both, for the ones you can't miss.",
        points: [
          "Several lead times on the same date",
          "Pick the channel per alarm: push, email, SMS or WhatsApp, or the in-app feed",
          "Fires at your local hour, and follows you across timezones",
        ],
      },
      {
        id: "card-shared-schedule",
        icon: "Users",
        title: "One schedule, shared with family",
        body: "Family members can add to the same schedule, so it doesn't all rest on whoever set the alarms first.",
        points: [],
      },
    ],
  },
  howItWorks: {
    heading: "Three steps, then stop thinking about it",
    steps: [
      {
        id: "step-add",
        offset: -7,
        title: "Add the dates",
        body: "Type a name and a date, or import from your contacts or a spreadsheet. The year is optional.",
      },
      {
        id: "step-schedule",
        offset: -1,
        title: "Set the alarms",
        body: "Choose how far ahead each one fires and where it lands.",
      },
      {
        id: "step-run",
        offset: 0,
        title: "Leave it alone",
        body: "It fires this year, next year, and the year after. Nothing to reset.",
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    sub: "How the alarms repeat, where they arrive, and what else you can schedule.",
    items: [
      {
        id: "faq-1",
        q: "What is a birthday alarm app?",
        a: "It's an app that holds a recurring alert for each birthday, so the alert comes back every year on its own. That's the difference from a phone alarm, which fires once and then needs setting again.",
      },
      {
        id: "faq-2",
        q: "How is a birthday scheduler different from a regular phone alarm?",
        a: "It repeats by itself, and it isn't stuck on one device. A phone alarm rings where you set it and needs resetting each year; a scheduler carries the whole list forward and can reach you by push, email, SMS, or WhatsApp.",
      },
      {
        id: "faq-3",
        q: "Can I set more than one alarm for the same birthday?",
        a: "Yes. A week ahead so there's time to post something, and again on the morning, is the usual pair — but the lead times are yours to choose.",
      },
      {
        id: "faq-4",
        q: "What channels can a birthday alarm use to notify me?",
        a: "Push, email, SMS, WhatsApp, and the in-app feed. Use one, or several at once. SMS and WhatsApp have a monthly fair-use cap, and past it the alarm still arrives by push and email.",
      },
      {
        id: "faq-5",
        q: "Does a birthday alarm app work for more than birthdays?",
        a: "Yes. Anniversaries, pets, and anything else you want to name — each with its own alarms rather than one blanket setting.",
      },
      {
        id: "faq-6",
        q: "Is there a widget to see upcoming birthday alarms without opening the app?",
        a: "Yes. The home-screen widget shows the next three and updates itself as the days pass.",
      },
      {
        id: "faq-7",
        q: "Is Birthday Reminders free to use as a birthday alarm app?",
        a: "Yes. Free on web, iOS, and Android, with no ads and no paid tier waiting for you later.",
      },
    ],
  },
  cta: {
    heading: "Set the first one now",
    body: "One date, one alarm, and it's handled for as long as you keep the account. It's free.",
    ctaLabel: "Start for free",
    ctaHref: "/signup",
    footnote: "Mobile apps coming soon.",
  },
};
