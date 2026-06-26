"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Lightweight toast system (DESIGN.md §10) — non-blocking confirmations and
 * errors. `useToast()` returns `toast({ message, tone })`. Auto-dismisses.
 */

type Tone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: Tone };

type ToastContextValue = {
  toast: (input: { message: string; tone?: Tone }) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

const TONE_CLASS: Record<Tone, string> = {
  success: "text-ok-fg",
  error: "text-danger-fg",
  info: "text-biro",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const counter = React.useRef(0);

  const toast = React.useCallback(({ message, tone = "info" }: { message: string; tone?: Tone }) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-lg border border-border-subtle bg-surface px-4 py-3 shadow-lg"
            >
              <Icon size={18} className={cn("shrink-0", TONE_CLASS[t.tone])} aria-hidden="true" />
              <span className="text-sm text-ink">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>.");
  return ctx;
}
