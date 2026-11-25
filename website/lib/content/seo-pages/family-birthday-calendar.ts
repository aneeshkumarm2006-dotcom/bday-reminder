import type { PageBlock } from "../types";
import { DEFAULT_SEO_SECTION_ORDER, type SeoLandingPageSource, type SeoLayoutBlocksItem } from "./types";

/**
 * 30-day plan, Day 3: an H2 that answers "family birthdays list in order by
 * month", with a January to December example table and a few tips. It sits
 * right under the hero. Exported so the build step can put the same group into
 * a layout saved in /seoteam.
 */
export const FAMILY_MONTH_LIST_GROUP_ID = "group-family-month-list";
export const FAMILY_MONTH_LIST_HEADING = "How to make a family birthdays list in order by month";

export const FAMILY_MONTH_TABLE: Extract<PageBlock, { type: "comparisonTable" }> = {
  id: "block-family-month-table",
  type: "comparisonTable",
  heading: "",
  columns: ["Month", "Who", "Date", "Turning"],
  rows: [
    ["January", "Grandma Rose", "Jan 14", "78"],
    ["February", "Leo, nephew", "Feb 29", "9 (party on Feb 28)"],
    ["March", "Mom", "Mar 3", "54"],
    ["April", "Uncle Dev", "Apr 21", "49"],
    ["May", "Priya, sister", "May 8", "23"],
    ["June", "Dad", "Jun 17", "57"],
    ["July", "Sam and Alex, twins", "Jul 2", "12"],
    ["August", "Aunt Mei", "Aug 30", "45"],
    ["September", "Grandpa Joe", "Sep 9", "81"],
    ["October", "Biscuit, the dog", "Oct 11", "4"],
    ["November", "Cousin Nora", "Nov 25", "31"],
    ["December", "Cousin Ben", "Dec 19", "16"],
  ].map((cells) => ({ id: `row-${cells[0].toLowerCase()}`, cells })),
};

export const FAMILY_MONTH_TIPS: Extract<PageBlock, { type: "richText" }> = {
  id: "block-family-month-tips",
  type: "richText",
  html: "<p>A few things that help: write down the birth year whenever you know it, so ages fill in on their own. Put a Feb 29 birthday on the day the person actually celebrates. And add the pets and the anniversaries too, because those are the dates people forget first.</p>",
};

