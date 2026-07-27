"use client";

import { X } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import type { AnnouncementConfig } from "@/lib/content/types";

/**
 * The strip above the site header. The *schedule* is resolved on the server
 * (see `isAnnouncementLive`) so an expired message never reaches the browser;
 * this component only owns dismissal.
 *
 * The dismissal key hashes the message text, so editing the copy re-shows the
 * bar to everyone who dismissed the previous one — which is what an admin
 * publishing a new announcement expects.
 */
function keyFor(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return `ctd-announcement-${hash}`;
}

/**
 * localStorage is an external store, so it's read through
 * `useSyncExternalStore` rather than an effect that calls setState: React then
 * handles the server ("not dismissed") vs. client (real value) snapshot
 * difference itself, with no hydration mismatch and no flash.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function readDismissed(storageKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false; // private mode / storage disabled — show the bar
  }
}

export function AnnouncementBar({ announcement }: { announcement: AnnouncementConfig }) {
  const storageKey = keyFor(announcement.text);
  const dismissed = React.useSyncExternalStore(
    subscribe,
    () => readDismissed(storageKey),
    () => false,
  );

  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* nothing to persist to — the re-render below still hides it */
    }
    listeners.forEach((listener) => listener());
  };

  return (
    <div className="relative border-b border-border-subtle bg-biro-tint">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-3 px-10 py-2.5 text-center sm:px-5">
        <p className="text-sm text-ink">
          {announcement.text}
          {announcement.linkHref && announcement.linkLabel && (
            <>
              {" "}
              <Link
                href={announcement.linkHref}
                className="font-medium text-biro underline underline-offset-2"
              >
                {announcement.linkLabel}
              </Link>
            </>
          )}
        </p>
      </div>
      {announcement.dismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface hover:text-ink"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
