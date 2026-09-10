import type { SeoLandingPageSource } from "./types";

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
export const birthdayCountdownAppPage: SeoLandingPageSource = {
  slug: "birthday-countdown-app",
  label: "Birthday countdown app",
  blurb: "See the days left to every birthday, then act before the countdown reaches zero.",
  title: "Birthday Countdown App | Birthday Reminders",
  description:
    "A birthday countdown app that shows the days left for everyone you track, then reminds you before the count runs out. Free on web, iOS, and Android.",
  keywords: ["birthday countdown app", "birthday countdown", "countdown app"],
  hero: {
    badge: "Live countdowns for every birthday",
    heading: "A birthday countdown app that does something when it hits zero",
    subheading:
      "Counting the days is the easy half. Birthday Reminders keeps a running count for everyone you track, then tells you while there's still time to order something, book something, or just write the message.",
    primaryCta: { label: "Start counting down for free", href: "/signup" },
    footnote: "Free on web, iOS, and Android. No ads, no paid tier.",
    visuals: ["app", "reminder"],
  },
  photo: {
    imageUrl:
      "https://res.cloudinary.com/de26l2h0a/image/upload/v1789056767/circlethedate-blog/birthday-countdown-app-phone-on-party-table.webp",
    imageAlt:
      "A hand holding a phone over a birthday table set with cake, gold confetti and a party hat",
    caption:
      "Counting the days is the easy half. The useful half is being told while there is still time to order, book, or write something.",
    width: 2000,
    height: 1333,
  },
  contrast: {
    headingParts: {
      lead: "A",
      muted: "countdown",
      mid: " is only useful if it",
      accent: "leads to something",
      tail: "",
    },
    body: "Most countdown apps stop at the number. You can watch “14 days” tick down to “2 days” and still miss it, because nothing about the number reaches you — you have to open the app to see it. Birthday Reminders runs the same count and then does the two things a number can't: it interrupts you at the point you asked to be interrupted, and it hands you a message ready to send.",
  },
  features: {
    heading: "The count, and what happens when it runs out",
    sub: "A live count for every date you add, the nearest ones on your home screen, and a reminder that turns the last day into a sent message.",
    rows: [
      {
        id: "row-countdowns",
        icon: "Timer",
        eyebrow: "Countdowns at a glance",
        title: "Live countdowns for everyone you track",
        body: "Days remaining, in plain words: “Today,” “in 3 days,” “in 16 days.” The list re-sorts itself so whoever is closest is always sitting at the top.",
        points: [
          "Counts down to birthdays, anniversaries, pets, and any date you add",
          "Nearest date always first",
          "Age filled in when you know the birth year",
        ],
        preview: "app",
      },
      {
        id: "row-widget",
        icon: "Smartphone",
        eyebrow: "On your home screen",
        title: "A widget that counts down without being opened",
        body: "The next three counts live on your home screen. You'll see “in 5 days” while you're unlocking your phone for something else entirely, which is usually when it's still useful.",
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
        eyebrow: "From countdown to greeting",
        title: "Zero day, one tap",
        body: "When the count runs out, the reminder opens your own messaging app with a message already written. Edit it or send it as it stands.",
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
        id: "card-reminders",
        icon: "BellRing",
        title: "Get told before it hits zero",
        body: "Pick your lead time — a week out, the morning of, or both — and choose where it lands. Reminders fire at your local hour, and follow you when you change timezones.",
        points: [
          "Push, email, SMS or WhatsApp, or the in-app feed",
          "More than one lead time per person",
          "Travel doesn't shift them to 3am",
        ],
      },
      {
        id: "card-shared",
        icon: "Users",
        title: "Shared countdowns for the whole family",
        body: "Put the family on the same list, so the count doesn't depend on one person having typed everyone in.",
        points: [
          "Everyone can add and edit",
          "Each person keeps their own reminder settings",
          "Works the same for a friend group or a team",
        ],
      },
      {
        id: "card-calendar",
        icon: "CalendarDays",
        title: "Calendar sync",
        body: "Subscribe to the same dates in Apple, Google, or Outlook if you'd rather see them in your normal calendar too. It stays current as you add and edit people.",
        points: [],
      },
    ],
  },
  howItWorks: {
    heading: "Three steps, then the counting is someone else's job",
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
        title: "Say when you want telling",
        body: "Pick the lead time and the channel. It arrives at your hour, in your timezone.",
      },
      {
        id: "step-greet",
        offset: 0,
        title: "Send a greeting when it hits zero",
        body: "Open your messages with a note ready to go, then mark it done.",
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    sub: "Counting down, getting reminded, and seeing it all without opening the app.",
    items: [
      {
        id: "faq-1",
        q: "What is a birthday countdown app?",
        a: "It keeps a running count of the days until each birthday you've saved, so you can see what's close without doing calendar arithmetic in your head. The useful ones also tell you before the count runs out.",
      },
      {
        id: "faq-2",
        q: "How does a birthday countdown app remind you before the day arrives?",
        a: "You choose when and where. Birthday Reminders can send a push, an email, an SMS or WhatsApp message, or drop it in the in-app feed — a week ahead, on the morning itself, or both.",
      },
      {
        id: "faq-3",
        q: "Can a birthday countdown app track more than one person?",
        a: "Yes, as many as you like. Every date you add gets its own count, and the list keeps itself sorted so the nearest one is on top.",
      },
      {
        id: "faq-4",
        q: "Is there a widget that shows the countdown without opening the app?",
        a: "Yes. The home-screen widget shows the next three and updates itself as the days pass, so the count is there whether or not you go looking for it.",
      },
      {
        id: "faq-5",
        q: "Can family members see the same countdown together?",
        a: "Yes. Invite them to a shared list and everyone sees the same dates counting down, while each person still gets reminded the way they prefer.",
      },
      {
        id: "faq-6",
        q: "Is Birthday Reminders free to use as a birthday countdown app?",
        a: "Yes. Free on web, iOS, and Android, with no ads and no paid tier waiting for you later.",
      },
    ],
  },
  cta: {
    heading: "Start your first countdown",
    body: "Add one birthday and you'll see the count on the next screen. It's free, and it stays that way.",
    ctaLabel: "Start for free",
    ctaHref: "/signup",
    footnote: "Mobile apps coming soon.",
  },
  /**
   * The default order, with one addition: a plain-language band between the
   * feature cards and the how-it-works steps. The copy above it is written to a
   * wedge ("a countdown that does something"), which suits a reader already
   * sold on the idea — this band is for the one still checking the page is what
   * they searched for, so it describes the birthday countdown in the words
   * they'd use themselves.
   */
  layout: [
    { id: "slot-hero", kind: "section", section: "hero", visible: true },
    { id: "slot-contrast", kind: "section", section: "contrast", visible: true },
    { id: "slot-photo", kind: "section", section: "photo", visible: true },
    { id: "slot-features", kind: "section", section: "features", visible: true },
    {
      id: "group-countdown-overview",
      kind: "blocks",
      visible: true,
      heading: "A simple and customizable birthday countdown",
      sub: "",
      background: "none",
      blocks: [
        {
          id: "block-countdown-overview",
          type: "richText",
          html: "<p>Birthday Reminders makes it easy to keep track of the birthdays that matter most. See upcoming birthdays in one place and quickly check how many days are left until each celebration.</p><p>Set personalized reminders based on when you want to be notified, and track birthdays for multiple friends, family members, coworkers, or pets. Whether a birthday is tomorrow or several weeks away, the birthday countdown app helps you stay organized, plan ahead, and never forget an important date.</p>",
        },
      ],
    },
    { id: "slot-howItWorks", kind: "section", section: "howItWorks", visible: true },
    { id: "slot-faq", kind: "section", section: "faq", visible: true },
    { id: "slot-related", kind: "section", section: "related", visible: true },
    { id: "slot-cta", kind: "section", section: "cta", visible: true },
  ],
};
