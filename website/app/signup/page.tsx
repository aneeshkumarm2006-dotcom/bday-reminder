"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthShell } from "@/components/app/auth-shell";
import { GoogleAuthButton } from "@/components/app/google-auth-button";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/** Create an account (FR-1). Timezone is auto-detected by the auth provider. */
export default function SignupPage() {
  const { status, signUp } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/calendar");
  }, [status, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setBusy(true);
    try {
      await signUp({ name: name.trim(), email: email.trim(), password });
      router.replace("/calendar");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? "An account with that email already exists. Try signing in."
          : "Couldn't create your account. Check your connection and try again.",
      );
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free forever. No ads, no paid tier."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-biro hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          autoComplete="new-password"
          required
          helper="At least 8 characters."
          showPasswordToggle
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
        />
        <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <GoogleAuthButton label="Sign up with Google" />
    </AuthShell>
  );
}
