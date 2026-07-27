import type { SeoLandingPageDef } from "./types";

/**
 * Targets the "birthday tracker app / birthday list app / birthday finder app"
 * cluster. The wedge is the *finder* half of that intent: people searching here
 * don't have the dates written down anywhere, so the page answers with contacts
 * and spreadsheet import — honest capability we actually ship — rather than the
 * "AI scans your social profiles" promise the competitors on this term make.
 * Everything after that is the payoff: one always-sorted list that counts down
 * and reminds, which is what separates us from a static list app.
 */
export const birthdayTrackerPage: SeoLandingPageDef = {
  slug: "birthday-tracker",
  label: "Birthday tracker app",
  blurb: "Import birthdays from your contacts and keep everyone in one sorted list.",
  title: "Birthday Tracker App | Birthday Reminders",
  description:
    "The birthday tracker app, birthday list app, and birthday finder app in one place this is where all my birthday reminders live, synced straight to my phone.",
  keywords: [
    "birthday tracker app",
    "birthday list app",
    "birthday finder app",
    "birthday tracker",
    "birthday list",
  ],
  hero: {
    badge: "Birthday tracker, list, and finder",
    heading: "A birthday tracker that finds, lists, and reminds — all in one app",
    subheading:
      "Import the birthdays already sitting in your contacts, keep them in one organized list, and let Birthday Reminder track the countdown and send the alert before each one arrives.",
    primaryCta: { label: "Start for free", href: "/signup" },
    footnote: "Free on web, iOS, and Android. No ads, no paid tier.",
    visuals: ["app", "reminder"],
  },
  contrast: {
    headingParts: {
      lead: "A",
      muted: "list",
      mid: " only helps if it's",
      accent: "complete",
      tail: "and up to date",
    },
    body: "Most people's birthdays are already scattered across contacts, old texts, and social media — not written down anywhere useful. A real birthday tracker should pull those dates together automatically, not ask you to retype them one by one, and it should do something with that list once you have it.",
  },
  features: {
    heading: "Everything a birthday tracker app should do",
    sub: "Import the dates you already have, keep them in one sorted list, and get reminded before each one arrives.",
    rows: [
      {
        id: "row-list",
        icon: "ListChecks",
        eyebrow: "One list, always sorted",
        title: "One organized, always-sorted list",
        body: "Every birthday, anniversary, pet, and custom event lives in a single list, automatically sorted so the nearest date is always on top.",
        points: [
          "Works for birthdays, anniversaries, pets, and custom events",
          "Automatic sorting by nearest date",
          "A persistent in-app feed keeps a running history of who's coming up",
        ],
        preview: "app",
      },
      {
        id: "row-widget",
        icon: "Smartphone",
        eyebrow: "One glance away",
        title: "A widget for your tracked list",
        body: "Keep the next three birthdays one glance away, right on your home screen.",
        points: [
          "Name, date, and days remaining at a glance",
          "Updates on its own as days pass",
          "Tap a name to jump straight to their profile",
        ],
        preview: "widget",
      },
      {
        id: "row-greeting",
        icon: "MessageCircle",
        eyebrow: "Act on the day",
        title: "From list to greeting, in one tap",
        body: "When a tracked birthday arrives, the reminder opens your messaging app with a friendly, editable message ready to send.",
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
        id: "card-import",
        icon: "Search",
        title: "Find and import birthdays from your contacts",
        body: "Skip the manual entry. Import birthdays directly from your phone contacts or a spreadsheet, and Birthday Reminder builds your tracked list for you.",
        points: [
          "Import from contacts or a spreadsheet in one step",
          "Add anyone missing with just a name and date",
          "Year is optional; ages appear only when known",
        ],
      },
      {
        id: "card-countdown",
        icon: "Timer",
        title: "Tracks the countdown and reminds you before it matters",
        body: "Birthday Reminder doesn't just list dates — it tracks the days remaining for each person and reminds you ahead of time, on the channel you choose.",
        points: [
          "Push, email, SMS/WhatsApp, or an in-app feed",
          "Multiple lead times per person (7 days before, on the day, or both)",
          "Reminders fire at your local time, and re-anchor automatically when you travel",
        ],
      },
      {
        id: "card-gifts",
        icon: "Gift",
        title: "Gift notes attached to each name",
        body: "Keep a running list of gift ideas, sizes, and preferences tied to each person on your list, private to you.",
        points: [],
      },
      {
        id: "card-share",
        icon: "Users",
        title: "Share your list with family",
        body: "Invite family members to the same tracked list, so it stays complete without depending on one person.",
        points: [],
      },
    ],
  },
  howItWorks: {
    heading: "Three steps to a birthday list that tracks itself",
    steps: [
      {
        id: "step-import",
        offset: -7,
        title: "Import or add the people who matter",
        body: "Pull birthdays in from contacts or a spreadsheet, or add them by hand. Year is optional.",
      },
      {
        id: "step-track",
        offset: -1,
        title: "Let it track the countdown",
        body: "Choose how far ahead and which channel you want reminded on.",
      },
      {
        id: "step-greet",
        offset: 0,
        title: "Send a greeting when it's time",
        body: "Open your messages with a ready-to-send note, then mark it done.",
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    sub: "How a birthday tracker builds your list, where it finds the dates, and what else it keeps track of.",
    items: [
      {
        id: "faq-1",
        q: "What is a birthday tracker app?",
        a: "A birthday tracker app keeps a running list of everyone's birthdays, tracks how many days remain until each one, and reminds you before the date arrives, instead of relying on memory or a scattered set of notes.",
      },
      {
        id: "faq-2",
        q: "Is there an app to find and keep track of my contacts' birthdays?",
        a: "Yes. Birthday Reminder lets you import birthdays directly from your phone contacts or a spreadsheet, then keeps that list organized and reminds you before each date.",
      },
      {
        id: "faq-3",
        q: "What is a birthday list app used for?",
        a: "A birthday list app organizes birthdays, anniversaries, and other important dates into a single sorted list, often alongside gift ideas, so you always know who's coming up next.",
      },
      {
        id: "faq-4",
        q: "How can I locate someone's birthday if I don't already know it?",
        a: "Birthday Reminder can import birthdays already stored in your phone's contacts, which is the most reliable way to fill in dates you don't have memorized. You can also add anyone manually with just a name and date.",
      },
      {
        id: "faq-5",
        q: "Does a birthday tracker app work for anniversaries and pets too?",
        a: "Yes. Birthday Reminder tracks birthdays, anniversaries, pets, and any custom event, each with its own independent reminders.",
      },
      {
        id: "faq-6",
        q: "Can I keep gift ideas alongside my birthday list?",
        a: "Yes. You can attach gift notes — ideas, sizes, and preferences — to each person on your list, kept private to your account.",
      },
      {
        id: "faq-7",
        q: "Is Birthday Reminder free to use as a birthday tracker?",
        a: "Yes. It's free on web, iOS, and Android, with no ads and no paid tier.",
      },
    ],
  },
  cta: {
    heading: "Build your birthday list in minutes",
    body: "Free forever. Use it on the web right now, or get it on your phone for reminders and the home-screen widget.",
    ctaLabel: "Start for free",
    ctaHref: "/signup",
    footnote: "Mobile apps coming soon.",
  },
};
