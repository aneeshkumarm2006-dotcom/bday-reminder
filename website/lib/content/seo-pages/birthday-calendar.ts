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
    "A digital birthday calendar that syncs with Apple, Google, and Outlook — and sends the reminder before the date, which a calendar square can't do on its own.",
  keywords: [
    "birthday calendar app",
    "digital birthday calendar",
    "electronic birthday calendar",
    "birthday reminder calendar",
    "birthday calendar",
  ],

  hero: {
    badge: "Syncs with Apple, Google, and Outlook",
    heading: "A digital birthday calendar that actually reminds you",
    subheading:
      "Most birthday calendars are a grid of dates you have to remember to open. This one lives inside the calendar app you already check, and the reminder comes to you before the date instead of waiting to be noticed.",
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
    body: "A wall calendar with the birthdays written in works right up until the week you don't look at it. Same with a PDF year-view, or an app you have to open. Birthday Reminders sends the date out to you instead — push, email, SMS or WhatsApp, or the widget on your home screen — so noticing isn't the part that has to go right.",
  },

  features: {
    heading: "The calendar, plus the bit calendars leave out",
    sub: "Subscribe once and the birthdays keep themselves current. Everything sits in one list, and something tells you before each date arrives.",
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
    heading: "Set it up once, in about five minutes",
    steps: [
      {
        id: "step-add",
        offset: -7,
        title: "Add the birthdays",
        body: "Type a name and a date, or pull them straight out of your contacts or a spreadsheet. The year is optional.",
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
    ],
  },

  cta: {
    heading: "Put every birthday in one calendar",
    body: "Setting it up takes about five minutes, and it stays free — no trial, no card, nothing to upgrade to.",
    ctaLabel: "Start for free",
    ctaHref: "/signup",
    footnote: "Mobile apps coming soon.",
  },
};
