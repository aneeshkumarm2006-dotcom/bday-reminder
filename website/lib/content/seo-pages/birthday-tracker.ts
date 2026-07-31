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
    "A birthday tracker that pulls the dates already sitting in your contacts, keeps them in one sorted list, and reminds you before each one comes round.",
  keywords: [
    "birthday tracker app",
    "birthday list app",
    "birthday finder app",
    "birthday tracker",
    "birthday list",
  ],
  hero: {
    badge: "Birthday tracker, list, and finder",
    heading: "A birthday tracker you don't have to fill in by hand",
    subheading:
      "Half the birthdays you want are already saved in your phone's contacts. Import them, add the ones that aren't, and you have one list that sorts itself and speaks up before each date.",
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
    body: "Birthdays end up scattered: a few in your contacts, one in a group chat from three years ago, the rest in someone else's head. Typing all of that into a blank app is the reason most birthday lists get abandoned about six names in. So the import comes first here, and the list you end up with is the one that does the work.",
  },
  features: {
    heading: "Get the list built, then let it run",
    sub: "Pull in the dates you already have, keep everyone in one place, and hear about each one before it arrives.",
    rows: [
      {
        id: "row-list",
        icon: "ListChecks",
        eyebrow: "One list, always sorted",
        title: "Everyone in one list, nearest date first",
        body: "Birthdays, anniversaries, pets, and whatever else you want to remember all sit in the same list. You never re-sort it — whoever is closest moves to the top on their own.",
        points: [
          "Birthdays, anniversaries, pets, and any date you name",
          "Sorted by whichever date is closest",
          "An in-app feed keeps a record of who's just been and who's next",
        ],
        preview: "app",
      },
      {
        id: "row-widget",
        icon: "Smartphone",
        eyebrow: "One glance away",
        title: "The top of the list, on your home screen",
        body: "The next three names sit on your home screen, so the tracker is doing its job even on the days you never open it.",
        points: [
          "Name, date, and how many days are left",
          "Redraws itself as the days pass",
          "Tap a name to open their profile",
        ],
        preview: "widget",
      },
      {
        id: "row-greeting",
        icon: "MessageCircle",
        eyebrow: "Act on the day",
        title: "From a name on a list to a message sent",
        body: "When a tracked date arrives, the reminder opens your own messaging app with something already typed. Edit it or send it as is.",
        points: [
          "Starts you off with “Happy birthday, [Name]! 🎉”",
          "It's your thumb on send — nothing goes out on its own",
          "Snooze it or mark it done from the reminder",
        ],
        preview: "reminder",
      },
    ],
    cards: [
      {
        id: "card-import",
        icon: "Search",
        title: "Find the birthdays you already have",
        body: "Import straight from your phone contacts or a spreadsheet and the list builds itself. Anyone missing takes about four seconds to add: a name and a date, year optional.",
        points: [
          "Import from contacts or a spreadsheet in one pass",
          "Duplicates are caught before anything is saved",
          "Add the stragglers by hand",
        ],
      },
      {
        id: "card-countdown",
        icon: "Timer",
        title: "It tracks the days, not just the dates",
        body: "Each name carries a live count of the days remaining, and a reminder lands before the count runs out — a week ahead, the morning of, or both.",
        points: [
          "Push, email, SMS or WhatsApp, or the in-app feed",
          "More than one lead time per person",
          "Fires at your local hour, and follows you across timezones",
        ],
      },
      {
        id: "card-gifts",
        icon: "Gift",
        title: "Gift notes, kept with the name",
        body: "The jumper size, the book they mentioned in October, the thing they already own. Write it down when you hear it and it's waiting on their profile in December.",
        points: [],
      },
      {
        id: "card-share",
        icon: "Users",
        title: "Share the list with family",
        body: "Invite family to the same list so it stops being one person's job to keep it accurate.",
        points: [],
      },
    ],
  },
  howItWorks: {
    heading: "Three steps to a list that keeps itself",
    steps: [
      {
        id: "step-import",
        offset: -7,
        title: "Import what you've got",
        body: "Pull birthdays out of your contacts or a spreadsheet, then add anyone the import missed. The year is optional.",
      },
      {
        id: "step-track",
        offset: -1,
        title: "Say when you want telling",
        body: "Pick the lead time and the channel, once for everyone or person by person.",
      },
      {
        id: "step-greet",
        offset: 0,
        title: "Send a greeting when it's time",
        body: "Open your messages with a note ready to go, then mark it done.",
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    sub: "Where the dates come from, what the list keeps, and what it does once it has them.",
    items: [
      {
        id: "faq-1",
        q: "What is a birthday tracker app?",
        a: "It's one list of everyone's birthdays that counts the days for you and speaks up before each date. The point is to stop the dates living in four places — your memory, your contacts, an old group chat, and a note you can't find.",
      },
      {
        id: "faq-2",
        q: "Is there an app to find and keep track of my contacts' birthdays?",
        a: "Yes. Birthday Reminders imports birthdays straight from your phone contacts or a spreadsheet, checks for duplicates, and keeps the result as one sorted list that reminds you before each date.",
      },
      {
        id: "faq-3",
        q: "What is a birthday list app used for?",
        a: "Keeping birthdays, anniversaries, and other dates you don't want to miss in one place, usually with gift ideas attached, so you can see who's coming up next without hunting for it.",
      },
      {
        id: "faq-4",
        q: "How can I locate someone's birthday if I don't already know it?",
        a: "Your contacts are the most reliable place to look, and Birthday Reminders can import whatever's stored there. Beyond that, someone has to tell you — no app can conjure a date that was never written down, whatever the ads say.",
      },
      {
        id: "faq-5",
        q: "Does a birthday tracker app work for anniversaries and pets too?",
        a: "Yes. Anniversaries, pets, and any date you want to name, each with its own reminders rather than one shared setting.",
      },
      {
        id: "faq-6",
        q: "Can I keep gift ideas alongside my birthday list?",
        a: "Yes. Every person has a notes field for ideas, sizes, and what they already own. It's private to you, unless the person is on a list you share.",
      },
      {
        id: "faq-7",
        q: "Is Birthday Reminders free to use as a birthday tracker?",
        a: "Yes. Free on web, iOS, and Android, with no ads and no paid tier waiting for you later.",
      },
    ],
  },
  cta: {
    heading: "Build the list once",
    body: "Import your contacts and you'll have most of it in a minute. The rest you'll add as you learn it.",
    ctaLabel: "Start for free",
    ctaHref: "/signup",
    footnote: "Mobile apps coming soon.",
  },
};
