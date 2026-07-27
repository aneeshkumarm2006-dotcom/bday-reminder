import { ArrowRight } from "lucide-react";
import Link from "next/link";

import {
  Faq,
  FeatureCardBlock,
  FeatureRowBlock,
  GetTheApp,
  HowItWorks,
  ValueProp,
  previewFor,
} from "@/components/marketing/landing-sections";
import { Reveal } from "@/components/reveal";
import { HeroTodayRing } from "@/components/today-rings";
import { buttonVariants } from "@/components/ui/button";
import { jsonLdScript } from "@/lib/blog/url";
import { getAllSeoPageContent } from "@/lib/content/get";
import type { SeoLandingPageDef } from "@/lib/content/seo-pages/types";
import { siteConfig } from "@/lib/site";

/**
 * Renderer for the keyword landing pages (`/birthday-calendar`, `/free`, …).
 *
 * Every section below is either a homepage section component reused verbatim or
 * built from the same exported primitives, so a landing page can never drift
 * from the site's design — only its words differ. The one genuinely new piece
 * is the hero, which takes the product shot(s) each brief asks for instead of
 * the homepage's fixed pair.
 *
 * Two structured-data blocks come out of here: a BreadcrumbList (this page sits
 * one level under the homepage) and the FAQPage emitted by the shared FAQ
 * section, which reads the same items the accordion renders.
 */
