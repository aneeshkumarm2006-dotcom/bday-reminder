import type { SeoLandingPageDef } from "./types";

/**
 * Targets the "anniversary reminder app" cluster — the one query in the set
 * where the searcher isn't asking about birthdays at all. The wedge is that
 * anniversaries are *planning* dates rather than *messaging* dates: a birthday
 * text at 9am still lands, but a wedding anniversary you find out about on the
 * morning is already a failure, because nothing is booked. So every section
 * here argues lead time first and breadth second (weddings, work, adoption
 * days, pets), and leaves countdowns to /birthday-countdown-app.
 *
 * Two claims in the SEO brief didn't match the product when this was written:
 *   - "milestone years called out automatically (10th, 25th, 50th)". Nothing
 *     computed a milestone; `GET /upcoming` nulled the year count for anything
 *     that wasn't a birthday, so a silver wedding read like any other row. The
 *     feature was built to match (`isMilestoneYear` in backend/src/lib/dates.ts,
 *     surfaced as `yearsMarking` + `isMilestone` on the feed and named in the
 *     reminder copy), so `card-milestone` below is now true. If that ever gets
 *     reverted, this card and faq-3 go with it.
 *   - "reminders follow you when you travel" was cut and stays cut.
 *     `User.timezone` is a stored setting shown read-only in Settings; nothing
 *     re-detects it. The honest version — each person is reminded at their own
 *     local hour — is what the rest of the cluster already says.
 */
