"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";

/**
 * Consistent save UX for every admin editor: a sticky bar that only asserts
 * itself when there's something to lose, plus the two guards that make a
 * long-form editor safe — Ctrl/Cmd+S and a beforeunload prompt.
 */

/** Fire `onSave` on Ctrl/Cmd+S instead of the browser's "save page" dialog. */
export function useSaveShortcut(onSave: () => void, enabled = true) {
  // Callers pass an inline closure, so the latest one is stashed in a ref
  // (written in an effect, never during render) to keep the keydown listener
  // subscribed once instead of on every keystroke.
  const ref = React.useRef(onSave);
  React.useEffect(() => {
    ref.current = onSave;
  }, [onSave]);

  React.useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}

/** Warn before leaving with unsaved changes (native prompt, no custom copy). */
export function useUnsavedGuard(dirty: boolean) {
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

export function SaveBar({
  dirty,
  saving,
  onSave,
  onReset,
  error,
  savedAt,
  children,
  saveLabel = "Save changes",
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset?: () => void;
  error?: string | null;
  /** ISO string or formatted label of the last successful save. */
  savedAt?: string | null;
  /** Extra actions (Preview, Publish…) rendered before Save. */
  children?: React.ReactNode;
  saveLabel?: string;
}) {
  return (
    <div className="sticky bottom-0 z-30 -mx-5 mt-8 border-t border-border-subtle bg-surface/95 px-5 py-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm" aria-live="polite">
          {error ? (
            <span className="text-danger-fg">{error}</span>
          ) : dirty ? (
            <span className="text-warn-fg">Unsaved changes</span>
          ) : savedAt ? (
            <span className="text-ink-muted">Saved {savedAt}</span>
          ) : (
            <span className="text-ink-muted">All changes saved</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {onReset && (
            <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={!dirty || saving}>
              Discard
            </Button>
          )}
          {children}
          <Button type="button" size="sm" onClick={onSave} disabled={saving || !dirty}>
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {saving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
