"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AuthShell } from "@/components/app/auth-shell";
import {
  DatePartsField,
  EMPTY_DATE_PARTS,
  isCompleteDateParts,
  type DatePartsValue,
} from "@/components/app/date-parts-field";
import { GoogleAuthButton } from "@/components/app/google-auth-button";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { DEFAULT_AFTER_AUTH, safeNextPath, withNext } from "@/lib/next-path";
import { useAuth } from "@/providers/auth-provider";

/**
 * Create an account (FR-1). Timezone is auto-detected by the auth provider.
 * Honours `?next=` so someone who arrived on an invite link and signed up here
 * lands back on the invite rather than an empty calendar.
 */
function SignupForm() {
  const { status, signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next")) ?? DEFAULT_AFTER_AUTH;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthday, setBirthday] = useState<DatePartsValue>(EMPTY_DATE_PARTS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (!isCompleteDateParts(birthday)) {
      setError("Add the month and day of your birthday.");
      return;
    }
    setBusy(true);
    try {
      await signUp({ name: name.trim(), email: email.trim(), password, birthday });
      router.replace(next);
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
          <Link
            href={withNext("/login", searchParams.get("next"))}
            className="font-medium text-biro hover:underline"
          >
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
        />
        <DatePartsField
          label="Your birthday 🎂"
          allowEmpty
          value={birthday}
          onChange={setBirthday}
          helper="So the people you share lists with can celebrate you too. The year is optional."
        />
        {/* One error slot for the whole form — it used to hang off the password
            field, which read oddly for a birthday problem. */}
        {error ? (
          <p role="alert" className="text-sm text-danger-fg">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <GoogleAuthButton label="Sign up with Google" next={searchParams.get("next")} />
    </AuthShell>
  );
}

// useSearchParams (for ?next=) must sit under a Suspense boundary.
export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Create your account" subtitle="Free forever. No ads, no paid tier.">
          <span />
        </AuthShell>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
