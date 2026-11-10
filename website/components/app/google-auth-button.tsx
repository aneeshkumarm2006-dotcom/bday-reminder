"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { GoogleGlyph } from "@/components/google-glyph";
import { Button } from "@/components/ui/button";
import { configApi, googleLoginUrl } from "@/lib/api";
import { stashNextPath } from "@/lib/next-path";

/**
 * "Continue with Google" (identity login). A full-page navigation to the
 * backend's `/auth/google/start`, which 302s to Google's consent screen and
 * returns to `/auth/google` with a handoff token. Renders nothing until we know
 * the server has Google login provisioned (config.googleAuthAvailable), so the
 * button never appears when it would just error out.
 *
 * Note: signing in requests identity ONLY (name + email). The Gmail "send as
 * you" permission is a separate, later opt-in on the reminder/auto-send screens.
 *
 * `next` is the page the user was originally heading for (an invite link, say).
 * It can't ride along in the URL — the round-trip goes through Google and the
 * backend, which hand back only their own token — so it waits in sessionStorage
 * for /auth/google to pick up.
 */
export function GoogleAuthButton({
  label = "Continue with Google",
  next,
}: {
  label?: string;
  next?: string | null;
}) {
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
          stashNextPath(next);
          window.location.href = googleLoginUrl;
        }}
      >
        <GoogleGlyph />
        {busy ? "Redirecting…" : label}
      </Button>
    </div>
  );
}
