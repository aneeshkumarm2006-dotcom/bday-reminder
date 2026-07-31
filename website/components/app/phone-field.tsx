"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import * as React from "react";

import { Input, Label } from "@/components/ui/input";
import { COUNTRIES, countryByCode, dialCodeFor } from "@/lib/countries";
import { defaultCountryCode, formatNational, splitPhone, toE164 } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

/**
 * Phone field with a country-code picker (Twilio is provisioned beyond the US/CA,
 * so a typed number can no longer be assumed to be +1). The country and the
 * national number are two controls but one value: the parent still holds a single
 * E.164 string, so every existing call-site keeps passing `phone` straight to the
 * API.
 *
 * The picker opens on the account's own country (from the timezone the app
 * reports) unless the current value already says otherwise — an existing
 * "+4477…" edits as United Kingdom.
 */

/** Country dropdown: a searchable listbox, since 200 rows is too many to scroll. */
function CountryPicker({
  value,
  onChange,
  disabled,
  describedBy,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const selected = countryByCode(value);
  const q = query.trim().toLowerCase();
  const matches = q
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().startsWith(q) ||
          c.dial.startsWith(q.replace(/^\+/, "")),
      )
    : COUNTRIES;

  React.useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const handler = (e: MouseEvent | FocusEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("focusin", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("focusin", handler);
    };
  }, [open]);

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-describedby={describedBy}
        aria-label={`Country code${selected ? `: ${selected.name} +${selected.dial}` : ""}`}
        className={cn(
          "flex h-11 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-[15px] text-ink transition-colors",
          "hover:border-biro focus-visible:border-biro disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <span className="font-medium tabular-nums">+{selected?.dial ?? dialCodeFor(value)}</span>
        <span className="text-xs text-ink-muted">{selected?.code ?? value}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-ink-muted transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-md border border-border-strong bg-surface shadow-lg">
          <div className="flex items-center gap-2 border-b border-border-subtle px-3">
            <Search size={16} className="shrink-0 text-ink-muted" aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                } else if (e.key === "Enter" && matches[0]) {
                  e.preventDefault();
                  pick(matches[0].code);
                }
              }}
              placeholder="Search country or code"
              aria-label="Search countries"
              className="h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
            />
          </div>
          <ul role="listbox" aria-label="Country" className="max-h-64 overflow-auto py-1">
            {matches.map((c) => {
              const isSelected = c.code === value;
              return (
                <li key={c.code} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => pick(c.code)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-sunken",
                      isSelected && "bg-biro-tint text-biro",
                    )}
                  >
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="tabular-nums text-ink-muted">+{c.dial}</span>
                    {isSelected && <Check size={14} aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
            {matches.length === 0 && (
              <li className="px-3 py-3 text-sm text-ink-muted">No country matches that.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function PhoneField({
  label,
  helper,
  error,
  value,
  onChange,
  id,
  className,
  disabled,
  autoFocus,
}: {
  label: string;
  helper?: string;
  error?: string | null;
  /** Stored E.164 string ("" when empty) — the only value the parent tracks. */
  value: string;
  onChange: (next: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const { user } = useAuth();
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const msgId = `${fieldId}-msg`;

  const fallback = defaultCountryCode(user?.timezone);
  // The picked country has to outlive an empty number field: clearing the digits
  // empties `value`, which would otherwise snap the picker back to the default.
  const [picked, setPicked] = React.useState<string | null>(null);
  const parsed = splitPhone(value, picked ?? fallback);
  // `value` wins whenever it carries a country code — a parent that re-seeds the
  // field (the auto-send popup reopening on another number) must not keep the
  // last pick. It survives a same-dial parse, though, so choosing Canada isn't
  // immediately snapped back to the US that "+1" resolves to.
  const country =
    picked && dialCodeFor(picked) === dialCodeFor(parsed.country) ? picked : parsed.country;
  const dial = dialCodeFor(country);

  const setCountry = (code: string) => {
    setPicked(code);
    onChange(toE164(dialCodeFor(code), parsed.national));
  };

  return (
    <div className={cn("w-full", className)}>
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="flex gap-2">
        <CountryPicker
          value={country}
          onChange={setCountry}
          disabled={disabled}
          describedBy={msgId}
        />
        <Input
          id={fieldId}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={msgId}
          placeholder={dial === "1" ? "(555) 123-4567" : "Phone number"}
          value={formatNational(dial, parsed.national)}
          onChange={(e) => onChange(toE164(dial, e.target.value))}
        />
      </div>
      {(error || helper) && (
        <p id={msgId} className={cn("mt-1.5 text-xs", error ? "text-danger-fg" : "text-ink-muted")}>
          {error || helper}
        </p>
      )}
    </div>
  );
}
