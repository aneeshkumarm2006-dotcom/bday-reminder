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
    "Birthday Reminders is the birthday alarm app that never lets a date slip by, with a built-in birthday scheduler to plan cards, calls, and gifts in advance.",
  keywords: [
    "birthday alarm app",
    "birthday scheduler",
    "birthday alarm",
    "birthday schedule",
  ],
  hero: {
    badge: "Birthday alarms that repeat every year",
    heading: "A birthday alarm that goes off exactly when you need it",
    subheading:
      "Not a single alert you have to remember to set — a birthday alarm scheduled automatically for everyone you care about, on the channel and timing you choose.",
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
    body: "Setting a phone alarm or calendar alert for a single birthday works, until you have to do it for every person in your life, every single year. Birthday Reminder schedules the alert once, then repeats it automatically — for every birthday, anniversary, and event you track.",
  },
  features: {
    heading: "Everything a birthday alarm app should do",
    sub: "Every alarm is scheduled once, then fires on its own — with the lead times, channels, and local time you choose.",
    rows: [
      {
        id: "row-scheduler",
        icon: "ListChecks",
        eyebrow: "Scheduling that runs itself",
        title: "A scheduler that runs in the background",
        body: "No need to open the app to check what's coming — alarms fire on their own, and a persistent in-app feed keeps a record of what's upcoming and what's already passed.",
        points: [
          "Fully automated scheduling, no manual triggering",
          "In-app feed for a running history of alerts",
          "SMS/WhatsApp available with a fair-use cap, falling back to push and email",
        ],
        preview: "app",
      },
      {
        id: "row-greeting",
        icon: "MessageCircle",
        eyebrow: "Act on the day",
        title: "From alarm to greeting, in one tap",
        body: "When the alarm fires on the day, it opens your messaging app with a friendly, editable message ready to send.",
        points: [
          "Pre-filled template: “Happy birthday, [Name]! 🎉”",
          "You always review and send it yourself — never auto-sent",
          "Mark as done or snooze right from the alarm",
        ],
        preview: "reminder",
      },
      {
        id: "row-widget",
        icon: "Smartphone",
        eyebrow: "Always in view",
        title: "A widget that shows what's scheduled next",
        body: "See the next three birthdays and their alarm timing right on your home screen.",
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
        id: "card-repeats",
        icon: "Repeat",
        title: "Set it once, it repeats every year",
        body: "Add a birthday and its alarm schedule once. Birthday Reminder keeps firing it automatically every year, with no need to reset it.",
        points: [
          "Works for birthdays, anniversaries, pets, and custom events",
          "Year is optional; ages appear only when known",
          "No manual re-scheduling required",
        ],
      },
      {
        id: "card-multiple-alarms",
        icon: "BellRing",
        title: "Multiple alarms per person",
        body: "Schedule more than one alert for the same birthday — for example, a heads-up a week ahead and another on the day itself.",
        points: [
          "Multiple lead times per event (7 days before and on the day)",
          "Choose the channel per alarm: push, email, SMS/WhatsApp, or in-app feed",
          "Alarms fire at your chosen local time, and re-anchor automatically when you travel",
        ],
      },
      {
        id: "card-shared-schedule",
        icon: "Users",
        title: "One schedule, shared with family",
        body: "Family members can add to the same schedule, so alarms don't depend on one person remembering to set them.",
        points: [],
      },
    ],
  },
  howItWorks: {
    heading: "Three steps to a birthday schedule that runs itself",
    steps: [
      {
        id: "step-add",
        offset: -7,
        title: "Add the people who matter",
        body: "Type a name and date, or import from contacts or a spreadsheet. Year is optional.",
      },
      {
        id: "step-schedule",
        offset: -1,
        title: "Schedule your alarms",
        body: "Choose how far ahead and which channel each one fires on.",
      },
      {
        id: "step-run",
        offset: 0,
        title: "Let it run",
        body: "Alarms fire automatically every year, no resetting required.",
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    sub: "Everything about birthday alarms, scheduling them once, and the channels they fire on.",
    items: [
      {
        id: "faq-1",
        q: "What is a birthday alarm app?",
        a: "A birthday alarm app sets a recurring alert for each birthday so you're notified automatically every year, instead of relying on a one-time reminder you have to reset.",
      },
      {
        id: "faq-2",
        q: "How is a birthday scheduler different from a regular phone alarm?",
        a: "A birthday scheduler repeats automatically every year and can notify you across multiple channels, while a regular phone alarm has to be reset manually and only rings on the device where it was set.",
      },
      {
        id: "faq-3",
        q: "Can I set more than one alarm for the same birthday?",
        a: "Yes. You can set multiple lead times for the same birthday, such as a reminder a week before and again on the day itself.",
      },
      {
        id: "faq-4",
        q: "What channels can a birthday alarm use to notify me?",
        a: "Push, email, SMS/WhatsApp, and an in-app feed, individually or in any combination you choose.",
      },
      {
        id: "faq-5",
        q: "Does a birthday alarm app work for more than birthdays?",
        a: "Yes. Birthday Reminder's alarms also cover anniversaries, pets, and custom events, not just birthdays.",
      },
      {
        id: "faq-6",
        q: "Is there a widget to see upcoming birthday alarms without opening the app?",
        a: "Yes. The home-screen widget shows the next three birthdays and updates on its own as the days pass.",
      },
      {
        id: "faq-7",
        q: "Is Birthday Reminder free to use as a birthday alarm app?",
        a: "Yes. It's free on web, iOS, and Android, with no ads and no paid tier.",
      },
    ],
  },
  cta: {
    heading: "Schedule your first birthday alarm",
    body: "Free forever. Use it on the web right now, or get it on your phone for reminders and the home-screen widget.",
    ctaLabel: "Start for free",
    ctaHref: "/signup",
    footnote: "Mobile apps coming soon.",
  },
};
