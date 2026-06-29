"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/** Extract { value, label } pairs from native <option> children. */
function parseOptions(children: React.ReactNode): Array<{ value: string; label: string }> {
  const result: Array<{ value: string; label: string }> = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || child.type !== "option") return;
    const p = child.props as { value?: string | number; children?: React.ReactNode };
    result.push({ value: String(p.value ?? ""), label: String(p.children ?? p.value ?? "") });
  });
  return result;
}

/**
 * Custom-rendered select that matches the design tokens in both light and dark
 * mode. Accepts the same API as a native <select> (children as <option>
 * elements, onChange receives a synthetic { target: { value } } event) so
 * existing call-sites don't need to change.
 */
export const Select = React.forwardRef<
  HTMLButtonElement,
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "ref"> & {
    onChange?: (e: { target: { value: string } }) => void;
  }
>(function Select({ className, children, value, onChange, disabled, id, ...rest }, ref) {
  const ariaLabel = (rest as Record<string, unknown>)["aria-label"] as string | undefined;
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const options = parseOptions(children);
  const currentValue = String(value ?? "");
  const currentLabel = options.find((o) => o.value === currentValue)?.label ?? currentValue;
  const activeIdx = options.findIndex((o) => o.value === currentValue);
  const [focusIdx, setFocusIdx] = React.useState(activeIdx >= 0 ? activeIdx : 0);

  // Close on outside click/focus
  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent | FocusEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("focusin", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("focusin", handler);
    };
  }, [open]);

  // Scroll focused option into view
  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[focusIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, focusIdx]);

  function pick(val: string) {
    onChange?.({ target: { value: val } } as React.ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx(activeIdx >= 0 ? activeIdx : 0);
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusIdx((i) => Math.min(i + 1, options.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setFocusIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(options[focusIdx]?.value ?? currentValue); return; }
    if (e.key === "Tab") { setOpen(false); }
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        ref={ref}
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={open ? `sel-opt-${focusIdx}` : undefined}
        disabled={disabled}
        onClick={() => {
          setFocusIdx(activeIdx >= 0 ? activeIdx : 0);
          setOpen((v) => !v);
        }}
        onKeyDown={handleKey}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-md border border-border-strong bg-surface px-3.5 text-[15px] text-ink transition-colors",
          "hover:border-biro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biro/30 focus-visible:border-biro",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown
          className={cn(
            "ml-2 size-4 shrink-0 text-ink-muted transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border-strong bg-surface py-1 shadow-lg"
        >
          {options.map((o, i) => {
            const isSelected = o.value === currentValue;
            const isFocused = i === focusIdx;
            return (
              <li
                key={o.value}
                id={`sel-opt-${i}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setFocusIdx(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(o.value); }}
                className={cn(
                  "cursor-pointer select-none px-3.5 py-2 text-[15px] text-ink",
                  isSelected && "bg-biro-tint text-biro font-medium",
                  !isSelected && isFocused && "bg-surface-sunken",
                )}
              >
                {o.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
