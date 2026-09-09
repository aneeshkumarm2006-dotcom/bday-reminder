import { Check, Plus } from "lucide-react";
import Link from "next/link";

import { ContentIcon } from "@/components/content-icon";
import { Reveal } from "@/components/reveal";
import { buttonVariants } from "@/components/ui/button";
import { resolveVideo } from "@/lib/content/embed";
import type {
  BannerBlock,
  BlockBackground,
  BlockWidth,
  ButtonsBlock,
  ComparisonTableBlock,
  CtaBlock,
  DividerBlock,
  FaqBlock,
  FeatureGridBlock,
  GalleryBlock,
  HeroBlock,
  HtmlBlock,
  ImageBlock,
  ImageTextBlock,
  LogosBlock,
  PageBlock,
  PricingBlock,
  QuoteBlock,
  RichTextBlock,
  SpacerBlock,
  StatsBlock,
  StepsBlock,
  TestimonialsBlock,
  VideoBlock,
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
    case "image":
      return <ImageBlockView block={block} />;
    case "gallery":
      return <GalleryBlockView block={block} />;
    case "html":
      return <HtmlBlockView block={block} />;
    case "video":
      return <VideoBlockView block={block} />;
    case "buttons":
      return <ButtonsBlockView block={block} />;
    case "spacer":
      return <SpacerBlockView block={block} />;
    case "logos":
      return <LogosBlockView block={block} />;
    case "steps":
      return <StepsBlockView block={block} />;
    case "pricing":
      return <PricingBlockView block={block} />;
    case "quote":
      return <QuoteBlockView block={block} />;
    case "banner":
      return <BannerBlockView block={block} />;
    default:
      return null;
  }
}

/* --------------------------------- helpers -------------------------------- */

/**
 * The three column widths a block may claim. `full` still keeps the page's
 * horizontal padding — a truly edge-to-edge block would collide with the
 * header's own gutter on a phone.
 */
export function widthClass(width: BlockWidth): string {
  switch (width) {
    case "narrow":
      return "max-w-2xl";
    case "full":
      return "max-w-none";
    default:
      return "max-w-5xl";
  }
}

/** The band a block paints behind itself, matching the landing page's sections. */
function backgroundClass(background: BlockBackground): string {
  switch (background) {
    case "sunken":
      return "border-y border-border-subtle bg-surface-sunken/60";
    case "tint":
      return "border-y border-border-subtle bg-biro-tint/50";
    default:
      return "";
  }
}

/** Prose styling shared by the rich-text and HTML blocks. */
const PROSE_CLASS =
  "flex flex-col gap-6 leading-relaxed text-ink-secondary [&_a]:text-biro [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mt-2 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-ink [&_h4]:font-display [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:text-ink [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:rounded-lg [&_img]:rounded-lg [&_li]:ml-1 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-surface-sunken [&_pre]:p-4 [&_strong]:font-medium [&_strong]:text-ink [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border-subtle [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border-subtle [&_th]:bg-surface-sunken [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5";

/** A section heading + sub pair, rendered only when there is something to say. */
function BlockHeading({ heading, sub }: { heading: string; sub?: string }) {
  if (!heading && !sub) return null;
  return (
    <Reveal className="mx-auto mb-10 max-w-2xl text-center">
      {heading && (
        <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-ink">
          {heading}
        </h2>
      )}
      {sub && <p className="mt-4 text-ink-secondary">{sub}</p>}
    </Reveal>
  );
}

/**
 * Wraps a child in a link when one is set, and returns it untouched otherwise —
 * so an image or a logo is only clickable when the editor gave it a target.
 */
function MaybeLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (!href.trim()) return <>{children}</>;
  const external = /^https?:\/\//i.test(href);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
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

/**
 * Renders the accordion only. The FAQPage markup is built once per page from
 * every faq block, up in the route — emitting it here gave a page with two faq
 * blocks two FAQPage nodes, which describes two pages that don't exist.
 */
