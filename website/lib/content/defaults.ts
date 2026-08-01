/**
 * Every piece of copy the admin panel can override, lifted verbatim from the
 * code that used to hardcode it (`app/(marketing)/page.tsx`, `app/layout.tsx`,
 * `lib/site.ts`, `components/site-footer.tsx`, the legal pages).
 *
 * These constants — not the database — are what the public site renders when
 * `MONGODB_URI` is unset, the connection fails, or a field was never filled in.
 * Keeping them typed and complete is what makes the "no DB configured" build
 * pixel-identical to the pre-admin site.
 */
import { siteConfig, navLinks } from "@/lib/site";

import { SEO_LANDING_PAGES } from "./seo-pages";
import type {
  LandingSection,
  LandingVariant,
  LegalDoc,
  LegalDocKey,
  NavigationConfig,
  PageMeta,
  SectionType,
  SiteSettings,
} from "./types";

/** GA4 measurement ID that used to live in `app/layout.tsx`. */
export const DEFAULT_GA_MEASUREMENT_ID = "G-SFK13RXJQR";

/** Google Search Console verification token from `app/layout.tsx`. */
export const DEFAULT_GOOGLE_VERIFICATION =
  "xwM26jsFYgHe7X5juAC2xRjQJxjFQUyNrA0udEjiD74";

export const DEFAULT_SETTINGS: SiteSettings = {
  identity: {
    name: siteConfig.name,
    tagline: siteConfig.tagline,
    description: siteConfig.description,
    contactEmail: siteConfig.contactEmail,
  },
  seo: {
    titleTemplate: `%s · ${siteConfig.name}`,
    defaultTitle: `${siteConfig.name} - ${siteConfig.tagline}`,
    defaultDescription: siteConfig.description,
    keywords: [
      "birthday reminder",
      "birthday app",
      "reminder app",
      "anniversary reminder",
      "shared family calendar",
      "family birthday calendar",
      "SMS birthday reminders",
      "group birthday tracker",
      "never miss a birthday",
    ],
    ogImage: "",
    twitterHandle: "",
    verification: {
      google: DEFAULT_GOOGLE_VERIFICATION,
      bing: "",
      pinterest: "",
    },
    indexingEnabled: true,
  },
  analytics: {
    ga4MeasurementId: DEFAULT_GA_MEASUREMENT_ID,
    gtmContainerId: "",
    metaPixelId: "",
  },
  socials: [],
  announcement: {
    enabled: false,
    text: "",
    linkLabel: "",
    linkHref: "",
    dismissible: true,
    startAt: null,
    endAt: null,
  },
  robotsExtraDisallows: [],
  // On by default: `/llms.txt` is a plain summary of pages that are already
  // public, and crawlers (and SEO audits) expect it to be there rather than 404.
  llmsTxtEnabled: true,
  structuredData: {
    organization: {
      enabled: true,
      name: siteConfig.name,
      legalName: "",
      logoUrl: `${siteConfig.url}/icons/512`,
      description: siteConfig.description,
      email: siteConfig.contactEmail,
    },
    website: {
      enabled: true,
      name: siteConfig.name,
      description: siteConfig.description,
      inLanguage: "en-US",
    },
    softwareApplication: {
      enabled: true,
      name: siteConfig.name,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web browser",
      price: "0",
      priceCurrency: "USD",
      description: siteConfig.description,
    },
  },
};

/* --------------------------------- landing -------------------------------- */

