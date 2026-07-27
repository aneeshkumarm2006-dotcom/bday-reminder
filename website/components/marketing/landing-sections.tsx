import { Plus, Smartphone } from "lucide-react";
import Link from "next/link";

import { AppPreview, ReminderPreview, WidgetPreview } from "@/components/app-preview";
import { ContentIcon } from "@/components/content-icon";
import { PostCard } from "@/components/blog/post-card";
import { Reveal } from "@/components/reveal";
import { HeroTodayRing, StepRing } from "@/components/today-rings";
import { buttonVariants } from "@/components/ui/button";
import { isDbConfigured } from "@/lib/blog/db";
import { getPublishedPosts } from "@/lib/blog/posts";
import { jsonLdScript } from "@/lib/blog/url";
import type {
  FaqSection as FaqSectionContent,
  FeaturePreview,
  FeaturesSection as FeaturesSectionContent,
  GetTheAppSection as GetTheAppSectionContent,
  HeroSection as HeroSectionContent,
  HowItWorksSection as HowItWorksSectionContent,
  LandingSection,
  LatestPostsSection as LatestPostsSectionContent,
  ValuePropSection as ValuePropSectionContent,
} from "@/lib/content/types";

/**
 * The landing page's sections as pure, props-driven renderers.
 *
 * Every class name, animation, and layout decision here is exactly what used to
 * live inline in `app/(marketing)/page.tsx` — only the *copy* became data. That
 * split is the whole point of the section-based editor: the SEO team can rewrite
 * or reorder anything and the result is still on-brand, because the design
 * isn't editable, only the words are.
 */

/** Renders an ordered section list, skipping hidden ones. */
export function LandingSections({ sections }: { sections: LandingSection[] }) {
  return (
    <>
      {sections
        .filter((section) => section.visible)
        .map((section) => (
          <LandingSectionRenderer key={section.id} section={section} />
        ))}
    </>
  );
}

function LandingSectionRenderer({ section }: { section: LandingSection }) {
  switch (section.type) {
    case "hero":
      return <Hero content={section} />;
    case "valueProp":
      return <ValueProp content={section} />;
    case "features":
      return <Features content={section} />;
    case "howItWorks":
      return <HowItWorks content={section} />;
    case "latestPosts":
      return <LatestPosts content={section} />;
    case "faq":
      return <Faq content={section} />;
    case "getTheApp":
      return <GetTheApp content={section} />;
    default:
      return null;
  }
}

export function previewFor(preview: FeaturePreview) {
  switch (preview) {
    case "app":
      return <AppPreview />;
    case "reminder":
      return <ReminderPreview />;
    case "widget":
      return <WidgetPreview />;
    default:
      return null;
  }
}

/* --------------------------- feature row & card --------------------------- */

/**
 * The two feature primitives are exported because the keyword landing pages
 * (`components/marketing/seo-landing.tsx`) render the same shapes from their own
 * content type. Structural props rather than the `FeatureRow`/`FeatureCard`
 * content types, so both callers fit without either importing the other's model.
 */
export interface FeatureRowContent {
  icon: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  preview: FeaturePreview;
}

export interface FeatureCardContent {
  icon: string;
  title: string;
  body: string;
  /** Landing cards have none; SEO pages carry the brief's bullets through. */
  points?: string[];
}

/** A feature told at full width, beside its rendered product shot. */
export function FeatureRowBlock({
  row,
  reverse = false,
}: {
  row: FeatureRowContent;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <Reveal className={`group ${reverse ? "lg:order-2" : ""}`}>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-biro-tint text-biro transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110">
          <ContentIcon name={row.icon} />
        </span>
        <p className="mt-4 text-sm font-medium text-biro">{row.eyebrow}</p>
        <h3 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em] text-ink">
          {row.title}
        </h3>
        <p className="mt-3 text-pretty leading-relaxed text-ink-secondary">{row.body}</p>
        <FeaturePoints points={row.points} />
      </Reveal>

      <Reveal delay={0.05} className={`flex justify-center ${reverse ? "lg:order-1" : ""}`}>
        <div className="transition-transform duration-500 ease-out hover:scale-[1.02]">
          {previewFor(row.preview)}
        </div>
      </Reveal>
    </div>
  );
}

