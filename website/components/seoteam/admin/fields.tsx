"use client";

import { Plus, RotateCcw, X } from "lucide-react";
import * as React from "react";

import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Form field primitives for the admin editors.
 *
 * Two things they add over the raw `ui/input` components:
 *   - a character counter with the same green/amber bands the blog editor's SEO
 *     checks use, so title/description limits are visible while typing;
 *   - a "reset to default" affordance, which for this admin means *clearing*
 *     the field — an empty override falls back to `lib/content/defaults.ts` at
 *     render time (see `merge.ts`), so blank is the reset.
 *
 * Every button carries an explicit `type="button"`: these render inside forms
 * elsewhere in the codebase, and a bare button submits the outer form.
 */

function counterTone(len: number, min?: number, max?: number): string {
  if (!min && !max) return "text-ink-muted";
  if (len === 0) return "text-ink-muted";
  if (max && len > max) return "text-danger-fg";
  if (min && len < min) return "text-warn-fg";
  return "text-ok-fg";
}

export function TextRow({
  label,
  value,
  onChange,
  helper,
  placeholder,
  min,
  max,
  defaultHint,
  type = "text",
  disabled,
  error,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  helper?: string;
  placeholder?: string;
  /** Recommended length band — drives the counter's colour, never blocks typing. */
  min?: number;
  max?: number;
  /** What renders when this is left blank (the built-in default). */
  defaultHint?: string;
  type?: string;
  disabled?: boolean;
  error?: string | null;
}) {
  const id = React.useId();
  const len = value.length;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <div className="mb-1.5 flex items-center gap-2">
          {(min || max) && (
            <span className={cn("text-xs tabular-nums", counterTone(len, min, max))}>
              {len}
              {max ? `/${max}` : ""}
            </span>
          )}
          {value.trim() !== "" && defaultHint !== undefined && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
              title="Clear this override and fall back to the built-in default"
            >
              <RotateCcw size={12} aria-hidden="true" />
              Reset
            </button>
          )}
        </div>
      </div>
      <Input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? defaultHint}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {(error || helper || defaultHint) && (
        <p className={cn("mt-1.5 text-xs", error ? "text-danger-fg" : "text-ink-muted")}>
          {error ??
            helper ??
            (value.trim() === "" && defaultHint ? `Default: ${defaultHint}` : undefined)}
        </p>
      )}
    </div>
  );
}

export function TextAreaRow({
  label,
  value,
  onChange,
  helper,
  placeholder,
  min,
  max,
  rows = 4,
  defaultHint,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  helper?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  rows?: number;
  defaultHint?: string;
}) {
  const id = React.useId();
  const len = value.length;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <div className="mb-1.5 flex items-center gap-2">
          {(min || max) && (
            <span className={cn("text-xs tabular-nums", counterTone(len, min, max))}>
              {len}
              {max ? `/${max}` : ""}
            </span>
          )}
          {value.trim() !== "" && defaultHint !== undefined && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
              title="Clear this override and fall back to the built-in default"
            >
              <RotateCcw size={12} aria-hidden="true" />
              Reset
            </button>
          )}
        </div>
      </div>
      <Textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {(helper || defaultHint) && (
        <p className="mt-1.5 text-xs text-ink-muted">
          {helper ?? (value.trim() === "" && defaultHint ? "Falls back to the built-in copy." : undefined)}
        </p>
      )}
    </div>
  );
}

/** Chip-style editor for a list of short strings (keywords, disallow rules). */
export function StringListEditor({
  label,
  values,
  onChange,
  placeholder = "Add and press Enter",
  helper,
  max = 50,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  helper?: string;
  max?: number;
}) {
  const [draft, setDraft] = React.useState("");
  const id = React.useId();

  const add = () => {
    const value = draft.trim();
    if (!value || values.includes(value) || values.length >= max) {
      setDraft("");
      return;
    }
    onChange([...values, value]);
    setDraft("");
  };

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {values.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {values.map((value, i) => (
            <li
              key={`${value}-${i}`}
              className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-sunken px-2.5 py-1 text-xs text-ink"
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${value}`}
                className="text-ink-muted transition-colors hover:text-danger-fg"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
        >
          <Plus size={16} aria-hidden="true" />
          Add
        </button>
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">
        {helper ?? `${values.length}/${max}`}
      </p>
    </div>
  );
}