export const DEFAULT_LANDING_SECTIONS: LandingSection[] = [
  {
    id: "hero",
    type: "hero",
    visible: true,
    badge: "Free birthday & event reminders",
    heading: "Remember, and act.",
    subheading:
      "The free way to never miss a birthday and actually do something about it. Store the dates that matter, get reminded in time, and send a greeting in one tap.",
    primaryCta: { label: "Start for free", href: "/signup" },
    secondaryCta: { label: "Log in", href: "/login" },
    footnote: "Free on web, iOS, and Android. No ads, no paid tier.",
  },
  {
    id: "value-prop",
    type: "valueProp",
    visible: true,
    headingParts: {
      lead: "Most apps stop at",
      muted: "remembering",
      mid: ". The point is to",
      accent: "do something",
      tail: "before the moment passes.",
    },
    body: "A reminder that arrives at the right time, in your timezone, with the person's name and age, plus a one-tap way to send the message. That's the whole idea.",
  },
  {
    id: "features",
    type: "features",
    visible: true,
    anchor: "features",
    heading: "Everything you need to never forget",
    sub: "Built around one idea, counting down to a date for someone you care about, and nothing that gets in the way.",
    rows: [
      {
        id: "row-reminders",
        icon: "Bell",
        eyebrow: "Reminders that reach you",
        title: "On every channel, at the right local time",
        body: "Push, email, SMS/WhatsApp, and an in-app feed: pick any combination, globally or per person. Reminders fire at the time you choose in your own timezone, and re-anchor automatically when you travel. Set them days ahead, on the day, or both.",
        points: [
          "Multiple lead times per event (7 days before and on the day)",
          "WhatsApp/SMS with a fair-use cap, then it falls back to push & email",
          "A persistent in-app feed so nothing ever gets lost",
        ],
        preview: "app",
        reverse: false,
      },
      {
        id: "row-greeting",
        icon: "MessageCircle",
        eyebrow: "Act in one tap",
        title: "Send a greeting before the moment passes",
        body: "On the day, if you have their number, the reminder opens your messaging app with a friendly, editable message ready to go. You always review and send it yourself, never auto-sent.",
        points: [
          "Pre-filled, editable template: “Happy birthday, [Name]! 🎉”",
          "Opens your own WhatsApp or SMS, addressed to them",
          "Mark as done or snooze right from the reminder",
        ],
        preview: "reminder",
        reverse: true,
      },
      {
        id: "row-widget",
        icon: "Smartphone",
        eyebrow: "Always in view",
        title: "A home-screen widget for the next 3",
        body: "Keep the next three birthdays and events one glance away. The widget updates itself as the days pass, and tapping a name jumps straight to their profile.",
        points: [
          "Name, date, and days remaining at a glance",
          "Updates on its own, no need to open the app",
          "Tap a person to open their profile",
        ],
        preview: "widget",
        reverse: false,
      },
    ],
    cards: [
      {
        id: "card-lists",
        icon: "Users",
        title: "Shared family lists",
        body: "Track the same birthdays together. Invite family, everyone can add and edit, and each person keeps their own reminder settings.",
      },
      {
        id: "card-calendar",
        icon: "CalendarDays",
        title: "Calendar sync",
        body: "Subscribe to your birthdays in Apple, Google, or Outlook. It stays in sync as you add, edit, and remove people.",
      },
      {
        id: "card-gifts",
        icon: "Gift",
        title: "Gift notes",
        body: "Keep a running list of gift ideas, sizes, and preferences for each person, private to you and your list.",
      },
      {
        id: "card-pets",
        icon: "PawPrint",
        title: "Pets & every event",
        body: "Birthdays, anniversaries, and custom events, for people and pets. Each one reminds you independently.",
      },
      {
        id: "card-dates",
        icon: "CalendarDays",
        title: "Smart dates",
        body: "Year is optional, ages are shown only when known, and Feb 29 is handled the way you choose.",
      },
      {
        id: "card-everywhere",
        icon: "Globe",
        title: "One account, everywhere",
        body: "Web, iOS, and Android: same data, instantly synced. Log in anywhere and pick up where you left off.",
      },
    ],
  },
  {
    id: "how-it-works",
    type: "howItWorks",
    visible: true,
    anchor: "how",
    heading: "Three steps, then you can forget about forgetting",
    steps: [
      {
        id: "step-add",
        offset: -7,
        title: "Add the people who matter",
        body: "Type a name and a date, or import from your contacts or a spreadsheet. Year is optional.",
      },
      {
        id: "step-remind",
        offset: -1,
        title: "Get reminded in time",
        body: "Choose how far ahead and which channels. Reminders arrive at your time, in your timezone.",
      },
      {
        id: "step-greet",
        offset: 0,
        title: "Send a greeting",
        body: "On the day, open your messages with a ready-to-send note, then mark it done.",
      },
    ],
  },
  {
    id: "latest-posts",
    type: "latestPosts",
    visible: true,
    anchor: "blog",
    heading: "Latest from the blog",
    sub: "Notes on remembering people, planning a bit further ahead, and what to do when you've left it too late.",
    ctaLabel: "View all posts",
  },
  {
    id: "faq",
    type: "faq",
    visible: true,
    anchor: "faq",
    heading: "Frequently asked questions",
    sub: "Reminders, shared lists, and what happens on the day itself.",
    items: [
      {
        id: "faq-1",
        q: "What is a birthday reminder app?",
        a: "It's somewhere to keep the dates you'd rather not forget, with something that tells you before each one arrives. Birthday Reminders holds birthdays, anniversaries, pets, and any date you want to name, sends a reminder ahead of time, and on the day opens your messages with a greeting ready to send.",
      },
      {
        id: "faq-2",
        q: "How does a birthday app help me manage birthdays and other occasions?",
        a: "It takes the dates out of your head and puts them somewhere that can reach you. Add people once — or import them from your contacts in a single pass — and every year after that, the reminder comes to you instead of you having to go and check.",
      },
      {
        id: "faq-3",
        q: "What is a shared family calendar for birthdays?",
        a: "One list of the family's dates that everyone can see and add to. It stops the whole thing resting on the one relative who happens to remember everybody, and each person still picks how they'd like to be reminded.",
      },
      {
        id: "faq-4",
        q: "Can I get SMS birthday reminders?",
        a: "Yes, along with WhatsApp, push, email, and an in-app feed. SMS and WhatsApp have a monthly fair-use cap, since every message costs real money to send; past the cap, the reminder still reaches you by push and email.",
      },
      {
        id: "faq-5",
        q: "Can I use it as an anniversary reminder?",
        a: "Yes. Anniversaries, pets, and custom dates behave like birthdays and get their own reminder settings. The one difference is age, which only shows on birthdays.",
      },
      {
        id: "faq-6",
        q: "What is a group birthday tracker?",
        a: "A shared list for a family, a friend group, or a team. Anyone in it can add and edit dates, everyone sees the same list, and reminders go to each member individually rather than to one organizer who then has to tell everyone else.",
      },
      {
        id: "faq-7",
        q: "What should I look for in a birthday reminder app?",
        a: "Three things, really: whether the reminder arrives somewhere you'll actually see it, whether other people can share the list, and what happens when you pass the free contact limit. The rest is detail.",
      },
      {
        id: "faq-8",
        q: "How do I make sure I never miss a birthday again?",
        a: "Get the dates out of your memory and into something that can interrupt you, then set the reminder earlier than feels necessary — a week is usually right, because it leaves time to post something. After that, the only job left is answering the notification.",
      },
    ],
  },
  {
    id: "get-the-app",
    type: "getTheApp",
    visible: true,
    anchor: "get-the-app",
    heading: "Start with the people you don't want to forget",
    body: "Free forever. Use it on the web right now, or get it on your phone for reminders and the home-screen widget.",
    ctaLabel: "Start for free",
    ctaHref: "/signup",
    storeBadges: true,
    footnote: "Mobile apps coming soon.",
  },
];

