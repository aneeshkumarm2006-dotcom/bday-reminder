"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Cake, Check, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  DatePartsField,
  EMPTY_DATE_PARTS,
  isCompleteDateParts,
  type DatePartsValue,
} from "@/components/app/date-parts-field";
import { ListCatchUp } from "@/components/app/list-catch-up";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { invitesApi, type InvitePreview, type SharedListView } from "@/lib/api";
import { monthAbbr } from "@/lib/dates";
import { useAuth } from "@/providers/auth-provider";

/**
 * Accept a shared-list invite (FR-42). Previews who invited you and the list,
 * then joins on an explicit click. Requires a session — the (app) guard sends
 * signed-out visitors to /login first.
 *
 * Three steps rather than one button, because joining is an exchange: you get
 * everyone's birthdays, and yours goes in so they get reminded about you too.
 * The middle step is where you agree to your half (or decline it), and the last
 * is where you decide how much of their half you actually want.
 */
type Step = "preview" | "birthday" | "catchup";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [step, setStep] = useState<Step>("preview");
  const [shareBirthday, setShareBirthday] = useState(true);
  const [editingDate, setEditingDate] = useState(false);
  const [birthday, setBirthday] = useState<DatePartsValue>(EMPTY_DATE_PARTS);
  const [dateError, setDateError] = useState<string | null>(null);
  const [joined, setJoined] = useState<SharedListView | null>(null);

  useEffect(() => {
    let active = true;
    invitesApi
      .preview(token)
      .then((res) => {
        if (!active) return;
        setPreview(res.invite);
        setBirthday(res.invite.yourBirthday ?? EMPTY_DATE_PARTS);
      })
      .catch(() => active && setError("This invite link is invalid or has expired."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  const storedBirthday = preview?.yourBirthday ?? user?.birthday ?? null;
  const knowsBirthday = !!storedBirthday && !editingDate;

  const accept = async (share: boolean) => {
    // Only send a date when we're actually collecting one — the server never
    // overwrites a birthday it already has.
    let dob: DatePartsValue | undefined;
    if (share && !knowsBirthday) {
      if (!isCompleteDateParts(birthday)) {
        setDateError("Add the month and day of your birthday.");
        return;
      }
      dob = birthday;
    }
    setDateError(null);
    setBusy(true);
    try {
      const res = await invitesApi.accept(token, {
        shareBirthday: share,
        ...(dob ? { birthday: dob } : {}),
      });
      await refreshUser();
      for (const key of ["lists", "list", "people", "upcoming", "reminders", "calendar-events"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast({ message: "You've joined the list.", tone: "success" });
      // Nothing to catch up on in an empty list — go straight to it.
      if (res.peopleCount > 0) {
        setJoined(res.list);
        setStep("catchup");
        setBusy(false);
      } else {
        router.replace(`/lists/${res.list.id}`);
      }
    } catch {
      toast({ message: "Couldn't accept the invite. Try again.", tone: "error" });
      setBusy(false);
    }
  };

  if (loading) return <LoadingBlock />;

  // The catch-up wants room; the other two steps are a centered card.
  if (step === "catchup" && joined) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <ListCatchUp
          listId={joined.id}
          listName={joined.name}
          onDone={() => router.replace(`/lists/${joined.id}`)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="rounded-2xl border border-border-subtle bg-surface p-8 text-center">
        <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-biro-tint text-biro">
          {step === "birthday" ? (
            <Cake size={26} aria-hidden="true" />
          ) : (
            <Users size={26} aria-hidden="true" />
          )}
        </span>

        {error || !preview ? (
          <>
            <h1 className="font-display text-xl font-semibold text-ink">Invite not found</h1>
            <p className="mt-2 text-sm text-ink-secondary">{error}</p>
            <Link
              href="/lists"
              className="mt-6 inline-block text-sm font-medium text-biro hover:underline"
            >
              Go to your lists
            </Link>
          </>
        ) : preview.alreadyMember ? (
          <>
            <h1 className="font-display text-xl font-semibold text-ink">
              You&apos;re already in {preview.listName}
            </h1>
            <Button className="mt-6" onClick={() => router.replace("/lists")}>
              Go to your lists
            </Button>
          </>
        ) : step === "preview" ? (
          <>
            <h1 className="font-display text-xl font-semibold text-ink">
              {preview.inviterName} invited you
            </h1>
            <p className="mt-2 text-ink-secondary">
              {preview.peopleCount === 0 ? (
                <>
                  Join <span className="font-medium text-ink">{preview.listName}</span> to track
                  birthdays together. Everyone can add and edit people.
                </>
              ) : (
                <>
                  <span className="font-medium text-ink">{preview.peopleCount}</span>{" "}
                  {preview.peopleCount === 1 ? "birthday is" : "birthdays are"} waiting inside{" "}
                  <span className="font-medium text-ink">{preview.listName}</span>. You&apos;ll get
                  your own reminders for the ones you keep.
                </>
              )}
            </p>
            <Button size="lg" className="mt-6 w-full" onClick={() => setStep("birthday")}>
              <Check aria-hidden="true" />
              Continue
            </Button>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-semibold text-ink">
              Share your birthday with {preview.listName}?
            </h1>

            <div className="mt-5 flex flex-col gap-3 text-left">
              {knowsBirthday ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-ink">Share my birthday</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        We&apos;ll add {monthAbbr(storedBirthday!.month)} {storedBirthday!.day} to
                        this list so everyone gets a reminder.
                      </p>
                    </div>
                    <Switch
                      checked={shareBirthday}
                      onCheckedChange={setShareBirthday}
                      aria-label="Share my birthday with this list"
                    />
                  </div>
                  {shareBirthday ? (
                    <button
                      type="button"
                      onClick={() => setEditingDate(true)}
                      className="self-start text-xs font-medium text-biro hover:underline"
                    >
                      Use a different date
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-sm text-ink-secondary">
                    Add your birthday and this list will celebrate you too.
                  </p>
                  <DatePartsField
                    label="Your birthday"
                    allowEmpty
                    value={birthday}
                    onChange={setBirthday}
                    helper="The year is optional."
                  />
                  {dateError ? (
                    <p role="alert" className="text-sm text-danger-fg">
                      {dateError}
                    </p>
                  ) : null}
                </>
              )}

              <p className="text-xs text-ink-muted">
                Only the people in this list see it. You can remove it any time.
              </p>
            </div>

            <Button
              size="lg"
              className="mt-6 w-full"
              onClick={() => accept(shareBirthday)}
              disabled={busy}
            >
              {busy ? "Joining…" : `Join ${preview.listName}`}
            </Button>
            {knowsBirthday ? (
              <Button variant="ghost" className="mt-2 w-full" onClick={() => setStep("preview")}>
                Back
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="mt-2 w-full"
                onClick={() => accept(false)}
                disabled={busy}
              >
                Join without sharing
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
