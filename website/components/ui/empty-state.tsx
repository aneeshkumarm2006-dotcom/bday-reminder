import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Friendly placeholder when a list is empty (DESIGN.md §10 voice). */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-biro-tint text-biro">
          <Icon size={24} aria-hidden="true" />
        </span>
      )}
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-sm text-ink-secondary">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
