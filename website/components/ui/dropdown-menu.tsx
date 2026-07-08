"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface DropdownItem {
  label: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  destructive?: boolean;
}

/**
 * Minimal, dependency-free dropdown menu (no Radix — matches this app's
 * hand-rolled kit). Renders its own icon-button trigger, positions a menu below
 * it, and closes on outside-click, Escape, or selection. Arrow keys move between
 * items; focus returns to the trigger on close. Use for row action menus.
 */
export function DropdownMenu({
  triggerIcon,
  triggerLabel,
  triggerClassName,
  items,
  align = "end",
}: {
  triggerIcon: React.ReactNode;
  /** Accessible label for the trigger button. */
  triggerLabel: string;
  triggerClassName?: string;
  items: DropdownItem[];
  align?: "start" | "end";
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) btnRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    el?.focus();
  }, [open]);

  const items$ = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);

  const onKey = (e: React.KeyboardEvent) => {
    const menuItems = items$();
    if (menuItems.length === 0) return;
    const idx = menuItems.findIndex((el) => el === document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      menuItems[Math.min(idx + 1, menuItems.length - 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      menuItems[Math.max(idx - 1, 0)]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      menuItems[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      menuItems[menuItems.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink [&_svg]:size-[18px]",
          triggerClassName,
        )}
      >
        {triggerIcon}
      </button>

      {open && (
        <div
          ref={listRef}
          role="menu"
          aria-label={triggerLabel}
          onKeyDown={onKey}
          className={cn(
            "absolute top-full z-50 mt-1 min-w-[12rem] overflow-hidden rounded-md border border-border-strong bg-surface py-1 shadow-lg",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                item.onSelect();
                close();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-sunken focus:bg-surface-sunken focus:outline-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-muted",
                item.destructive &&
                  "text-danger-fg hover:bg-danger-bg focus:bg-danger-bg [&_svg]:text-danger-fg",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
