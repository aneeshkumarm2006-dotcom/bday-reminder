import { Plus } from "lucide-react";
import Link from "next/link";

import { ContentIcon } from "@/components/content-icon";
import { Reveal } from "@/components/reveal";
import { buttonVariants } from "@/components/ui/button";
import { jsonLdScript } from "@/lib/blog/url";
import type {
  ComparisonTableBlock,
  CtaBlock,
  DividerBlock,
  FaqBlock,
  FeatureGridBlock,
  HeroBlock,
  ImageTextBlock,
  PageBlock,
  RichTextBlock,
  StatsBlock,
  TestimonialsBlock,
} from "@/lib/content/types";

/**
 * Renderers for the page builder's blocks.
 *
 * Everything here borrows the landing page's visual language — same section
 * padding, same card treatment, same biro accents — so a page assembled by the
 * SEO team looks like it was designed, not composed. The type → component map
 * at the bottom is also the guard: an unknown block type renders nothing rather
 * than throwing.
 */
export function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  return (
    <>
      {blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </>
  );
}

function BlockRenderer({ block }: { block: PageBlock }) {
  switch (block.type) {
    case "hero":
      return <HeroBlockView block={block} />;
    case "richText":
      return <RichTextBlockView block={block} />;
    case "featureGrid":
      return <FeatureGridBlockView block={block} />;
    case "imageText":
      return <ImageTextBlockView block={block} />;
    case "stats":
      return <StatsBlockView block={block} />;
    case "testimonials":
      return <TestimonialsBlockView block={block} />;
    case "comparisonTable":
      return <ComparisonTableBlockView block={block} />;
    case "faq":
      return <FaqBlockView block={block} />;
    case "cta":
      return <CtaBlockView block={block} />;
    case "divider":
      return <DividerBlockView block={block} />;
    default:
      return null;
  }
}