export const FAMILY_MONTH_LIST_GROUP: SeoLayoutBlocksItem = {
  id: FAMILY_MONTH_LIST_GROUP_ID,
  kind: "blocks",
  visible: true,
  heading: FAMILY_MONTH_LIST_HEADING,
  sub: "Go month by month, January to December, and put each person under the month of their birthday. If you know the birth year, add the age they're turning. Here's what one family's list looks like.",
  background: "none",
  blocks: [FAMILY_MONTH_TABLE, FAMILY_MONTH_TIPS],
};

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
export const familyBirthdayCalendarPage: SeoLandingPageSource = {
  slug: "family-birthday-calendar",
  label: "Family birthday calendar",
  blurb:
    "Invite relatives, everyone adds dates, and each person gets their own reminders.",
  title: "Family Birthday Calendar & List: Shared Birthday Reminders",
  description:
    "A free family birthday calendar everyone can add to. Keep a shared family birthdays list, sorted by month, and get a reminder before each birthday.",
  keywords: [
    "family birthday calendar",
    "family birthdays list",
    "my family birthdays list",
    "family birthdays list in order by month",
    "birthday family calendar",
  ],
  layout: DEFAULT_SEO_SECTION_ORDER.filter((section) => section !== "download").flatMap((section) => {
    const slot = { id: `slot-${section}`, kind: "section" as const, section, visible: true };
    return section === "hero" ? [slot, FAMILY_MONTH_LIST_GROUP] : [slot];
  }),
  hero: {
    badge: "Shared family birthday calendar",
    heading: "Family birthday calendar and birthdays list",
    subheading:
      "A family birthday calendar works best when everyone can add to it. Put your whole family birthdays list in one place, and anyone who wants a reminder gets one before each birthday, so keeping track stops being one person's job.",
    primaryCta: { label: "Start free on the web", href: "/signup" },
    footnote: "Free on web, iOS, and Android. No ads, no paid tier.",
    visuals: ["app"],
  },
  photo: {
    imageUrl:
      "https://res.cloudinary.com/de26l2h0a/image/upload/v1789056773/circlethedate-blog/family-birthday-calendar-june-wall-calendar.webp",
    imageAlt:
      "A family birthday calendar for June with “Happy Birthday” written on the 9th, framed by party hats, gifts and confetti",
    caption:
      "The family calendar everyone can see — and, unlike this one, everyone can write to from wherever they are.",
    width: 2000,
    height: 1333,
  },
  contrast: {
    headingParts: {
      lead: "A",
      muted: "wall board",
      mid: " only works if someone",
      accent: "remembers",
      tail: "to update it",
    },
    body: "The wooden board with everyone's name on it looks lovely, and it's accurate for about a year. Then a baby arrives, a cousin marries, someone moves out, and nobody wants to be the one to repaint it. A shared calendar takes the updating off one person and puts the reminder in everyone's pocket, which is the part hanging on a wall was never going to do.",
  },
  features: {
    heading: "Shared, current, and it tells people",
    sub: "One list the whole family writes to, and reminders that reach each relative the way they'd rather be reached.",
    rows: [
      {
        id: "row-shared-list",
        icon: "Users",
        eyebrow: "Everyone keeps it current",
        title: "A calendar the whole family can edit",
        body: "Invite your relatives and anyone can add a birthday, an anniversary, or the new grandchild nobody's put in yet. It stops being one person's spreadsheet.",
        points: [
          "Anyone you invite can add and edit",
          "Everyone sees the same list, updated as it changes",
          "Each person keeps their own reminder settings",
        ],
        preview: "app",
      },
      {
        id: "row-reminders",
        icon: "Bell",
        eyebrow: "Each person, their way",
        title: "Everyone gets reminded their own way",
        body: "Your brother wants a text. Your mother reads email. You want it on your phone a week early so there's time to post something. Same calendar, different settings, nobody checking a board in someone else's hallway.",
        points: [
          "Push, email, SMS or WhatsApp, or the in-app feed",
          "More than one lead time per person",
          "Each relative gets it at their own local hour",
        ],
        preview: "reminder",
      },
      {
        id: "row-widget",
        icon: "Smartphone",
        eyebrow: "One glance away",
        title: "The next three, on your home screen",
        body: "Who's next in the family, on your home screen, without opening anything.",
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
        id: "card-every-date",
        icon: "Layers",
        title: "Every kind of family date",
        body: "Grandparents, cousins, in-laws, the dog, your parents' anniversary, the day your sister started her business. All of it fits in the same calendar, sorted by whichever comes next.",
        points: [
          "Birthdays, anniversaries, pets, and any date you name",
          "Sorted by whichever date is closest",
          "Ages filled in where you know the birth year",
        ],
      },
      {
        id: "card-greeting",
        icon: "MessageCircle",
        title: "From reminder to greeting",
        body: "When a family birthday comes up, the reminder opens your own messaging app with a line already typed. Change it or send it as is.",
        points: [
          "Starts you off with “Happy birthday, [Name]! 🎉”",
          "It's your thumb on send — nothing goes out on its own",
          "Snooze it or mark it done from the reminder",
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
        body: "Sizes, the thing they mentioned wanting, what they were given last year so two of you don't buy it again. Visible to you and to whoever shares the list.",
        points: [],
      },
      {
        id: "card-calendar-sync",
        icon: "CalendarDays",
        title: "Syncs to the calendar you already use",
        body: "Subscribe to the family calendar in Apple, Google, or Outlook, and it keeps up as relatives add and edit dates.",
        points: [],
      },
    ],
  },
  howItWorks: {
    heading: "Three steps to a calendar nobody has to maintain alone",
    steps: [
      {
        id: "step-invite",
        offset: -7,
        title: "Invite the family",
        body: "Add the dates you know, then invite relatives to fill in their side of the family.",
      },
      {
        id: "step-remind",
        offset: -1,
        title: "Everyone picks their own reminders",
        body: "Each person chooses their channel and how far ahead they want telling.",
      },
      {
        id: "step-greet",
        offset: 0,
        title: "Someone always remembers",
        body: "On the day, anyone can open a ready-to-send note and mark it done.",
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    sub: "How a shared family birthday calendar works, and what it can hold.",
    items: [
      {
        id: "faq-1",
        q: "What is a family birthday calendar?",
        a: "It's one calendar of the family's birthdays and anniversaries that everyone can see and add to, instead of the dates living in one relative's memory or on a board in one house.",
      },
      {
        id: "faq-2",
        q: "Can multiple family members add birthdays to the same calendar?",
        a: "Yes, that's the point of it. Invite whoever you like and everyone can add or correct dates — there's no view-only tier where one person has to approve the rest.",
      },
      {
        id: "faq-3",
        q: "Does everyone in the family get their own reminders?",
        a: "Yes. Each person sets their own channel — push, email, SMS, or WhatsApp — and their own lead time, so nobody is stuck with someone else's preferences.",
      },
      {
        id: "faq-4",
        q: "Can a family birthday calendar include pets and anniversaries, not just birthdays?",
        a: "Yes. Anniversaries, pets, and any other family date, each with its own reminders.",
      },
      {
        id: "faq-5",
        q: "Is there a physical or printable version of a family birthday calendar?",
        a: "This one is digital, so it stays current without anyone rewriting it — but it does sync to Apple, Google, and Outlook, so it can sit alongside whatever you already have on the fridge. If you specifically want paper, we give away a printable birthday tracker too.",
      },
      {
        id: "faq-6",
        q: "Is Birthday Reminders free to use as a family birthday calendar?",
        a: "Yes. Free on web, iOS, and Android, with no ads, no paid tier, and no charge per family member you invite.",
      },
      {
        id: "faq-month-order",
        q: "How do I make a family birthdays list in order by month?",
        a: "Write the months January to December, then put each person under the month of their birthday, earliest date first. Add the year if you know it, so you can see the age they're turning. In Birthday Reminders the list sorts itself by the next birthday, and everyone in the family can add to it.",
      },
    ],
  },
  cta: {
    heading: "Get the whole family onto one calendar",
    body: "Add the dates you know, invite the family, and let everyone else fill in the gaps you were never going to remember.",
    ctaLabel: "Start free on the web",
    ctaHref: "/signup",
    footnote: "",
  },
};
