import type { SeoLandingPageSource } from "./types";

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
export const birthdayCalendarPage: SeoLandingPageSource = {
  slug: "birthday-calendar",
  label: "Digital birthday calendar",
  blurb: "Subscribe in Apple, Google, or Outlook and keep every birthday in sync.",
  // 30-day plan, Day 2. "Google Calendar Birthday Reminders" stays out of the
  // title: that keyword gets its own post on Day 16.
  title: "Birthday Calendar App: Free Online Birthday Reminder Calendar",
  description:
    "A free online birthday calendar for iPhone, Android and the web. It syncs with Google Calendar and Outlook and reminds you before each birthday.",
  keywords: [
    "online birthday calendar",
    "birthday calendar app",
    "birthday reminders calendar",
    "birthday calendar for iphone",
    "birthday calendar for android",
    "digital birthday calendar",
  ],

  hero: {
    badge: "Free on iPhone, Android & web · No ads",
    heading: "Online birthday calendar app that reminds you",
    subheading:
      "Birthday Reminders is an online birthday calendar that tells you a birthday is coming before the day arrives. Use it on the web, or on iPhone and Android with our app, Circle the date. It also shows up inside Google Calendar, Apple Calendar or Outlook, so the dates sit next to everything else you check.",
    primaryCta: { label: "Start free on the web", href: "/signup" },
    footnote: "Free on web, iOS, and Android. No ads, no paid tier.",
    visuals: ["app", "reminder"],
  },

  photo: {
    imageUrl:
      "https://res.cloudinary.com/de26l2h0a/image/upload/v1789056765/circlethedate-blog/birthday-calendar-june-date-circled.webp",
    imageAlt:
      "A paper June calendar with the 6th circled in orange and labelled “Birthday!”, the sheet a digital birthday calendar replaces",
    caption:
      "A circled square only works if you happen to open the calendar that week. Sync yours and the reminder comes to you instead.",
    width: 1764,
    height: 1174,
  },
  contrast: {
    headingParts: {
      lead: "A calendar you have to",
      muted: "remember to check",
      mid: " isn't a",
      accent: "reminder system",
      tail: "",
    },
    body: "A wall calendar with the birthdays written in works right up until the week you don't look at it. Same with a PDF year-view, or an app you have to open. Birthday Reminders sends the date out to you instead — push, email, SMS or WhatsApp, or the widget on your home screen — so noticing isn't the part that has to go right.",
  },

  features: {
    heading: "Sync birthdays with Google Calendar and Outlook",
    sub: "Subscribe once from Google Calendar, Apple Calendar or Outlook. When you add someone or fix a date, your calendar updates by itself, and you still get a reminder a week before, the night before, or both.",
    rows: [
      {
        id: "row-sync",
        icon: "CalendarDays",
        eyebrow: "Subscribe once, stays current",
        title: "Syncs to the calendar you already use",
        body: "Subscribe once in Apple Calendar, Google Calendar, or Outlook. Add someone, fix a date you got wrong, remove a person — the subscribed calendar catches up on its own, and there's nothing to re-import in January.",
        points: [
          "One-tap subscribe from Apple, Google, or Outlook",
          "Edits show up without a re-import",
          "Sits alongside your work and personal calendars, not instead of them",
        ],
        preview: "app",
      },
      {
        id: "row-reminders",
        icon: "BellRing",
        eyebrow: "It comes to you",
        title: "The reminder a calendar entry won't send",
        body: "A calendar shows you the date once you go looking. This tells you a week out, or the night before, or both, wherever you actually read things — at the hour you picked, in whatever timezone you're standing in.",
        points: [
          "Push, email, SMS or WhatsApp, or the in-app feed",
          "More than one lead time per person: a week ahead, the day itself, or both",
          "Fly somewhere else and the reminders move with you",
        ],
        preview: "reminder",
      },
      {
        id: "row-widget",
        icon: "Smartphone",
        eyebrow: "One glance away",
        title: "A home-screen widget for the next 3",
        body: "The next three birthdays sit on your home screen, so checking the calendar stops being something you have to decide to do.",
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
        id: "card-one-place",
        icon: "ListChecks",
        title: "One place for every date",
        body: "Family, friends, the dog, your parents' anniversary, the date you'd rather not admit you forgot last year. They all sit in the same list, nearest first, with ages filled in wherever you know the birth year.",
        points: [
          "Birthdays, anniversaries, pets, and anything else you name",
          "Sorted by whichever date is closest",
          "The birth year is optional",
        ],
      },
      {
        id: "card-shared",
        icon: "Users",
        title: "Shared calendars for the whole family",
        body: "Invite the family and everyone works from the same calendar. Someone adds their side of it, you stop maintaining a spreadsheet, and each person still gets reminders their own way.",
        points: [
          "Everyone can add and edit",
          "Each person keeps their own reminder settings",
          "One list instead of four half-updated ones",
        ],
      },
      {
        id: "card-greeting",
        icon: "MessageCircle",
        title: "From reminder to greeting, in one tap",
        body: "On the day, the reminder opens your own messaging app with something already typed. Change it or send it as is.",
        points: [
          "Starts you off with “Happy birthday, [Name]! 🎉”",
          "It's your thumb on send — nothing goes out on its own",
          "Snooze it or mark it done from the reminder",
        ],
      },
    ],
  },

  howItWorks: {
    heading: "Birthday calendar for iPhone and Android",
    steps: [
      {
        id: "step-add",
        offset: -7,
        title: "Add the birthdays",
        body: "Get Circle the date on iPhone or Android, or start on the web. Add a name and a date, or import them from your contacts. You don't need the birth year.",
      },
      {
        id: "step-sync",
        offset: -1,
        title: "Subscribe in your calendar app",
        body: "One tap in Apple, Google, or Outlook, then pick how far ahead you want to hear about each date.",
      },
      {
        id: "step-greet",
        offset: 0,
        title: "Send something on the day",
        body: "The reminder opens your messages with a note ready to go. Send it, then mark it done.",
      },
    ],
  },

  faq: {
    heading: "Frequently asked questions",
    sub: "Syncing, reminders, and what a digital birthday calendar can keep track of.",
    items: [
      {
        id: "faq-1",
        q: "What is a digital birthday calendar?",
        a: "It's a birthday list that lives online rather than on paper, and it tells you when a date is coming up. The difference that matters is direction: paper waits for you to look at it, and this comes to you.",
      },
      {
        id: "faq-2",
        q: "How is an electronic birthday calendar different from a paper one?",
        a: "It updates itself, and it can reach you. Add a birthday once and it's there every year, on every device you log into, with a reminder ahead of the date instead of a square you have to happen to notice.",
      },
      {
        id: "faq-3",
        q: "Can I sync a birthday calendar app with Google or Apple Calendar?",
        a: "Yes — Apple Calendar, Google Calendar, and Outlook. You subscribe once and the feed keeps up as you add or edit people, so there's nothing to re-import.",
      },
      {
        id: "faq-4",
        q: "Is there a birthday reminder calendar that notifies me before the date?",
        a: "That's what this one is for. Set a reminder for a week before, the morning of, or both, and it arrives at the hour you chose in your own timezone.",
      },
      {
        id: "faq-5",
        q: "Can a birthday calendar app track anniversaries and pets too?",
        a: "Yes. Anniversaries, pets, and any date you want to name, each with its own reminders — the dog's birthday doesn't have to follow the same rules as your mother's.",
      },
      {
        id: "faq-6",
        q: "Can my family share the same birthday calendar?",
        a: "Yes. Invite family to the calendar and anyone can add to it, which is usually how the missing half of the family finally gets filled in.",
      },
      {
        id: "faq-7",
        q: "Is Birthday Reminders free to use as a digital birthday calendar?",
        a: "Yes. Free on web, iOS, and Android, with no ads and no paid tier waiting for you later.",
      },
      {
        id: "faq-iphone-android",
        q: "Is there a birthday calendar app for iPhone and Android?",
        a: "Yes. Circle the date is our free app for iPhone and Android, and Birthday Reminders runs in any browser. You sign in to the same account on each, so your birthdays and reminders follow you. On your phone, a home-screen widget shows the next three birthdays.",
      },
    ],
  },

  cta: {
    heading: "Put every birthday in one calendar",
    body: "Setting it up takes about five minutes, and it stays free — no trial, no card, nothing to upgrade to.",
    ctaLabel: "Start free on the web",
    ctaHref: "/signup",
    footnote: "",
  },
};
