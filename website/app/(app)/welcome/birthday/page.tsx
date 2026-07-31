"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import {
  DatePartsField,
  EMPTY_DATE_PARTS,
  isCompleteDateParts,
  type DatePartsValue,
} from "@/components/app/date-parts-field";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/providers/auth-provider";

/**
 * The last step of signing up with Google.
 *
 * Signing up with the form asks for a birthday inline; the Google flow never
 * shows a form at all, so this is where those accounts fill in the one thing
 * we're missing. Lives inside the (app) group so it inherits the auth guard -
 * by the time anyone lands here they're already signed in.
 */
function WelcomeBirthday() {
  const { user, updateProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [birthday, setBirthday] = useState<DatePartsValue>(EMPTY_DATE_PARTS);
  const [busy, setBusy] = useState(false);

  const next = searchParams.get("next") || "/calendar";

  // Nothing to ask if they already have one - covers a stale isNew, a refresh
  // after saving, and anyone who wanders in from the URL bar.
  useEffect(() => {
    if (user?.birthday) router.replace(next);
  }, [user?.birthday, next, router]);

  const save = async () => {
    if (!isCompleteDateParts(birthday)) return;
    setBusy(true);
    try {
      await updateProfile({ birthday });
      toast({ message: "Birthday saved.", tone: "success" });
      router.replace(next);
    } catch {
      toast({ message: "Couldn't save that. Try again.", tone: "error" });
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md">
      <PageHeader title="One more thing 🎂" />
      <p className="mb-6 text-sm text-ink-secondary">
        Add your birthday so the people you share lists with can celebrate you too. You can change
        or remove it any time in Settings.
      </p>
      <div className="flex flex-col gap-4">
        <DatePartsField
          label="Your birthday"
          allowEmpty
          value={birthday}
          onChange={setBirthday}
          helper="The year is optional — leave it blank if you'd rather not say."
        />
        <div>
          <Button onClick={save} size="lg" disabled={busy || !isCompleteDateParts(birthday)}>
            {busy ? "Saving…" : "Save birthday"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function WelcomeBirthdayPage() {
  return (
    <Suspense fallback={<PageHeader title="One more thing 🎂" />}>
      <WelcomeBirthday />
    </Suspense>
  );
}
