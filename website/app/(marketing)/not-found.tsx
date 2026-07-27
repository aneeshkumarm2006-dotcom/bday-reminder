import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/**
 * Branded 404 for the public site.
 *
 * Redirect resolution and 404 logging happen on the *miss paths* that can reach
 * a database — the `/[slug]` custom-page catch-all and `/blog/[slug]` — because
 * a `not-found` boundary has no access to the requested path. Those two cover
 * where renamed URLs actually live; anything deeper lands here.
 */
export default function MarketingNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 py-24 text-center">
      <p className="font-display text-sm font-medium uppercase tracking-wide text-biro">
        404
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.01em] text-ink sm:text-4xl">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-4 max-w-md text-pretty text-ink-secondary">
        The link may be out of date, or the page may have moved. Here are a few places
        to pick up from.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Back to home
        </Link>
        <Link href="/blog" className={buttonVariants({ variant: "secondary", size: "lg" })}>
          Read the blog
        </Link>
      </div>
    </div>
  );
}