function FaqBlockView({ block }: { block: FaqBlock }) {
  if (block.items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-14">
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

/* ------------------------ media, embed and layout ------------------------- */

function ImageBlockView({ block }: { block: ImageBlock }) {
  if (!block.imageUrl) return null;
  return (
    <section className={`mx-auto w-full px-5 py-10 ${widthClass(block.width)}`}>
      <Reveal>
        <figure className="m-0">
          <MaybeLink href={block.href} className="block">
            {/* Plain <img> throughout these blocks: the URL comes from the media
                library or an arbitrary admin-entered host, and next/image would
                need every one of those allowlisted in next.config. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={block.imageUrl}
              alt={block.imageAlt}
              className={`w-full border border-border-subtle bg-surface object-cover ${
                block.rounded ? "rounded-xl" : ""
              }`}
            />
          </MaybeLink>
          {block.caption && (
            <figcaption className="mt-3 text-center text-sm text-ink-muted">
              {block.caption}
            </figcaption>
          )}
        </figure>
      </Reveal>
    </section>
  );
}

function GalleryBlockView({ block }: { block: GalleryBlock }) {
  const items = block.items.filter((item) => item.imageUrl);
  if (items.length === 0) return null;
  const columns =
    block.columns === 2
      ? "sm:grid-cols-2"
      : block.columns === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-14">
      <BlockHeading heading={block.heading} sub={block.sub} />
      <div className={`grid gap-4 ${columns}`}>
        {items.map((item, i) => (
          <Reveal key={item.id} delay={i * 0.04}>
            <figure className="m-0">
              <MaybeLink href={item.href} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.imageAlt}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-lg border border-border-subtle bg-surface-sunken object-cover transition-transform duration-300 ease-out hover:scale-[1.02]"
                />
              </MaybeLink>
              {item.caption && (
                <figcaption className="mt-2 text-sm text-ink-muted">{item.caption}</figcaption>
              )}
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/**
 * The "anything else" block.
 *
 * The markup was sanitized on write by `sanitizeEmbedHtml` — no scripts, no
 * event handlers, iframes only from the embed allow-list — so this can render
 * it directly. The prose classes give unstyled tags the site's typography
 * without overriding anything the author set themselves.
 */
function HtmlBlockView({ block }: { block: HtmlBlock }) {
  if (!block.html.trim()) return null;
  const body = (
    <div className={`mx-auto w-full px-5 py-10 ${widthClass(block.width)}`}>
      <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: block.html }} />
    </div>
  );
  const band = backgroundClass(block.background);
  return band ? <section className={band}>{body}</section> : <section>{body}</section>;
}

function VideoBlockView({ block }: { block: VideoBlock }) {
  const video = resolveVideo(block.url);
  if (!video) return null;

  return (
    <section className={`mx-auto w-full px-5 py-12 ${widthClass(block.width)}`}>
      <BlockHeading heading={block.heading} />
      <Reveal>
        <figure className="m-0 overflow-hidden rounded-xl border border-border-subtle bg-surface-sunken">
          {video.kind === "iframe" ? (
            <iframe
              src={video.src}
              title={video.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="aspect-video w-full border-0"
            />
          ) : (
            <video
              src={video.src}
              poster={block.posterUrl || undefined}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full bg-black"
            />
          )}
        </figure>
      </Reveal>
      {block.caption && (
        <p className="mt-3 text-center text-sm text-ink-muted">{block.caption}</p>
      )}
    </section>
  );
}

function ButtonsBlockView({ block }: { block: ButtonsBlock }) {
  const items = block.items.filter((item) => item.label.trim());
  if (items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-10">
      {block.heading && (
        <h2
          className={`mb-6 font-display text-2xl font-semibold tracking-[-0.01em] text-ink ${
            block.align === "center" ? "text-center" : ""
          }`}
        >
          {block.heading}
        </h2>
      )}
      <div
        className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap ${
          block.align === "center" ? "sm:justify-center" : ""
        }`}
      >
        {items.map((item) => {
          const className = `${buttonVariants({
            variant: item.variant,
            size: "lg",
          })} hover:-translate-y-0.5`;
          return item.external ? (
            <a
              key={item.id}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              {item.label}
            </a>
          ) : (
            <Link key={item.id} href={item.href} className={className}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SpacerBlockView({ block }: { block: SpacerBlock }) {
  const height = { sm: "h-6", md: "h-12", lg: "h-20", xl: "h-32" }[block.size];
  if (!block.rule) return <div aria-hidden="true" className={height} />;
  return (
    <div className={`mx-auto flex w-full max-w-3xl items-center px-5 ${height}`}>
      <hr className="w-full border-border-subtle" />
    </div>
  );
}

function LogosBlockView({ block }: { block: LogosBlock }) {
  const items = block.items.filter((item) => item.imageUrl);
  if (items.length === 0) return null;

  return (
    <section className="border-y border-border-subtle bg-surface-sunken/60">
      <div className="mx-auto w-full max-w-5xl px-5 py-12">
        {block.heading && (
          <p className="mb-8 text-center text-sm font-medium uppercase tracking-wide text-ink-muted">
            {block.heading}
          </p>
        )}
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {items.map((item) => (
            <li key={item.id}>
              <MaybeLink href={item.href} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.imageAlt}
                  loading="lazy"
                  className={`h-8 w-auto object-contain transition-opacity duration-300 ${
                    block.grayscale
                      ? "opacity-70 grayscale hover:opacity-100 hover:grayscale-0"
                      : ""
                  }`}
                />
              </MaybeLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function StepsBlockView({ block }: { block: StepsBlock }) {
  if (block.items.length === 0) return null;
  const columns = block.items.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3";

  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-14">
      <BlockHeading heading={block.heading} sub={block.sub} />
      <ol className={`grid list-none gap-8 ${columns}`}>
        {block.items.map((item, i) => (
          <Reveal key={item.id} delay={i * 0.05}>
            <li className="group flex flex-col">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-biro-tint font-display text-base font-semibold text-biro transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110">
                {block.numbered ? i + 1 : <ContentIcon name={item.icon} />}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-ink transition-colors duration-300 group-hover:text-biro">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{item.body}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

function PricingBlockView({ block }: { block: PricingBlock }) {
  if (block.tiers.length === 0) return null;
  const columns =
    block.tiers.length === 1
      ? "mx-auto max-w-md"
      : block.tiers.length === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-14">
      <BlockHeading heading={block.heading} sub={block.sub} />
      <div className={`grid gap-5 ${columns}`}>
        {block.tiers.map((tier, i) => (
          <Reveal key={tier.id} delay={i * 0.05} className="h-full [&>div]:h-full">
            <div
              className={`flex h-full flex-col rounded-xl border bg-surface p-6 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 ${
                tier.highlight
                  ? "border-biro shadow-[0_18px_40px_-24px_rgba(44,75,216,0.5)]"
                  : "border-border-subtle"
              }`}
            >
              <p className="font-display text-sm font-semibold uppercase tracking-wide text-biro">
                {tier.name}
              </p>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-4xl font-semibold tabular-nums text-ink">
                  {tier.price}
                </span>
                {tier.period && <span className="text-sm text-ink-muted">{tier.period}</span>}
              </p>
              {tier.body && (
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{tier.body}</p>
              )}
              {tier.features.length > 0 && (
                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-ink-secondary"
                    >
                      <Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-biro" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
              {tier.cta.label && (
                <Link
                  href={tier.cta.href}
                  className={`${buttonVariants({
                    variant: tier.highlight ? "primary" : "secondary",
                  })} mt-6 w-full`}
                >
                  {tier.cta.label}
                </Link>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function QuoteBlockView({ block }: { block: QuoteBlock }) {
  if (!block.quote.trim()) return null;
  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-14">
      <Reveal>
        <figure className="m-0 text-center">
          {block.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.imageUrl}
              alt={block.author}
              className="mx-auto mb-6 h-16 w-16 rounded-full border border-border-subtle object-cover"
            />
          )}
          <blockquote className="text-balance font-display text-2xl font-medium leading-snug tracking-[-0.01em] text-ink sm:text-3xl">
            &ldquo;{block.quote}&rdquo;
          </blockquote>
          {(block.author || block.role) && (
            <figcaption className="mt-5 text-sm text-ink-muted">
              {block.author && <span className="font-medium text-ink">{block.author}</span>}
              {block.author && block.role ? " · " : ""}
              {block.role}
            </figcaption>
          )}
        </figure>
      </Reveal>
    </section>
  );
}

const BANNER_TONES: Record<BannerBlock["tone"], string> = {
  info: "border-biro/30 bg-biro-tint text-biro",
  success: "border-ok-fg/30 bg-ok-bg text-ok-fg",
  warning: "border-warn-fg/30 bg-warn-bg text-warn-fg",
  danger: "border-danger-fg/30 bg-danger-bg text-danger-fg",
};

function BannerBlockView({ block }: { block: BannerBlock }) {
  if (!block.heading && !block.body) return null;
  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-8">
      <Reveal>
        <div
          className={`flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-start ${BANNER_TONES[block.tone]}`}
        >
          <span className="shrink-0" aria-hidden="true">
            <ContentIcon name={block.icon} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            {block.heading && (
              <p className="font-display text-lg font-semibold">{block.heading}</p>
            )}
            {block.body && (
              <p className="mt-1 text-pretty leading-relaxed text-ink-secondary">{block.body}</p>
            )}
          </div>
          {block.cta.label && (
            <Link
              href={block.cta.href}
              className={`${buttonVariants({ variant: "secondary", size: "sm" })} shrink-0 self-start`}
            >
              {block.cta.label}
            </Link>
          )}
        </div>
      </Reveal>
    </section>
  );
}
