import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Previous / next pagination for the /blog index. */
export function BlogPagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const prevHref = page - 1 <= 1 ? "/blog" : `/blog?page=${page - 1}`;
  const nextHref = `/blog?page=${page + 1}`;

  return (
    <nav
      className="mt-12 flex items-center justify-between gap-4"
      aria-label="Blog pagination"
    >
      {page > 1 ? (
        <Link href={prevHref} className={cn(buttonVariants({ variant: "secondary" }))}>
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-ink-muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={nextHref} className={cn(buttonVariants({ variant: "secondary" }))}>
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