export async function SeoLandingPage({ page }: { page: SeoLandingPageDef }) {
  const path = `/${page.slug}`;
  // The cross-link strip names the other five pages, so it has to read their
  // *edited* labels and blurbs — off the hardcoded registry, renaming a page in
  // the admin would leave its five siblings still calling it by the old name.
  // `getAllSeoPageContent` is request-cached, so this is one read per request.
  const siblings = (await getAllSeoPageContent("published")).filter(
    (sibling) => sibling.slug !== page.slug,
  );
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      {
        "@type": "ListItem",
        position: 2,
        name: page.label,
        item: `${siteConfig.url}${path}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumb) }}
      />

      <SeoHero page={page} />

      <ValueProp
        content={{
          id: `${page.slug}-contrast`,
          type: "valueProp",
          visible: true,
          headingParts: page.contrast.headingParts,
          body: page.contrast.body,
        }}
      />

      <SeoFeatures page={page} />

      <HowItWorks
        content={{
          id: `${page.slug}-how`,
          type: "howItWorks",
          visible: true,
          anchor: "how",
          heading: page.howItWorks.heading,
          steps: page.howItWorks.steps,
        }}
      />

      <Faq
        content={{
          id: `${page.slug}-faq`,
          type: "faq",
          visible: true,
          anchor: "faq",
          heading: page.faq.heading,
          sub: page.faq.sub,
          items: page.faq.items,
        }}
      />

      <SeoRelatedPages siblings={siblings} />

      <GetTheApp
        content={{
          id: `${page.slug}-cta`,
          type: "getTheApp",
          visible: true,
          anchor: "get-the-app",
          heading: page.cta.heading,
          body: page.cta.body,
          ctaLabel: page.cta.ctaLabel,
          ctaHref: page.cta.ctaHref,
          storeBadges: true,
          footnote: page.cta.footnote,
        }}
      />
    </>
  );
}

/* ---------------------------------- hero ---------------------------------- */

/**
 * The homepage hero's layout, with the product shots chosen per page — an alarm
 * page leads with the reminder card, a widget-led page with the widget. The
 * second shot is hidden on small screens, exactly as on the homepage, so the
 * fold stays copy-first on a phone.
 */
function SeoHero({ page }: { page: SeoLandingPageDef }) {
  const { hero } = page;
  const [lead, ...rest] = hero.visuals;

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--biro-tint),transparent_70%)] opacity-70"
      />
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-5 pb-8 pt-16 text-center sm:pt-24">
        {hero.badge && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-medium text-ink-secondary transition-colors duration-300 hover:border-biro/40">
            {hero.badge}
          </span>
        )}

        <div className="mt-8">
          <HeroTodayRing size="xl" />
        </div>

        <h1 className="mt-8 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-5xl">
          {hero.heading}
        </h1>
        <p className="mt-5 max-w-2xl text-balance text-lg leading-relaxed text-ink-secondary">
          {hero.subheading}
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          {hero.primaryCta.label && (
            <Link
              href={hero.primaryCta.href}
              className={`${buttonVariants({ size: "lg" })} hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(44,75,216,0.6)]`}
            >
              {hero.primaryCta.label}
            </Link>
          )}
          <Link
            href="#how"
            className={`${buttonVariants({ variant: "secondary", size: "lg" })} hover:-translate-y-0.5`}
          >
            See how it works
          </Link>
        </div>
        {hero.footnote && <p className="mt-4 text-sm text-ink-muted">{hero.footnote}</p>}
      </div>

      <div className="mx-auto w-full max-w-5xl px-5 pb-16 pt-4">
        <Reveal className="flex flex-wrap items-end justify-center gap-6">
          {previewFor(lead)}
          {rest.map((visual) => (
            <div key={visual} className="hidden sm:block sm:max-w-xs">
              {previewFor(visual)}
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------- features -------------------------------- */

/**
 * Same two-tier shape as the homepage: three headline features told beside a
 * product shot, then the rest as cards. The cards keep their brief's bullet
 * points here (the homepage's don't have any) — on a page whose whole job is to
 * answer one query thoroughly, throwing that detail away would be the wrong
 * trade.
 */
function SeoFeatures({ page }: { page: SeoLandingPageDef }) {
  const { features } = page;
  return (
    <section id="features" className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance font-display text-3xl font-semibold tracking-[-0.01em] text-ink">
          {features.heading}
        </h2>
        <p className="mt-4 text-ink-secondary">{features.sub}</p>
      </Reveal>

      {features.rows.length > 0 && (
        <div className="mt-14 flex flex-col gap-20">
          {features.rows.map((row, i) => (
            <FeatureRowBlock key={row.id} row={row} reverse={i % 2 === 1} />
          ))}
        </div>
      )}

      {features.cards.length > 0 && (
        <div className="mt-20 grid gap-4 sm:grid-cols-2">
          {features.cards.map((card, i) => (
            <Reveal key={card.id} delay={i * 0.04} className="h-full [&>div]:h-full">
              <FeatureCardBlock card={card} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------ related pages ----------------------------- */

/**
 * The cluster's internal linking, rendered from the page list rather than
 * hand-maintained: every page links to all five siblings, so link equity flows
 * across the cluster and a new page joins it by existing.
 */
function SeoRelatedPages({ siblings }: { siblings: SeoLandingPageDef[] }) {
  if (siblings.length === 0) return null;

  return (
    <section className="border-y border-border-subtle bg-surface-sunken/60">
      <div className="mx-auto w-full max-w-5xl px-5 py-16">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-ink sm:text-3xl">
            Explore the rest of Birthday Reminders
          </h2>
          <p className="mt-3 text-ink-secondary">
            One app, one free account — here&rsquo;s the same thing from a few other angles.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {siblings.map((page, i) => (
            <Reveal key={page.slug} delay={i * 0.04} className="h-full [&>a]:h-full">
              <Link
                href={`/${page.slug}`}
                className="group flex h-full flex-col rounded-lg border border-border-subtle bg-surface p-5 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-biro/40 hover:shadow-[0_14px_34px_-18px_rgba(44,75,216,0.45)]"
              >
                <span className="font-display text-lg font-semibold text-ink transition-colors duration-300 group-hover:text-biro">
                  {page.label}
                </span>
                <span className="mt-2 flex-1 text-sm leading-relaxed text-ink-secondary">
                  {page.blurb}
                </span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-biro">
                  Take a look
                  <ArrowRight
                    size={15}
                    aria-hidden="true"
                    className="transition-transform duration-300 ease-out group-hover:translate-x-1"
                  />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