function HeroBlockView({ block }: { block: HeroBlock }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--biro-tint),transparent_70%)] opacity-70"
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-5 pb-10 pt-16 text-center">
        {block.eyebrow && (
          <p className="text-sm font-medium text-biro">{block.eyebrow}</p>
        )}
        <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-5xl">
          {block.heading}
        </h1>
        {block.body && (
          <p className="mt-5 max-w-xl text-balance text-lg leading-relaxed text-ink-secondary">
            {block.body}
          </p>
        )}
        {(block.primaryCta.label || block.secondaryCta.label) && (
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            {block.primaryCta.label && (
              <Link href={block.primaryCta.href} className={buttonVariants({ size: "lg" })}>
                {block.primaryCta.label}
              </Link>
            )}
            {block.secondaryCta.label && (
              <Link
                href={block.secondaryCta.href}
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                {block.secondaryCta.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function RichTextBlockView({ block }: { block: RichTextBlock }) {
  if (!block.html.trim()) return null;
  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-10">
      {/* Sanitized on write (lib/content/pages.ts → sanitizePostHtml): no
          scripts, no iframes, no inline styles. */}
      <div
        className="flex flex-col gap-6 leading-relaxed text-ink-secondary [&_a]:text-biro [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-2 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-ink [&_img]:rounded-lg [&_li]:ml-1 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-5 [&_strong]:font-medium [&_strong]:text-ink [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: block.html }}
      />
    </section>
  );
}

function FeatureGridBlockView({ block }: { block: FeatureGridBlock }) {
  if (block.items.length === 0 && !block.heading) return null;
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-14">
      {(block.heading || block.sub) && (
        <Reveal className="mx-auto max-w-2xl text-center">
          {block.heading && (
            <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-ink">
              {block.heading}
            </h2>
          )}
          {block.sub && <p className="mt-4 text-ink-secondary">{block.sub}</p>}
        </Reveal>
      )}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {block.items.map((item) => (
            <Reveal key={item.id}>
              <div className="group h-full rounded-lg border border-border-subtle bg-surface p-5 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-biro/40 hover:shadow-[0_14px_34px_-18px_rgba(44,75,216,0.45)]">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-biro-tint text-biro transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110">
                  <ContentIcon name={item.icon} />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-ink transition-colors duration-300 group-hover:text-biro">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{item.body}</p>
              </div>
            </Reveal>
        ))}
      </div>
    </section>
  );
}

function ImageTextBlockView({ block }: { block: ImageTextBlock }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-14">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal className={block.imageSide === "right" ? "lg:order-1" : "lg:order-2"}>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-ink">
            {block.heading}
          </h2>
          <p className="mt-3 text-pretty leading-relaxed text-ink-secondary">{block.body}</p>
          {block.cta.label && (
            <Link
              href={block.cta.href}
              className={`${buttonVariants({ variant: "secondary" })} mt-5`}
            >
              {block.cta.label}
            </Link>
          )}
        </Reveal>
        <Reveal
          delay={0.05}
          className={block.imageSide === "right" ? "lg:order-2" : "lg:order-1"}
        >
          {block.imageUrl ? (
            // Plain <img>: the URL comes from the media library or an arbitrary
            // admin-entered host, which next/image would need allowlisted.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.imageUrl}
              alt={block.imageAlt}
              className="w-full rounded-xl border border-border-subtle bg-surface object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-dashed border-border-subtle text-sm text-ink-muted">
              No image selected
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}

function StatsBlockView({ block }: { block: StatsBlock }) {
  if (block.items.length === 0) return null;
  return (
    <section className="border-y border-border-subtle bg-surface-sunken/60">
      <div className="mx-auto w-full max-w-5xl px-5 py-14">
        {block.heading && (
          <h2 className="text-center font-display text-2xl font-semibold tracking-[-0.01em] text-ink">
            {block.heading}
          </h2>
        )}
        <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {block.items.map((item) => (
            <Reveal key={item.id}>
              <div className="text-center">
                <dt className="sr-only">{item.label}</dt>
                <dd className="font-display text-3xl font-semibold tabular-nums text-biro">
                  {item.value}
                </dd>
                <p className="mt-1 text-sm text-ink-secondary">{item.label}</p>
              </div>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

function TestimonialsBlockView({ block }: { block: TestimonialsBlock }) {
  if (block.items.length === 0) return null;
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-14">
      {block.heading && (
        <h2 className="text-center font-display text-2xl font-semibold tracking-[-0.01em] text-ink">
          {block.heading}
        </h2>
      )}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {block.items.map((item) => (
          <Reveal key={item.id}>
            <figure className="h-full rounded-lg border border-border-subtle bg-surface p-5">
              <blockquote className="text-pretty leading-relaxed text-ink-secondary">
                “{item.quote}”
              </blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-medium text-ink">{item.author}</span>
                {item.role && <span className="text-ink-muted"> · {item.role}</span>}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function ComparisonTableBlockView({ block }: { block: ComparisonTableBlock }) {
  if (block.rows.length === 0) return null;
  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-14">
      {block.heading && (
        <h2 className="mb-6 text-center font-display text-2xl font-semibold tracking-[-0.01em] text-ink">
          {block.heading}
        </h2>
      )}
      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full min-w-[32rem] text-left text-sm">
          {block.columns.length > 0 && (
            <thead className="border-b border-border-subtle bg-surface-sunken text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                {block.columns.map((column, i) => (
                  <th key={`${column}-${i}`} className="px-4 py-2.5 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.id} className="border-b border-border-subtle last:border-0">
                {row.cells.map((cell, i) => (
                  <td
                    key={`${row.id}-${i}`}
                    className={i === 0 ? "px-4 py-3 font-medium text-ink" : "px-4 py-3 text-ink-secondary"}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FaqBlockView({ block }: { block: FaqBlock }) {
  if (block.items.length === 0) return null;
  // One source for the accordion and the FAQPage structured data.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: block.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd) }}
      />
      {(block.heading || block.sub) && (
        <Reveal className="text-center">
          {block.heading && (
            <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-ink">
              {block.heading}
            </h2>
          )}
          {block.sub && <p className="mt-4 text-ink-secondary">{block.sub}</p>}
        </Reveal>
      )}
      <div className="mt-10 flex flex-col gap-3">
        {block.items.map((item, i) => (
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
              <p className="pb-5 text-pretty leading-relaxed text-ink-secondary">{item.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CtaBlockView({ block }: { block: CtaBlock }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-14">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface px-6 py-12 text-center sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(50%_100%_at_50%_0%,var(--biro-tint),transparent_70%)]"
          />
          <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-ink">
            {block.heading}
          </h2>
          {block.body && (
            <p className="mx-auto mt-4 max-w-lg text-ink-secondary">{block.body}</p>
          )}
          {block.cta.label && (
            <Link
              href={block.cta.href}
              className={`${buttonVariants({ size: "lg" })} mt-8 hover:-translate-y-0.5`}
            >
              {block.cta.label}
            </Link>
          )}
          {block.footnote && (
            <p className="mt-4 text-xs text-ink-muted">{block.footnote}</p>
          )}
        </div>
      </Reveal>
    </section>
  );
}

function DividerBlockView({ block }: { block: DividerBlock }) {
  if (!block.label) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5">
        <hr className="border-border-subtle" />
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-3xl items-center gap-4 px-5 py-4">
      <hr className="flex-1 border-border-subtle" />
      <span className="text-xs uppercase tracking-wide text-ink-muted">{block.label}</span>
      <hr className="flex-1 border-border-subtle" />
    </div>
  );
}
