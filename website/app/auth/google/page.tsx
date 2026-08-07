"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { AuthShell } from "@/components/app/auth-shell";
import { DEFAULT_AFTER_AUTH, takeStashedNextPath, withNext } from "@/lib/next-path";
import { useAuth } from "@/providers/auth-provider";

/**
 * Landing page for the "Sign in with Google" redirect. The backend callback
 * bounces the browser here with a one-time `?handoff=…` token; we exchange it
 * for a real session and drop the user into their reminders. Any failure sends
 * them back to /login with a flag.
 */
function GoogleCallback() {
  const { completeGoogleSession } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [failed, setFailed] = useState(false);
  // The exchange consumes a one-time token, so guard against React re-running it.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const handoff = searchParams.get("handoff");
    if (!handoff) {
      router.replace("/login?google=error");
      return;
    }
    // Where they were originally heading, parked before the hand-off to Google.
    const next = takeStashedNextPath();
    completeGoogleSession(handoff)
      // A brand-new Google account never saw a signup form, so it's the one
      // path that still owes us a birthday. Everyone else goes straight in.
      .then(({ isNew }) =>
        router.replace(
          isNew ? withNext("/welcome/birthday", next) : (next ?? DEFAULT_AFTER_AUTH),
        ),
      )
      .catch(() => {
        setFailed(true);
        router.replace("/login?google=error");
      });
  }, [completeGoogleSession, router, searchParams]);

  return (
    <AuthShell title="Signing you in…" subtitle="Just a moment while we finish with Google.">
      <p className="text-sm text-ink-secondary" role="status">
        {failed ? "Redirecting you back to sign in…" : "Completing your sign-in…"}
      </p>
    </AuthShell>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Signing you in…" subtitle="Just a moment.">
          <span />
        </AuthShell>
      }
    >
      <GoogleCallback />
    </Suspense>
  );
}
