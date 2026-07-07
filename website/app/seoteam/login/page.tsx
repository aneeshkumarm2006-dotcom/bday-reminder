"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BrandRing } from "@/components/brand-ring";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { loginRequest } from "@/lib/blog/dashboard-api";
import { siteConfig } from "@/lib/site";

export default function SeoLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await loginRequest(password);
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
            Enter the shared dashboard password to manage blog posts.
          </p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
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
