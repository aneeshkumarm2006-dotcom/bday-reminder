"use client";

import { Calendar, FileText, Globe } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Label } from "@/components/ui/input";
import type { Visibility } from "@/lib/blog/visibility";
import { cn } from "@/lib/utils";

const HOUR_MS = 60 * 60 * 1000;

// Hydration-safe "did we mount on the client yet" without a setState-in-effect:
// server snapshot is false, client snapshot is true.
const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** Format an ISO date as a `datetime-local` value in the viewer's local zone. */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

const OPTIONS: {
  key: Visibility;
  label: string;
  hint: string;
  icon: typeof Globe;
}[] = [
  { key: "draft", label: "Draft", hint: "Hidden from the public blog.", icon: FileText },
  { key: "visible", label: "Visible", hint: "Live on the blog right now.", icon: Globe },
  { key: "scheduled", label: "Scheduled", hint: "Publishes automatically at a set time.", icon: Calendar },
];

/**
 * Shopify-style visibility control. Draft / Visible / Scheduled map to the
 * post's `status` + `publishedAt` (a future date = scheduled). All `new Date()`
 * and local-time formatting sit behind a `mounted` guard so the server-rendered
 * HTML and the first client render match (browser vs server timezone differ).
 */
export function VisibilityCard({
  visibility,
  onVisibilityChange,
  publishedAt,
  onPublishedAtChange,
}: {
  visibility: Visibility;
  onVisibilityChange: (v: Visibility) => void;
  publishedAt: string; // ISO or ""
  onPublishedAtChange: (iso: string) => void;
}) {
  const mounted = useSyncExternalStore(
    subscribeNoop,
    getClientSnapshot,
    getServerSnapshot,
  );

  const select = (next: Visibility) => {
    const nowMs = new Date().getTime();
    if (next === "visible") {
      // Clear a FUTURE date so it publishes now; a past date is kept (canonical).
      if (publishedAt && new Date(publishedAt).getTime() > nowMs) {
        onPublishedAtChange("");
      }
    } else if (next === "scheduled") {
      // Prefill ~1h ahead when there's no usable future date yet.
      const cur = publishedAt ? new Date(publishedAt).getTime() : NaN;
      if (Number.isNaN(cur) || cur <= nowMs) {
        onPublishedAtChange(new Date(nowMs + HOUR_MS).toISOString());
      }
    }
    onVisibilityChange(next);
  };

  const onDateInput = (local: string) => {
    if (!local) {
      onPublishedAtChange("");
      return;
    }
    const d = new Date(local);
    if (!Number.isNaN(d.getTime())) onPublishedAtChange(d.toISOString());
  };

  const isFuture =
    mounted && publishedAt && new Date(publishedAt).getTime() > new Date().getTime();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Visibility">
        {OPTIONS.map((opt) => {
          const active = visibility === opt.key;
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => select(opt.key)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                active
                  ? "border-biro bg-biro-tint"
                  : "border-border-subtle hover:border-border-strong hover:bg-surface-sunken",
              )}
            >
              <Icon
                size={18}
                aria-hidden="true"
                className={cn("mt-0.5 shrink-0", active ? "text-biro" : "text-ink-muted")}
              />
              <span>
                <span className={cn("block text-sm font-medium", active ? "text-biro" : "text-ink")}>
                  {opt.label}
                </span>
                <span className="block text-xs text-ink-muted">{opt.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {visibility === "scheduled" && (
        <div>
          <Label htmlFor="publish-at">Publish date &amp; time</Label>
          {mounted ? (
            <>
              <input
                id="publish-at"
                type="datetime-local"
                value={publishedAt ? toLocalInputValue(publishedAt) : ""}
                min={toLocalInputValue(new Date().toISOString())}
                onChange={(e) => onDateInput(e.target.value)}
                className="h-11 w-full rounded-md border border-border-strong bg-surface px-3.5 text-[15px] text-ink transition-colors focus:border-biro"
              />
              <p className="mt-1.5 text-xs text-ink-muted">
                {isFuture
                  ? `Goes live ${new Date(publishedAt).toLocaleString()} (your time zone).`
                  : "Pick a time in the future."}
              </p>
            </>
          ) : (
            <div className="h-11 w-full rounded-md border border-border-subtle bg-surface-sunken" />
          )}
        </div>
      )}
    </div>
  );
}