export const DEFAULT_LANDING: LandingVariant = {
  sections: DEFAULT_LANDING_SECTIONS,
};

/**
 * A complete, copy-free section of each type. Used when the admin adds a
 * section that has no counterpart in the defaults, so every key still exists
 * (deep-merge needs a shape to merge onto).
 */
export const SECTION_TEMPLATES: Record<SectionType, LandingSection> = {
  hero: {
    id: "hero",
    type: "hero",
    visible: true,
    badge: "",
    heading: "",
    subheading: "",
    primaryCta: { label: "", href: "/" },
    secondaryCta: { label: "", href: "/" },
    footnote: "",
  },
  valueProp: {
    id: "value-prop",
    type: "valueProp",
    visible: true,
    headingParts: { lead: "", muted: "", mid: "", accent: "", tail: "" },
    body: "",
  },
  features: {
    id: "features",
    type: "features",
    visible: true,
    anchor: "features",
    heading: "",
    sub: "",
    rows: [],
    cards: [],
  },
  howItWorks: {
    id: "how-it-works",
    type: "howItWorks",
    visible: true,
    anchor: "how",
    heading: "",
    steps: [],
  },
  latestPosts: {
    id: "latest-posts",
    type: "latestPosts",
    visible: true,
    anchor: "blog",
    heading: "",
    sub: "",
    ctaLabel: "",
  },
  faq: {
    id: "faq",
    type: "faq",
    visible: true,
    anchor: "faq",
    heading: "",
    sub: "",
    items: [],
  },
  getTheApp: {
    id: "get-the-app",
    type: "getTheApp",
    visible: true,
    anchor: "get-the-app",
    heading: "",
    body: "",
    ctaLabel: "",
    ctaHref: "/signup",
    storeBadges: false,
    footnote: "",
  },
};

/* ------------------------------- navigation ------------------------------- */

