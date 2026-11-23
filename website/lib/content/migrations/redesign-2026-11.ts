/**
 * One-off content migration for the Nov 2026 landing redesign.
 *
 * The redesign changed the built-in defaults, but anything the SEO team already
 * saved in /seoteam is stored in Mongo and wins over those defaults. These pure
 * functions take the *stored* documents and return the updated ones, so the
 * live site picks up the new copy without anyone retyping it.
 *
 * Every function is idempotent (running twice changes nothing the second time)
 * and conservative: it only touches the fields the redesign needs, and leaves
 * anything else an editor wrote alone. `scripts/apply-redesign-content.ts`
 * runs them against the database; the tests pin their behaviour.
 */

type Plain = Record<string, unknown>;

export const APP_STORE_URL = "https://apps.apple.com/us/app/circle-the-date/id6804632200";
export const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.circlethedate.app";
export const CLARITY_PROJECT_ID = "zcll4egsnf";

const isPlain = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

const mentionsComingSoon = (v: unknown) => typeof v === "string" && /coming soon/i.test(v);

/* ------------------------------- site settings ---------------------------- */

/**
 * Turn both store badges on with the live listing URLs, and set the Clarity
 * project unless one is already configured. Labels and eyebrows an editor
 * customised are kept.
 */
export function migrateSiteSettings(doc: Plain): { next: Plain; changes: string[] } {
  const next = clone(doc);
  const changes: string[] = [];

  const stores = isPlain(next.appStores) ? next.appStores : {};
  const want = {
    appStore: { url: APP_STORE_URL, label: "App Store", eyebrow: "Download on the" },
    googlePlay: { url: GOOGLE_PLAY_URL, label: "Google Play", eyebrow: "GET IT ON" },
  } as const;
  for (const key of ["appStore", "googlePlay"] as const) {
    const current = isPlain(stores[key]) ? stores[key] : {};
    const url = typeof current.url === "string" ? current.url.trim() : "";
    if (current.enabled !== true || url === "") {
      stores[key] = {
        ...current,
        enabled: true,
        url: url || want[key].url,
        label: (typeof current.label === "string" && current.label.trim()) || want[key].label,
        eyebrow:
          (typeof current.eyebrow === "string" && current.eyebrow.trim()) || want[key].eyebrow,
      };
      changes.push(`App stores: turned on ${want[key].label} (${url || want[key].url})`);
    }
  }
  next.appStores = stores;

  const analytics = isPlain(next.analytics) ? next.analytics : {};
  if (!(typeof analytics.clarityProjectId === "string" && analytics.clarityProjectId.trim())) {
    analytics.clarityProjectId = CLARITY_PROJECT_ID;
    next.analytics = analytics;
    changes.push(`Analytics: set Microsoft Clarity project ${CLARITY_PROJECT_ID}`);
  }

  return { next, changes };
}

/* -------------------------------- navigation ------------------------------ */

