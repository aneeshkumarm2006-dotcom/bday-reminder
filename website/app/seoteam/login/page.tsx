"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { BrandRing } from "@/components/brand-ring";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { loginRequest } from "@/lib/blog/dashboard-api";
import { EDITOR_COOKIE } from "@/lib/content/editor";
import { siteConfig } from "@/lib/site";

/**
 * Read the (non-httpOnly, attribution-only) editor cookie to prefill the name.
 * Cookies are an external store, so this goes through `useSyncExternalStore`
 * instead of a setState-in-effect: the server snapshot is "" and the client's
 * is the real cookie, which React reconciles without a hydration mismatch.
 */
function readEditorCookie(): string {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${EDITOR_COOKIE}=([^;]*)`),
  );
  try {
    return match ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}

/** The cookie can't change while this page is open — nothing to subscribe to. */
const noopSubscribe = () => () => {};

export default function SeoLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Remember who was last at this browser (cosmetic — never an auth signal)
  // until they type something, which takes over.
  const rememberedName = useSyncExternalStore(
    noopSubscribe,
    readEditorCookie,
    () => "",
  );
  const [typedName, setTypedName] = useState<string | null>(null);
  const editorName = typedName ?? rememberedName;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await loginRequest(password, editorName);
      // Honor a ?next= target if it stays inside the dashboard, else go home.
      const next = new URLSearchParams(window.location.search).get("next");
      const dest = next && next.startsWith("/seoteam") ? next : "/seoteam";
      router.replace(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign you in.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <BrandRing size="lg" />
          <span className="font-display text-lg font-semibold text-ink">
            {siteConfig.name} · SEO
          </span>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8">
          <h1 className="font-display text-2xl font-semibold text-ink">
            SEO team sign in
          </h1>
          <p className="mt-1.5 text-sm text-ink-secondary">
            Enter the shared dashboard password to manage the site.
          </p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <TextField
              label="Your name (optional)"
              type="text"
              autoComplete="nickname"
              placeholder="e.g. Priya"
              value={editorName}
              onChange={(e) => setTypedName(e.target.value)}
              helper="Shown on the activity log so edits can be traced back to you."
            />
            <TextField
              label="Password"
              type="password"
              required
              showPasswordToggle
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error}
            />
            <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
