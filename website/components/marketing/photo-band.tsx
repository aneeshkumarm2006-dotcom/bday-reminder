import { Reveal } from "@/components/reveal";
import type { SitePhoto } from "@/lib/content/types";

/**
 * The one photographic band on a public page.
 *
 * Everything else on this site is drawn — the ring, the product shots, the
 * icons — which keeps the design coherent but leaves Google Images with nothing
 * to index and a long page with nothing to break up the type. This band is the
 * exception: one real photograph of the thing the page is about, captioned, and
 * framed the same way every other card on the site is framed so it still reads
 * as part of the design rather than a stock photo dropped in.
 *
 * Both page models render through here — the homepage's `photo` section and the
 * keyword pages' `photo` band — so the two can't drift.
 *
 * Three details are load-bearing rather than decorative:
 *   - `width`/`height` come from the file itself, so the browser reserves the
 *     box before the bytes arrive. Without them a photo this size shoves the
 *     rest of the page down as it loads, which is a Core Web Vitals (CLS) hit
 *     on every page in the cluster at once.
 *   - `loading="lazy"` because this band is always below the fold (the hero
 *     owns the fold on every page that has one). Lazy-loading an LCP image
 *     would be the wrong trade; lazy-loading this one is free.
 *   - `<figure>`/`<figcaption>`, so the caption is associated with the image
 *     rather than being a loose paragraph that happens to sit under it.
 *
 * A plain `<img>` rather than `next/image` for the same reason as every other
 * admin-supplied image on this site: the URL comes from the media library or an
 * arbitrary host the admin typed, and `next/image` would need each one
 * allowlisted in `next.config`. The uploader already transcodes to WebP and
 * compresses under ~300KB (`lib/blog/cloudinary.ts`), which is the part that
 * actually matters for load time.
 */
export function PhotoBand({
  photo,
  heading,
  sub,
  anchor,
}: {
  photo: SitePhoto;
  heading?: string;
  sub?: string;
  anchor?: string;
}) {
  if (!photo.imageUrl) return null;

  // 0 means "unknown" (an image picked before the editor could measure it, or a
  // hand-typed URL). Emitting `width={0}` would collapse the box, so in that
  // case the attributes come off entirely and we're back to the old behaviour.
  const sized = photo.width > 0 && photo.height > 0;

  return (
    <section
      id={anchor || undefined}
      className={`mx-auto w-full max-w-5xl px-5 py-16 ${anchor ? "scroll-mt-20" : ""}`}
    >
      {(heading || sub) && (
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          {heading && (
            <h2 className="text-balance font-display text-3xl font-semibold tracking-[-0.01em] text-ink">
              {heading}
            </h2>
          )}
          {sub && <p className="mt-4 text-ink-secondary">{sub}</p>}
        </Reveal>
      )}

      <Reveal>
        {/* Narrower than the sections around it, and never cropped. At the full
            5xl column a 3:2 photo is ~700px tall — it stops being a beat in the
            page and becomes a second hero. And a fixed aspect ratio was the
            other tempting fix: it would wreck the two pages whose photo is a
            *document* (the printable tracker, the wall calendars), where a crop
            cuts off the months the image exists to show. */}
        <figure className="m-0 mx-auto max-w-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.imageUrl}
            alt={photo.imageAlt}
            {...(sized ? { width: photo.width, height: photo.height } : {})}
            loading="lazy"
            decoding="async"
            className="h-auto w-full rounded-xl border border-border-subtle bg-surface-sunken shadow-[0_18px_40px_-30px_rgba(15,23,42,0.45)]"
          />
          {photo.caption && (
            <figcaption className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-ink-muted">
              {photo.caption}
            </figcaption>
          )}
        </figure>
      </Reveal>
    </section>
  );
}