const NAV_ORDER = [
  { href: "/#features", label: "Features" },
  { href: "/#screens", label: "Screenshots" },
  { href: "/#how", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
];

/**
 * Drop the "Coming soon" header link, add Screenshots / FAQ / Blog where
 * missing, and turn the sign-up chip into a real "Get the app" button. Any
 * custom links an editor added are kept, after the standard ones.
 */
export function migrateNavigation(doc: Plain): { next: Plain; changes: string[] } {
  const next = clone(doc);
  const changes: string[] = [];
  const header = isPlain(next.header) ? next.header : {};

  if (Array.isArray(header.links)) {
    const links = (header.links as unknown[]).filter(isPlain);
    const kept = links.filter((link) => {
      const drop = mentionsComingSoon(link.label);
      if (drop) changes.push(`Header nav: removed "${String(link.label)}"`);
      return !drop;
    });

    const byHref = new Map(kept.map((l) => [String(l.href ?? ""), l]));
    const ordered: Plain[] = [];
    for (const [i, want] of NAV_ORDER.entries()) {
      const existing = byHref.get(want.href);
      if (existing) {
        ordered.push(existing);
        byHref.delete(want.href);
      } else {
        ordered.push({
          id: `header-redesign-${i + 1}`,
          label: want.label,
          href: want.href,
          visible: true,
          external: false,
        });
        changes.push(`Header nav: added "${want.label}" (${want.href})`);
      }
    }
    // Editor-added extras stay, after the standard set.
    for (const link of kept) {
      if (byHref.has(String(link.href ?? ""))) ordered.push(link);
    }
    header.links = ordered.map((link, order) => ({ ...link, order }));
  }

  const ctas = isPlain(header.ctas) ? header.ctas : null;
  if (ctas) {
    const href = typeof ctas.signupHref === "string" ? ctas.signupHref.trim() : "";
    if (href === "" || mentionsComingSoon(ctas.signupLabel)) {
      ctas.signupLabel = "Get the app";
      ctas.signupHref = href || "/#get-the-app";
      changes.push('Header button: "Get the app" → /#get-the-app');
    }
  }

  next.header = header;
  return { next, changes };
}

/* --------------------------------- landing -------------------------------- */

export const HERO_COPY = {
  badge: "Free on iPhone, Android & web · No ads",
  heading: "Free birthday reminder app: remember every birthday",
  subheading:
    "Birthday Reminders is the free birthday app that reminds you before every birthday, anniversary and date you'd hate to miss. Remember every birthday and act before it passes: send a greeting in one tap.",
  primaryLabel: "Start free on the web",
  footnote: "Free, no ads, no paid tier.",
  storeLead: "Get our app, Circle the date, free:",
} as const;

export const APP_NAME_FAQ = {
  id: "faq-app-name",
  q: "What's the difference between Birthday Reminders and Circle the date?",
  a: "Birthday Reminders is this website; Circle the date is our app on the App Store and Google Play. It's the same account, the same people and the same reminders, so you can start on one and pick up on the other.",
} as const;

const GET_THE_APP_BODY =
  "Download Circle the date, our free app for iPhone and Android, or use Birthday Reminders on the web right now.";

/** Apply the redesign to one stored section list (published or draft). */
export function migrateLandingSections(sections: unknown[]): {
  next: unknown[];
  changes: string[];
} {
  const changes: string[] = [];
  const next = sections.map((raw) => {
    if (!isPlain(raw)) return raw;
    const section = clone(raw);

    if (section.type === "hero") {
      const primary = isPlain(section.primaryCta) ? section.primaryCta : { href: "/signup" };
      const secondary = isPlain(section.secondaryCta) ? section.secondaryCta : { href: "/login" };
      const before = JSON.stringify(section);
      section.badge = HERO_COPY.badge;
      section.heading = HERO_COPY.heading;
      section.subheading = HERO_COPY.subheading;
      section.primaryCta = { ...primary, label: HERO_COPY.primaryLabel, href: primary.href || "/signup" };
      // The badges now lead; "Log in" is in the header.
      section.secondaryCta = { ...secondary, label: "" };
      section.footnote = HERO_COPY.footnote;
      section.storeLead = HERO_COPY.storeLead;
      section.showAppScreens = true;
      if (JSON.stringify(section) !== before) changes.push("Hero: new heading, badge, copy and store line");
    }

    if (section.type === "faq" && Array.isArray(section.items)) {
      const items = section.items as unknown[];
      const has = items.some((it) => isPlain(it) && (it.id === APP_NAME_FAQ.id || it.q === APP_NAME_FAQ.q));
      if (!has) {
        section.items = [...items, { ...APP_NAME_FAQ }];
        changes.push(`FAQ: added "${APP_NAME_FAQ.q}"`);
      }
    }

    if (section.type === "getTheApp") {
      if (mentionsComingSoon(section.footnote)) {
        section.footnote = "";
        changes.push('Get the app: removed the "coming soon" footnote');
      }
      if (typeof section.body === "string" && /web right now|get it on your phone/i.test(section.body) && section.body !== GET_THE_APP_BODY) {
        section.body = GET_THE_APP_BODY;
        changes.push("Get the app: body now names Circle the date");
      }
      if (section.ctaLabel === "Start for free") {
        section.ctaLabel = "Start free on the web";
        changes.push('Get the app: button reads "Start free on the web"');
      }
      if (section.storeBadges !== true) {
        section.storeBadges = true;
        changes.push("Get the app: store badges on");
      }
    }

    return section;
  });
  return { next, changes };
}

/* -------------------------------- page meta ------------------------------- */

/** Homepage title and description from the 30-day plan, Day 1. */
export const HOME_META = {
  title: "Birthday Reminders: Free Reminder App for iPhone & Android",
  description:
    "Birthday Reminders is a free birthday app for iPhone, Android and web. Get birthday reminders before every birthday and send a greeting in one tap.",
} as const;

/** Replace the homepage's stuffed pipe title and description. Other fields stay. */
export function migrateHomeMeta(doc: Plain): { next: Plain; changes: string[] } {
  const next = clone(doc);
  const changes: string[] = [];
  if (next.title !== HOME_META.title) {
    changes.push(`Homepage title: "${String(next.title ?? "")}" → "${HOME_META.title}"`);
    next.title = HOME_META.title;
  }
  if (next.description !== HOME_META.description) {
    changes.push("Homepage meta description: rewritten (147 characters)");
    next.description = HOME_META.description;
  }
  return { next, changes };
}

/* ------------------------------ keyword pages ----------------------------- */

/** Clear the stale "Mobile apps coming soon." footnote from a keyword page override. */
export function migrateSeoPageContent(content: Plain): { next: Plain; changes: string[] } {
  const next = clone(content);
  const changes: string[] = [];
  for (const key of ["cta", "hero"] as const) {
    const block = next[key];
    if (isPlain(block) && mentionsComingSoon(block.footnote)) {
      block.footnote = "";
      changes.push(`${key === "cta" ? "Closing CTA" : "Hero"}: removed the "coming soon" footnote`);
    }
  }
  return { next, changes };
}
