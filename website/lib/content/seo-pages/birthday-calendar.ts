import type { SeoLandingPageDef } from "./types";

/**
 * Targets the "birthday calendar app" cluster — digital / electronic birthday
 * calendar, birthday reminder calendar.
 *
 * The competition on these terms is printable templates, PDF year-views, and
 * static apps: things you have to remember to open. So the wedge is live
 * calendar sync — subscribe once in Apple, Google, or Outlook and the birthday
 * calendar keeps itself current — plus reminders that leave the calendar and
 * come to you. That's the one claim none of the templates ranking here can
 * match, which is why the hero and the first feature row both lead with it,
 * ahead of the brief's own ordering (its implementation notes ask for exactly
 * that swap).
 */
export const birthdayCalendarPage: SeoLandingPageDef = {
  slug: "birthday-calendar",
  label: "Digital birthday calendar",
  blurb: "Subscribe in Apple, Google, or Outlook and keep every birthday in sync.",
  title: "Birthday Calendar App | Birthday Reminders",
  description:
    "Birthday Reminders is a digital birthday calendar and electronic birthday calendar in one a birthday calendar app that's also your birthday reminder calendar.",
  keywords: [
    "birthday calendar app",
    "digital birthday calendar",
    "electronic birthday calendar",
    "birthday reminder calendar",
    "birthday calendar",
  ],

  hero: {
    badge: "Digital birthday calendar, synced",
    heading: "A digital birthday calendar that actually reminds you",
    subheading:
      "Most birthday calendars just show you the dates. Birthday Reminder organizes every birthday in one place, reminds you before it arrives, and helps you send a greeting — all from a calendar that syncs everywhere you already look.",
    primaryCta: { label: "Start for free", href: "/signup" },
    footnote: "Free on web, iOS, and Android. No ads, no paid tier.",
    visuals: ["app", "reminder"],
  },

  contrast: {
    headingParts: {
      lead: "A calendar you have to",
      muted: "remember to check",
      mid: " isn't a",
      accent: "reminder system",
      tail: "",
    },
    body: "Printable templates, PDF calendars, and static year-view apps all have the same gap: you still have to think to look. Birthday Reminder is a digital birthday calendar that comes to you instead — through push, email, SMS/WhatsApp, or a home-screen widget — so nothing depends on you remembering to open an app.",
  },

  features: {
    heading: "Everything a digital birthday calendar should do",
    sub: "Synced to the calendar you already use, with every date in one place and the reminders a calendar can't send on its own.",
    rows: [
      {
        id: "row-sync",
        icon: "CalendarDays",
        eyebrow: "Subscribe once, stays current",
        title: "Syncs to the calendar you already use",
        body: "Subscribe to your birthday calendar in Apple Calendar, Google Calendar, or Outlook, and it stays in sync as you add, edit, or remove people — no separate app to check.",
        points: [
          "One-tap subscribe from any of the three major calendar apps",
          "Updates automatically, no manual re-import",
          "Works alongside your existing personal and work calendar",
        ],
        preview: "app",
      },
      {
        id: "row-reminders",
        icon: "BellRing",
        eyebrow: "It comes to you",
        title: "Reminders your calendar can't send on its own",
        body: "A calendar shows you a date. Birthday Reminder also tells you before it arrives, on the channel you prefer, at the time you choose, in your own timezone.",
        points: [
          "Push, email, SMS/WhatsApp, or an in-app feed",
          "Multiple lead times per person (7 days before, on the day, or both)",
          "Reminders re-anchor automatically when you travel",
        ],
        preview: "reminder",
      },
      {
        id: "row-widget",
        icon: "Smartphone",
        eyebrow: "One glance away",
        title: "A home-screen widget for the next 3",
        body: "Keep the next three birthdays one glance away, without opening the calendar at all.",
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
        id: "card-one-place",
        icon: "ListChecks",
        title: "One place for every birthday",
        body: "Add everyone who matters — family, friends, pets, anniversaries, custom events — and see them all sorted automatically by nearest date, with age shown when the birth year is known.",
        points: [
          "Works for birthdays, anniversaries, pets, and custom events",
          "Automatic sorting by upcoming date",
          "Year is optional; ages appear only when known",
        ],
      },
      {
        id: "card-shared",
        icon: "Users",
        title: "Shared calendars for the whole family",
        body: "Track the same birthday calendar together with family or a group.",
        points: [
          "Everyone can add and edit",
          "Each person keeps their own reminder settings",
          "One shared source of truth instead of separate spreadsheets",
        ],
      },
      {
        id: "card-greeting",
        icon: "MessageCircle",
        title: "From reminder to greeting, in one tap",
        body: "When a birthday arrives, the reminder opens your messaging app with a friendly, editable message ready to send.",
        points: [
          "Pre-filled template: “Happy birthday, [Name]! 🎉”",
          "You always review and send it yourself — never auto-sent",
          "Mark as done or snooze right from the reminder",
        ],
      },
    ],
  },

  howItWorks: {
    heading: "Three steps to a calendar that works for you",
    steps: [
      {
        id: "step-add",
        offset: -7,
        title: "Add the people who matter",
        body: "Type a name and date, or import from contacts or a spreadsheet. Year is optional.",
      },
      {
        id: "step-sync",
        offset: -1,
        title: "Sync and get reminded",
        body: "Subscribe in Apple, Google, or Outlook, and choose how far ahead you want reminders.",
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
    sub: "Everything about digital birthday calendars, syncing them to Apple, Google, or Outlook, and getting reminded before the date.",
    items: [
      {
        id: "faq-1",
        q: "What is a digital birthday calendar?",
        a: "A digital birthday calendar stores birthdays and other important dates online instead of on paper, sending automatic reminders so you don't have to check it to remember what's coming up.",
      },
      {
        id: "faq-2",
        q: "How is an electronic birthday calendar different from a paper one?",
        a: "An electronic birthday calendar updates automatically, sends reminders on its own, and syncs across devices, while a paper calendar only works if someone remembers to check it.",
      },
      {
        id: "faq-3",
        q: "Can I sync a birthday calendar app with Google or Apple Calendar?",
        a: "Yes. Birthday Reminder syncs with Apple Calendar, Google Calendar, and Outlook, staying up to date as you add, edit, or remove people.",
      },
      {
        id: "faq-4",
        q: "Is there a birthday reminder calendar that notifies me before the date?",
        a: "Yes. You can set reminders for multiple lead times, such as seven days before and on the day itself, delivered at your own timezone.",
      },
      {
        id: "faq-5",
        q: "Can a birthday calendar app track anniversaries and pets too?",
        a: "Yes. Birthday Reminder tracks birthdays, anniversaries, pets, and custom events, each reminding you independently.",
      },
      {
        id: "faq-6",
        q: "Can my family share the same birthday calendar?",
        a: "Yes. Invite family members to the same calendar so everyone can add and edit dates together.",
      },
      {
        id: "faq-7",
        q: "Is Birthday Reminder free to use as a digital birthday calendar?",
        a: "Yes. It's free on web, iOS, and Android, with no ads and no paid tier.",
      },
    ],
  },

  cta: {
    heading: "Build your birthday calendar in minutes",
    body: "Free forever. Use it on the web right now, or get it on your phone for reminders and the home-screen widget.",
    ctaLabel: "Start for free",
    ctaHref: "/signup",
    footnote: "Mobile apps coming soon.",
  },
};
