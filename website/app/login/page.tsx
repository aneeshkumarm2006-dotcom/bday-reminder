"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthShell } from "@/components/app/auth-shell";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/** Email + password login (FR-1). Redirects to the app once a session exists. */
export default function LoginPage() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in (e.g. opened /login with a live session) → into the app.
  useEffect(() => {
    if (status === "authenticated") router.replace("/reminders");
  }, [status, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/reminders");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "That email and password don't match. Try again."
          : "Couldn't sign you in. Check your connection and try again.",
      );
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your reminders."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-medium text-biro hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          showPasswordToggle
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
        />
        <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
