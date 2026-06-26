"use client";

import { Check, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { invitesApi, type InvitePreview } from "@/lib/api";

/**
 * Accept a shared-list invite (FR-42). Previews who invited you and the list,
 * then joins on an explicit click. Requires a session — the (app) guard sends
 * signed-out visitors to /login first.
 */
export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const { toast } = useToast();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    invitesApi
      .preview(token)
      .then((res) => active && setPreview(res.invite))
      .catch(() => active && setError("This invite link is invalid or has expired."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  const accept = async () => {
    setBusy(true);
    try {
      const { list } = await invitesApi.accept(token);
      toast({ message: "You've joined the list.", tone: "success" });
      router.replace(`/lists/${list.id}`);
    } catch {
      toast({ message: "Couldn't accept the invite. Try again.", tone: "error" });
      setBusy(false);
    }
  };

  if (loading) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="rounded-2xl border border-border-subtle bg-surface p-8 text-center">
        <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-biro-tint text-biro">
          <Users size={26} aria-hidden="true" />
        </span>
        {error || !preview ? (
          <>
            <h1 className="font-display text-xl font-semibold text-ink">Invite not found</h1>
            <p className="mt-2 text-sm text-ink-secondary">{error}</p>
            <Link href="/lists" className="mt-6 inline-block text-sm font-medium text-biro hover:underline">
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
        ) : (
          <>
            <h1 className="font-display text-xl font-semibold text-ink">
              {preview.inviterName} invited you
            </h1>
            <p className="mt-2 text-ink-secondary">
              Join <span className="font-medium text-ink">{preview.listName}</span> to track birthdays
              together. Everyone can add and edit people.
            </p>
            <Button size="lg" className="mt-6 w-full" onClick={accept} disabled={busy}>
              <Check aria-hidden="true" />
              {busy ? "Joining…" : "Accept invite"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