export const anniversaryReminderAppPage: SeoLandingPageDef = {
  slug: "anniversary-reminder-app",
  label: "Anniversary reminder app",
  blurb:
    "Wedding, dating, and work anniversaries, reminded far enough ahead to plan something.",
  title:
    "Anniversary Reminder App | Never Miss a Wedding Anniversary | Birthday Reminders",
  description:
    "Track wedding, work, and dating anniversaries alongside birthdays. Get reminded days ahead on push, email, SMS, or WhatsApp, then send a greeting in one tap.",
  keywords: [
    "anniversary reminder app",
    "wedding anniversary reminder",
    "anniversary reminder",
    "work anniversary reminder",
    "anniversary tracker app",
  ],
  hero: {
    badge: "Anniversaries, alongside the birthdays",
    heading: "An anniversary reminder app that doesn't stop at “congratulations”",
    subheading:
      "Anniversaries get forgotten for the same reason birthdays do: they live in your head instead of somewhere that can reach you. Put the date in here — next to the birthdays you already keep — and the reminder arrives early enough to actually do something about it.",
    primaryCta: { label: "Start for free", href: "/signup" },
    footnote: "Free on web, iOS, and Android. No ads, no paid tier.",
    visuals: ["app", "reminder"],
  },
  contrast: {
    headingParts: {
      lead: "The problem was never",
      muted: "forgetting the date",
      mid: " — it was finding out",
      accent: "too late",
      tail: "to do anything about it",
    },
    body: "Almost nobody forgets an anniversary in the sense of not knowing it exists. They remember it at eight in the morning, with nothing booked, nothing bought, and a day already full of other things. A week's notice and a notification on the day aren't the same product — one leaves you time to plan, the other just tells you you're behind.",
  },
  features: {
    heading: "Every yearly date, in one list with the birthdays",
    sub: "Add an anniversary the way you'd add a birthday, then decide how much warning you want and where it should reach you.",
    rows: [
      {
        id: "row-every-anniversary",
        icon: "Heart",
        eyebrow: "Not just weddings",
        title: "One list for every kind of anniversary",
        body: "Wedding and dating anniversaries, the day someone started their job, the day the dog came home. Name the date and it behaves the way a birthday does — same list, same reminders, sorted by whichever one is closest.",
        points: [
          "Wedding and dating anniversaries",
          "Work anniversaries and job start dates",
          "Adoption days, for people and pets",
          "Sobriety dates, move-in dates, or any yearly date you name yourself",
          "Milestone years called out on their own (10th, 25th, 50th)",
          "The year is optional — a month and a day are enough",
        ],
        preview: "app",
      },
      {
        id: "row-lead-time",
        icon: "Bell",
        eyebrow: "Enough warning to act on",
        title: "Reminders that arrive while there's still time",
        body: "A wedding anniversary reminder that fires on the morning of the anniversary is barely a reminder — there's nothing left to book and nothing left to order. Set yours a week ahead, the night before, or both, and pick how it reaches you.",
        points: [
          "Push, email, SMS or WhatsApp, or the in-app feed",
          "More than one lead time on the same date, up to a year ahead",
          "Choose the hour it arrives, in your own timezone",
        ],
        preview: "reminder",
      },
      {
        id: "row-widget",
        icon: "Smartphone",
        eyebrow: "One glance away",
        title: "What's coming, on your home screen",
        body: "The next three dates sit on your home screen whether they're birthdays or anniversaries, so the wedding date isn't something you have to go looking for.",
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
        id: "card-greeting",
        icon: "MessageCircle",
        title: "From reminder to greeting, in one tap",
        body: "On the day, the reminder opens your own messaging app with something already written. Read it, change it, send it — or don't.",
        points: [
          "Starts you off with an editable line for the occasion",
          "Opens your own WhatsApp or SMS, addressed to the right person",
          "Mark it done or snooze it straight from the reminder",
        ],
      },
      {
        id: "card-shared",
        icon: "Users",
        title: "Shared anniversaries, shared reminders",
        body: "Some anniversaries belong to more than one person. Invite a partner, a sibling, or the rest of the family to a shared list, and everyone gets their own reminder on their own channel — nobody has to be the one who remembers for everyone else.",
        points: [],
      },
      {
        id: "card-calendar-sync",
        icon: "CalendarDays",
        title: "Syncs with the calendar you already use",
        body: "Subscribe once in Apple Calendar, Google Calendar, or Outlook and every anniversary you add turns up there too, staying current as you edit it. Nothing to re-import each year.",
        points: [],
      },
      {
        id: "card-milestone",
        icon: "Award",
        title: "Milestone years get called out",
        body: "A 25th takes more planning than a 24th. When the year count lands on a five or a zero, the date carries its number — a “25th” beside the name in your list, and “Emma's 25th anniversary” in the reminder itself — so the big one doesn't read like all the others.",
        points: [
          "Works on any date you gave a year to, weddings and birthdays alike",
          "Shows on the feed, the month calendar, and the reminder you're sent",
          "Nothing to switch on — it's counted from the date you already entered",
        ],
      },
    ],
  },
  howItWorks: {
    heading: "Set it up in a few minutes",
    steps: [
      {
        id: "step-add",
        offset: -7,
        title: "Add the date",
        body: "A name, a date, and whether it's an anniversary or something you'd rather name yourself. The year is optional.",
      },
      {
        id: "step-remind",
        offset: -1,
        title: "Choose your reminders",
        body: "How far ahead you want telling, at what hour, and on which channel.",
      },
      {
        id: "step-greet",
        offset: 0,
        title: "Send something on the day",
        body: "The reminder hands you a message that's ready to edit and send.",
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    sub: "How anniversaries work here, and what else you can keep alongside them.",
    items: [
      {
        id: "faq-1",
        q: "Can I use Birthday Reminders as an anniversary reminder app?",
        a: "Yes. Anniversaries work the same way birthdays do — the same reminders, the same lead times, the same one-tap greeting. The only real difference is that a birthday shows the age someone is turning and an anniversary doesn't.",
      },
      {
        id: "faq-2",
        q: "Can it track both birthdays and anniversaries in one place?",
        a: "Yes, that's rather the point. One list holds birthdays, anniversaries, pets, and any other date you add, sorted together by whichever is coming up next.",
      },
      {
        id: "faq-3",
        q: "Does it work for wedding anniversaries specifically?",
        a: "Yes, and the big ones are marked. Add the wedding date with its year and every anniversary that lands on a five or a zero — the 10th, the 25th, the 50th — carries its number in your list and in the reminder, so you notice a milestone coming rather than realizing after the fact.",
      },
      {
        id: "faq-4",
        q: "Can I track work anniversaries too?",
        a: "Yes. Anything on a yearly repeat works the same way, whether it's a wedding, a job start date, or an adoption day.",
      },
      {
        id: "faq-5",
        q: "How far in advance can I set an anniversary reminder?",
        a: "Up to a year ahead, and you can stack more than one lead time on the same date — a week before and the day itself, for example.",
      },
      {
        id: "faq-6",
        q: "Can my partner or family see the same anniversary list?",
        a: "Yes. Share a list and everyone in it can see and add dates, while each person still sets up their own reminders independently.",
      },
      {
        id: "faq-7",
        q: "Is the anniversary reminder feature free?",
        a: "Yes. It's part of the same free account as everything else — no separate tier, and no limit on how many anniversaries you keep.",
      },
    ],
  },
  cta: {
    heading: "Put every anniversary in one place",
    body: "Setting it up takes a few minutes, and it stays free — no trial, no card, and nothing to upgrade to later.",
    ctaLabel: "Start for free",
    ctaHref: "/signup",
    footnote: "Mobile apps coming soon.",
  },
};
