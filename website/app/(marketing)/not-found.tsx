import Link from "next/link";

import { PageBlocks } from "@/components/marketing/page-blocks";
import { buttonVariants } from "@/components/ui/button";
import { getBuiltInPages } from "@/lib/content/get";

/**
 * Branded 404 for the public site.
 *
 * Redirect resolution and 404 logging happen on the *miss paths* that can reach
 * a database — the `/[slug]` custom-page catch-all and `/blog/[slug]` — because
 * a `not-found` boundary has no access to the requested path. Those two cover
 * where renamed URLs actually live; anything deeper lands here.
 *
 * The copy is admin-managed (/seoteam/built-in). `getBuiltInPages` never throws
 * and falls back to the built-in strings, which matters more here than anywhere
 * else: a 404 page that itself errors is the one failure with nowhere to go.
 */
export default async function MarketingNotFound() {
  const { notFound } = await getBuiltInPages();

  return (
    <>
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 py-24 text-center">
        {notFound.eyebrow && (
          <p className="font-display text-sm font-medium uppercase tracking-wide text-biro">
            {notFound.eyebrow}
          </p>
        )}
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.01em] text-ink sm:text-4xl">
          {notFound.heading}
        </h1>
        <p className="mt-4 max-w-md text-pretty text-ink-secondary">{notFound.body}</p>
        {(notFound.primaryCta.label || notFound.secondaryCta.label) && (
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            {notFound.primaryCta.label && (
              <Link href={notFound.primaryCta.href} className={buttonVariants({ size: "lg" })}>
                {notFound.primaryCta.label}
              </Link>
            )}
            {notFound.secondaryCta.label && (
              <Link
                href={notFound.secondaryCta.href}
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                {notFound.secondaryCta.label}
              </Link>
            )}
          </div>
        )}
      </div>
      <PageBlocks blocks={notFound.blocksAfter} />
    </>
  );
}
