import type { SeoLandingPageDef } from "./types";

/**
 * Targets the "family birthday calendar" cluster, where the search results are
 * dominated by things you buy and hang up: wooden boards, personalized wall
 * calendars, and printable PDFs. None of them can be edited by two people at
 * once, and none of them can reach out to you. So the wedge here is *shared and
 * always current* — one list the whole family edits, with each member keeping
 * their own reminders. That's the one thing a board or a printable literally
 * cannot do, which is why every section leans on it rather than on countdowns
 * (/birthday-countdown-app) or calendar sync (/birthday-calendar).
 */
export const familyBirthdayCalendarPage: SeoLandingPageDef = {
  slug: "family-birthday-calendar",
  label: "Family birthday calendar",
  blurb:
    "Invite relatives, everyone adds dates, and each person gets their own reminders.",
  title: "Family Birthday Calendar | Birthday Reminders",
  description:
    "A shared family birthday calendar everyone can add to and get reminded from. Birthday Reminder keeps every family birthday, anniversary, and pet in one place.",
  keywords: [
    "family birthday calendar",
    "shared family birthday calendar",
    "family calendar",
    "printable family birthday calendar",
  ],
  hero: {
    badge: "Shared family birthday calendar",
    heading: "One family birthday calendar, everyone can add to it",
    subheading:
      "Physical boards and printables only work if someone updates them. Birthday Reminder is a shared family birthday calendar that stays current on its own — anyone in the family can add a date, and everyone gets reminded in time.",
    primaryCta: { label: "Start for free", href: "/signup" },
    footnote: "Free on web, iOS, and Android. No ads, no paid tier.",
    visuals: ["app"],
  },
  contrast: {
    headingParts: {
      lead: "A",
      muted: "wall board",
      mid: " only works if someone",
      accent: "remembers",
      tail: "to update it",
    },
    body: "Wooden boards, printables, and personalized wall calendars look nice, but they depend on one person keeping them current, and no one gets reminded unless they happen to walk past it. Birthday Reminder replaces that with a calendar the whole family can edit together, that sends reminders automatically instead of waiting to be noticed.",
  },
  features: {
    heading: "Everything a family birthday calendar should do",
    sub: "One list the whole family can edit, with reminders that reach each person the way they prefer.",
    rows: [
      {
        id: "row-shared-list",
        icon: "Users",
        eyebrow: "Everyone keeps it current",
        title: "A calendar the whole family can edit",
        body: "Invite family members to the same list. Anyone can add a birthday, anniversary, or event, so it never depends on one person keeping it updated.",
        points: [
          "Multiple family members can add and edit",
          "Everyone sees the same up-to-date list",
          "Each person keeps their own reminder settings",
        ],
        preview: "app",
      },
      {
        id: "row-reminders",
        icon: "Bell",
        eyebrow: "Each person, their way",
        title: "Reminders for every family member, their way",
        body: "Each family member can choose their own reminder channel and lead time, so nobody has to check a shared board to know what's coming up.",
        points: [
          "Push, email, SMS/WhatsApp, or an in-app feed",
          "Multiple lead times per person (7 days before, on the day, or both)",
          "Reminders arrive at each person's own timezone",
        ],
        preview: "reminder",
      },
      {
        id: "row-widget",
        icon: "Smartphone",
        eyebrow: "One glance away",
        title: "A home-screen widget for the next 3",
        body: "Keep the next three family birthdays one glance away, without opening the app.",
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
        id: "card-every-date",
        icon: "Layers",
        title: "Every kind of family date, in one place",
        body: "Birthdays, anniversaries, pets, and custom events — grandparents, cousins, in-laws, and the family dog all fit in the same calendar.",
        points: [
          "Works for birthdays, anniversaries, pets, and custom events",
          "Automatic sorting by nearest date",
          "Age shown automatically when the birth year is known",
        ],
      },
      {
        id: "card-greeting",
        icon: "MessageCircle",
        title: "From reminder to greeting",
        body: "When a family birthday arrives, the reminder opens your messaging app with a friendly, editable message ready to send.",
        points: [
          "Pre-filled template: “Happy birthday, [Name]! 🎉”",
          "You always review and send it yourself — never auto-sent",
          "Mark as done or snooze right from the reminder",
        ],
      },
      {
        id: "card-gift-notes",
        icon: "Gift",
        title: "Gift notes, kept with each person",
        // The brief says "private to your account", which isn't true on the one
        // page that exists to get the whole family onto a shared list: notes are
        // readable by everyone with access to the person (backend `notes.ts`,
        // FR-37). Reworded to the homepage's accurate "you and your list".
        body: "Keep a running list of gift ideas, sizes, and preferences for each family member, private to you and your list.",
        points: [],
      },
      {
        id: "card-calendar-sync",
        icon: "CalendarDays",
        title: "Syncs to the calendar you already use",
        body: "Subscribe to the family calendar in Apple, Google, or Outlook, and it stays in sync as anyone adds or edits a date.",
        points: [],
      },
    ],
  },
  howItWorks: {
    heading: "Three steps to a family calendar that keeps itself updated",
    steps: [
      {
        id: "step-invite",
        offset: -7,
        title: "Invite the family",
        body: "Add the people who matter, or invite relatives to add their own side of the family.",
      },
      {
        id: "step-remind",
        offset: -1,
        title: "Everyone gets reminded, their own way",
        body: "Each person sets their preferred channel and lead time.",
      },
      {
        id: "step-greet",
        offset: 0,
        title: "Send a greeting together",
        body: "On the day, anyone can open a ready-to-send note and mark it done.",
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    sub: "How a shared family birthday calendar works, and what it can keep track of.",
    items: [
      {
        id: "faq-1",
        q: "What is a family birthday calendar?",
        a: "A family birthday calendar is a shared list of birthdays, anniversaries, and other family dates that everyone in the family can view and update, instead of relying on one person's memory or a single physical calendar.",
      },
      {
        id: "faq-2",
        q: "Can multiple family members add birthdays to the same calendar?",
        a: "Yes. Birthday Reminder lets you invite family members to a shared list where anyone can add or edit a birthday, anniversary, or event.",
      },
      {
        id: "faq-3",
        q: "Does everyone in the family get their own reminders?",
        a: "Yes. Each family member can set their own reminder channel — push, email, or SMS/WhatsApp — and lead time, so reminders arrive the way that works for them.",
      },
      {
        id: "faq-4",
        q: "Can a family birthday calendar include pets and anniversaries, not just birthdays?",
        a: "Yes. Birthday Reminder supports birthdays, anniversaries, pets, and any custom family event, each reminding you independently.",
      },
      {
        id: "faq-5",
        q: "Is there a physical or printable version of a family birthday calendar?",
        a: "Birthday Reminder is a digital, always-up-to-date calendar rather than a printed one, but it syncs with Apple Calendar, Google Calendar, and Outlook so you can see it alongside any calendar you already keep on the fridge or wall.",
      },
      {
        id: "faq-6",
        q: "Is Birthday Reminder free to use as a family birthday calendar?",
        a: "Yes. It's free on web, iOS, and Android, with no ads and no paid tier.",
      },
    ],
  },
  cta: {
    heading: "Bring the whole family onto one calendar",
    body: "Free forever. Use it on the web right now, or get it on your phone for reminders and the home-screen widget.",
    ctaLabel: "Start for free",
    ctaHref: "/signup",
    footnote: "Mobile apps coming soon.",
  },
};