/** A supporting feature, in the card grid. */
export function FeatureCardBlock({ card }: { card: FeatureCardContent }) {
  return (
    <div className="group h-full rounded-lg border border-border-subtle bg-surface p-5 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-biro/40 hover:shadow-[0_14px_34px_-18px_rgba(44,75,216,0.45)]">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-biro-tint text-biro transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110">
        <ContentIcon name={card.icon} />
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold text-ink transition-colors duration-300 group-hover:text-biro">
        {card.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{card.body}</p>
      {card.points && card.points.length > 0 && <FeaturePoints points={card.points} compact />}
    </div>
  );
}

/** The biro-dot bullet list, shared by rows and cards. */
export function FeaturePoints({
  points,
  compact = false,
}: {
  points: string[];
  compact?: boolean;
}) {
  if (points.length === 0) return null;
  return (
    <ul className={`flex flex-col ${compact ? "mt-4 gap-2" : "mt-5 gap-2.5"}`}>
      {points.map((point) => (
        <li
          key={point}
          className="flex items-start gap-2.5 text-sm text-ink-secondary transition-colors duration-200 hover:text-ink [&:hover_span]:scale-150"
        >
          <span
            aria-hidden="true"
            className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-biro transition-transform duration-200 ease-out"
          />
          {point}
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------- hero ---------------------------------- */

export function Hero({ content }: { content: HeroSectionContent }) {
  return (
    <section className="relative overflow-hidden">
      {/* A single, quiet biro-tint wash - no second accent (DESIGN.md §1). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--biro-tint),transparent_70%)] opacity-70"
      />
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-5 pb-8 pt-16 text-center sm:pt-24">
        {content.badge && (
          <span className="group inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-medium text-ink-secondary transition-colors duration-300 hover:border-biro/40">
            <ContentIcon
              name="Sparkles"
              size={13}
              className="text-biro transition-transform duration-500 ease-out group-hover:rotate-90 group-hover:scale-110"
            />
            {content.badge}
          </span>
        )}

        <div className="mt-8">
          <HeroTodayRing size="xl" />
        </div>

        <h1 className="mt-8 max-w-2xl font-display text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-6xl">
          {content.heading}
        </h1>
        <p className="mt-5 max-w-xl text-balance text-lg leading-relaxed text-ink-secondary">
          {content.subheading}
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          {content.primaryCta.label && (
            <Link
              href={content.primaryCta.href}
              className={`${buttonVariants({ size: "lg" })} hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(44,75,216,0.6)]`}
            >
              {content.primaryCta.label}
            </Link>
          )}
          {content.secondaryCta.label && (
            <Link
              href={content.secondaryCta.href}
              className={`${buttonVariants({ variant: "secondary", size: "lg" })} hover:-translate-y-0.5`}
            >
              {content.secondaryCta.label}
            </Link>
          )}
        </div>
        {content.footnote && (
          <p className="mt-4 text-sm text-ink-muted">{content.footnote}</p>
        )}
      </div>

      {/* Product shot - rendered from the real design system, light + dark. */}
      <div className="mx-auto w-full max-w-5xl px-5 pb-16 pt-4">
        <Reveal className="flex flex-wrap items-end justify-center gap-6">
          <AppPreview />
          <ReminderPreview className="hidden sm:block sm:max-w-xs" />
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------- value prop ------------------------------ */

export function ValueProp({ content }: { content: ValuePropSectionContent }) {
  const { lead, muted, mid, accent, tail } = content.headingParts;
  return (
    <section className="border-y border-border-subtle bg-surface-sunken/60">
      <div className="mx-auto w-full max-w-3xl px-5 py-16 text-center">
        <Reveal>
          <h2 className="text-balance font-display text-2xl font-semibold leading-snug tracking-[-0.01em] text-ink sm:text-3xl">
            {lead} <span className="text-ink-muted">{muted}</span>
            {mid}
            <br className="hidden sm:block" /> <span className="text-biro">{accent}</span>{" "}
            {tail}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-ink-secondary">
            {content.body}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* --------------------------------- features ------------------------------- */

export function Features({ content }: { content: FeaturesSectionContent }) {
  return (
    <section
      id={content.anchor}
      className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-20"
    >
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-ink">
          {content.heading}
        </h2>
        <p className="mt-4 text-ink-secondary">{content.sub}</p>
      </Reveal>

      {content.rows.length > 0 && (
        <div className="mt-14 flex flex-col gap-20">
          {content.rows.map((row) => (
            <FeatureRowBlock key={row.id} row={row} reverse={row.reverse} />
          ))}
        </div>
      )}

      {content.cards.length > 0 && (
        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {content.cards.map((card) => (
            <Reveal key={card.id}>
              <FeatureCardBlock card={card} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------- how it works ----------------------------- */

export function HowItWorks({ content }: { content: HowItWorksSectionContent }) {
  return (
    <section
      id={content.anchor}
      className="border-y border-border-subtle bg-surface-sunken/60"
    >
      <div className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-ink">
            {content.heading}
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {content.steps.map((step, i) => (
            <Reveal key={step.id} delay={i * 0.05}>
              <div className="group flex flex-col items-center text-center sm:items-start sm:text-left">
                <div className="transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:rotate-3">
                  {/* Offsets are relative to the viewer's today, so the flow always
                      leads up to "today" on the step dated 0. */}
                  <StepRing
                    offset={step.offset}
                    size="lg"
                    state={step.offset === 0 ? "today" : "upcoming"}
                  />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-ink transition-colors duration-300 group-hover:text-biro">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- latest posts ----------------------------- */

export async function LatestPosts({ content }: { content: LatestPostsSectionContent }) {
  // Gracefully absent when the blog DB isn't configured, is unreachable, or has
  // no published posts yet — no empty placeholders on the marketing page.
  if (!isDbConfigured()) return null;
  let posts;
  try {
    ({ posts } = await getPublishedPosts(1, 3));
  } catch {
    return null;
  }
  if (!posts || posts.length === 0) return null;

  return (
    <section
      id={content.anchor}
      className="border-y border-border-subtle bg-surface-sunken/60"
    >
      <div className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-20">
        <Reveal className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-ink">
              {content.heading}
            </h2>
            <p className="mt-3 max-w-xl text-ink-secondary">{content.sub}</p>
          </div>
          {content.ctaLabel && (
            <Link
              href="/blog"
              className={`${buttonVariants({ variant: "secondary" })} shrink-0 self-start hover:-translate-y-0.5 sm:self-auto`}
            >
              {content.ctaLabel}
            </Link>
          )}
        </Reveal>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            // h-full + a child <a> that fills it keeps every card the same height,
            // regardless of how many lines the title wraps to.
            <Reveal key={post.id} delay={i * 0.05} className="h-full [&>a]:h-full">
              <PostCard post={post} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------- faq ---------------------------------- */

export function Faq({ content }: { content: FaqSectionContent }) {
  // Single source of truth: the visible accordion and the FAQPage JSON-LD both
  // read from `content.items`, so they can never drift out of sync.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section
      id={content.anchor}
      className="mx-auto w-full max-w-3xl scroll-mt-20 px-5 py-20"
    >
      {content.items.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd) }}
        />
      )}
      <Reveal className="text-center">
        <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-ink">
          {content.heading}
        </h2>
        <p className="mt-4 text-ink-secondary">{content.sub}</p>
      </Reveal>

      <div className="mt-12 flex flex-col gap-3">
        {content.items.map((item, i) => (
          <Reveal key={item.id} delay={i * 0.03}>
            <details className="group rounded-lg border border-border-subtle bg-surface px-5 transition-colors duration-300 hover:border-biro/40 open:border-biro/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-base font-medium text-ink transition-colors duration-200 group-hover:text-biro [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-biro transition-transform duration-300 ease-out group-open:rotate-45"
                >
                  <Plus size={18} />
                </span>
              </summary>
              <p className="pb-5 text-pretty leading-relaxed text-ink-secondary">
                {item.a}
              </p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------- get the app ----------------------------- */

export function GetTheApp({ content }: { content: GetTheAppSectionContent }) {
  return (
    <section
      id={content.anchor}
      className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-20"
    >
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface px-6 py-14 text-center sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(50%_100%_at_50%_0%,var(--biro-tint),transparent_70%)]"
          />
          <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-ink sm:text-4xl">
            {content.heading}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-ink-secondary">{content.body}</p>

          {content.ctaLabel && (
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={content.ctaHref}
                className={`${buttonVariants({ size: "lg" })} hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(44,75,216,0.6)]`}
              >
                {content.ctaLabel}
              </Link>
            </div>
          )}

          {content.storeBadges && (
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <StoreBadge platform="App Store" />
              <StoreBadge platform="Google Play" />
            </div>
          )}
          {content.footnote && (
            <p className="mt-4 text-xs text-ink-muted">{content.footnote}</p>
          )}
        </div>
      </Reveal>
    </section>
  );
}

/** Store badge placeholders — listings go live with the app. */
function StoreBadge({ platform }: { platform: string }) {
  return (
    <span
      className="inline-flex h-12 cursor-default items-center gap-2.5 rounded-md border border-border-strong bg-surface px-4 text-ink-muted"
      aria-label={`${platform} - coming soon`}
    >
      <Smartphone size={20} aria-hidden="true" />
      <span className="flex flex-col items-start leading-none">
        <span className="text-[10px]">Coming soon to</span>
        <span className="text-sm font-medium text-ink-secondary">{platform}</span>
      </span>
    </span>
  );
}