export const DEFAULT_NAV: NavigationConfig = {
  header: {
    links: navLinks.map((link, i) => ({
      id: `header-${i + 1}`,
      label: link.label,
      href: link.href,
      order: i,
      visible: true,
      external: false,
    })),
    ctas: {
      show: true,
      // Empty href renders today's static "Coming soon" chip; set a target and
      // it becomes a real call-to-action button.
      signupLabel: "Coming soon",
      signupHref: "",
      loginLabel: "Log in",
    },
  },
  footer: {
    // One untitled group renders as a flat link row; a second group (or a
    // title) switches the footer to columns — which is what the keyword landing
    // pages need, since the footer is how they're linked from every other page
    // on the site, the homepage included.
    groups: [
      {
        id: "footer-explore",
        title: "Explore",
        links: SEO_LANDING_PAGES.map((page, i) => ({
          id: `f-${page.slug}`,
          label: page.label,
          href: `/${page.slug}`,
          order: i,
          visible: true,
          external: false,
        })),
      },
      {
        id: "footer-main",
        title: "More",
        links: [
          { id: "f-blog", label: "Blog", href: "/blog", order: 0, visible: true, external: false },
          { id: "f-privacy", label: "Privacy", href: "/privacy", order: 1, visible: true, external: false },
          { id: "f-terms", label: "Terms", href: "/terms", order: 2, visible: true, external: false },
          { id: "f-contact", label: "Contact", href: "/contact", order: 3, visible: true, external: false },
        ],
      },
    ],
    tagline: "Free on web, iOS, and Android. No ads, no paid tier.",
    legalLine: "© {year} {name}. Made for people who don't want to forget.",
  },
};

/* -------------------------------- page meta ------------------------------- */

/** A PageMeta with every field empty — the base every override merges onto. */
export function emptyPageMeta(path: string): PageMeta {
  return {
    path,
    title: "",
    description: "",
    keywords: [],
    canonical: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    twitterTitle: "",
    twitterDescription: "",
    noindex: false,
    nofollow: false,
    sitemap: { exclude: false, changeFrequency: "monthly", priority: 0.5 },
    customJsonLd: "",
  };
}

/**
 * Per-route metadata that used to be hardcoded in each page file. The values
 * here are what renders when nothing is set in the admin; a `PageMeta` doc
 * overrides them field by field.
 */
export const DEFAULT_PAGE_META: Record<string, PageMeta> = {
  "/": {
    ...emptyPageMeta("/"),
    title: "Birthday App | App For Birthdays | Birthday Reminders",
    description:
      "Birthday Reminders is the birthday app that sends reminders before the big day simply one of the best birthday apps and app for birthdays around.",
    keywords: [
      "birthday app",
      "birthday apps",
      "app for birthdays",
      "birthday reminders",
    ],
    canonical: "/",
    sitemap: { exclude: false, changeFrequency: "monthly", priority: 1 },
  },
  "/blog": {
    ...emptyPageMeta("/blog"),
    title: "Blog",
    description: `Tips, guides, and product news from ${siteConfig.name}.`,
    canonical: "/blog",
    sitemap: { exclude: false, changeFrequency: "weekly", priority: 0.7 },
  },
  "/privacy": {
    ...emptyPageMeta("/privacy"),
    title: "Privacy",
    description: `How ${siteConfig.name} handles your data. We don't sell it, and you can delete it anytime.`,
    canonical: "/privacy",
    sitemap: { exclude: false, changeFrequency: "yearly", priority: 0.5 },
  },
  "/terms": {
    ...emptyPageMeta("/terms"),
    title: "Terms",
    description: `The terms of using ${siteConfig.name} - a free birthday and event reminder app.`,
    canonical: "/terms",
    sitemap: { exclude: false, changeFrequency: "yearly", priority: 0.5 },
  },
  "/contact": {
    ...emptyPageMeta("/contact"),
    title: "Contact",
    description: `Get in touch with the ${siteConfig.name} team.`,
    canonical: "/contact",
    sitemap: { exclude: false, changeFrequency: "yearly", priority: 0.5 },
  },
  // The keyword landing pages carry their brief's title and description as the
  // default. They're the site's second-most important URLs after the homepage,
  // hence the 0.8 priority; the SEO team can still override any of it.
  ...Object.fromEntries(
    SEO_LANDING_PAGES.map((page) => {
      const path = `/${page.slug}`;
      return [
        path,
        {
          ...emptyPageMeta(path),
          title: page.title,
          description: page.description,
          keywords: [...page.keywords],
          canonical: path,
          sitemap: {
            exclude: false,
            changeFrequency: "monthly" as const,
            priority: 0.8,
          },
        },
      ];
    }),
  ),
};

/* ---------------------------------- legal --------------------------------- */

/**
 * The privacy / terms / contact bodies, converted once from their JSX to the
 * sanitizer-safe HTML subset the Tiptap editor produces.
 */
