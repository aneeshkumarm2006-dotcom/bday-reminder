import type { ReactNode } from "react";

/** Standard page heading for the app pages — title + optional action on the right. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.01em] text-ink sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-ink-secondary">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
