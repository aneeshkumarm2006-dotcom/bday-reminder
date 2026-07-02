"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { configApi, googleLoginUrl } from "@/lib/api";

/**
 * "Continue with Google" (identity login). A full-page navigation to the
 * backend's `/auth/google/start`, which 302s to Google's consent screen and
 * returns to `/auth/google` with a handoff token. Renders nothing until we know
 * the server has Google login provisioned (config.googleAuthAvailable), so the
 * button never appears when it would just error out.
 *
 * Note: signing in requests identity ONLY (name + email). The Gmail "send as
 * you" permission is a separate, later opt-in on the reminder/auto-send screens.
 */
export function GoogleAuthButton({ label = "Continue with Google" }: { label?: string }) {
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: () => configApi.get() });
  const [busy, setBusy] = useState(false);

  if (!config?.googleAuthAvailable) return null;

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border-subtle" />
        <span className="text-xs font-medium uppercase tracking-wide text-ink-secondary">or</span>
        <span className="h-px flex-1 bg-border-subtle" />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          window.location.href = googleLoginUrl;
        }}
      >
        <GoogleGlyph />
        {busy ? "Redirecting…" : label}
      </Button>
    </div>
  );
}

/** Google's four-colour "G" mark. */
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