export const DEFAULT_LEGAL: Record<LegalDocKey, LegalDoc> = {
  privacy: {
    key: "privacy",
    title: "Privacy policy",
    updated: "June 2026",
    intro: `${siteConfig.name} is built to help you remember the people who matter, not to harvest your data. Here's exactly what we store and why.`,
    html: [
      "<p>This is a plain-language summary of how we handle your information. It is a starting template and should be reviewed by a professional before launch.</p>",
      "<h2>What we store</h2>",
      "<ul>",
      "<li><strong>Your account:</strong> your name, email and/or phone number, timezone, and notification preferences, used to sign you in and send reminders.</li>",
      "<li><strong>The people you add:</strong> names, dates, optional photos, relationships, phone numbers, and any notes you write. This is your data; we only use it to power your reminders and your shared lists.</li>",
      "<li><strong>Reminders:</strong> the scheduled and sent reminders generated from your events, so your in-app feed persists.</li>",
      "</ul>",
      "<h2>What we don&rsquo;t do</h2>",
      "<ul>",
      "<li>We don&rsquo;t sell your data or share it with advertisers.</li>",
      "<li>We don&rsquo;t show ads.</li>",
      "<li>We never message the people you track on your behalf. The &ldquo;send greeting&rdquo; action opens <strong>your</strong> messaging app for you to send yourself.</li>",
      "</ul>",
      "<h2>Notifications</h2>",
      "<p>We use third parties to deliver push and email, and (where enabled) SMS/WhatsApp. Those providers process only what&rsquo;s needed to deliver a message. SMS/WhatsApp is capped each month to keep the app free; past the cap, reminders fall back to push and email automatically.</p>",
      "<h2>Your control</h2>",
      "<ul>",
      "<li>You can edit or delete any person, event, or note at any time.</li>",
      "<li>Deleting a person removes their events and pending reminders.</li>",
      "<li>You can leave a shared list, which stops its reminders for you immediately.</li>",
      "<li>You can request deletion of your account and associated data.</li>",
      "</ul>",
      "<h2>Contact</h2>",
      `<p>Questions about privacy? Email <a href="mailto:${siteConfig.contactEmail}">${siteConfig.contactEmail}</a>.</p>`,
    ].join("\n"),
  },
  terms: {
    key: "terms",
    title: "Terms of service",
    updated: "June 2026",
    intro: `The basics of using ${siteConfig.name}. Plain language, no surprises.`,
    html: [
      `<p>This is a starting template and should be reviewed by a professional before launch. By using ${siteConfig.name}, you agree to the following.</p>`,
      "<h2>The service</h2>",
      `<p>${siteConfig.name} helps you store birthdays and events and reminds you about them. It is provided free of charge, with no paid tier at launch. We may add, change, or remove features over time.</p>`,
      "<h2>Your account</h2>",
      "<ul>",
      "<li>You&rsquo;re responsible for keeping your login secure.</li>",
      "<li>You must be old enough to consent to this in your country.</li>",
      "<li>Keep the information you add accurate, and only add details you&rsquo;re allowed to.</li>",
      "</ul>",
      "<h2>Acceptable use</h2>",
      `<p>Use ${siteConfig.name} for its purpose of remembering and acting on the dates that matter to you and your shared lists. Don&rsquo;t use it to harass anyone, to send unsolicited bulk messages, or in any unlawful way.</p>`,
      "<h2>Reminders &amp; messaging</h2>",
      "<p>We make a best effort to deliver reminders on time, but can&rsquo;t guarantee delivery, because networks, devices, and third-party providers can fail. The &ldquo;send greeting&rdquo; action only ever opens your own messaging app; you choose to send.</p>",
      "<h2>No warranty</h2>",
      "<p>The service is provided &ldquo;as is.&rdquo; To the extent permitted by law, we disclaim warranties and aren&rsquo;t liable for missed reminders or indirect damages.</p>",
      "<h2>Contact</h2>",
      `<p>Questions about these terms? Email <a href="mailto:${siteConfig.contactEmail}">${siteConfig.contactEmail}</a>.</p>`,
    ].join("\n"),
  },
  contact: {
    key: "contact",
    title: "Contact",
    updated: "",
    intro:
      "Found a bug, have an idea, or need a hand? We'd love to hear from you.",
    html: [
      `<p>${siteConfig.name} is a small, free project. The fastest way to reach us is email. We read every message.</p>`,
      '<p>For privacy questions, see our <a href="/privacy">privacy policy</a>. For the terms of use, see our <a href="/terms">terms</a>.</p>',
    ].join("\n"),
  },
};
