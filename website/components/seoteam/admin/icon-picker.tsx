"use client";

import { ContentIcon } from "@/components/content-icon";
import { Label } from "@/components/ui/input";
import { ICON_NAMES } from "@/lib/content/icons";
import { cn } from "@/lib/utils";

/**
 * Curated icon picker. The value stored is the *name* string — icons can't live
 * in Mongo, and the registry in `lib/content/icons.ts` is statically imported so
 * the bundler keeps tree-shaking (a dynamic `lucide-react/${name}` would ship
 * the entire icon set).
 */
export function IconPicker({
  label = "Icon",
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5 rounded-md border border-border-strong bg-surface p-2">
        {ICON_NAMES.map((name) => {
          const active = name === value;
          return (
            <button
              key={name}
              type="button"
              title={name}
              aria-label={name}
              aria-pressed={active}
              onClick={() => onChange(name)}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
                active
                  ? "border-biro bg-biro-tint text-biro"
                  : "border-transparent text-ink-secondary hover:bg-surface-sunken hover:text-ink",
              )}
            >
              <ContentIcon name={name} size={17} />
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-muted">
        <ContentIcon name={value} size={14} />
        {value || "Sparkles"}
      </p>
    </div>
  );
}
