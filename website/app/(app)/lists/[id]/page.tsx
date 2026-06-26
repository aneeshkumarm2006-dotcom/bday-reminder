"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, LogOut, Trash2, UserPlus, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { LoadingBlock } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { listsApi } from "@/lib/api";

/** Shared list detail (FR-42/46/47) — members, invites, leave/remove/delete. */
export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [invitee, setInvitee] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["list", id],
    queryFn: () => listsApi.get(id),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["list", id] });
    qc.invalidateQueries({ queryKey: ["lists"] });
  };

  const invite = useMutation({
    mutationFn: (value: string) => listsApi.invite(id, { invitedEmailOrPhone: value || undefined }),
    onSuccess: (res) => {
      setInvitee("");
      setInviteLink(res.invite.acceptUrl);
      refresh();
      toast({
        message:
          res.emailOutcome === "sent" ? "Invite sent." : "Invite created — share the link below.",
        tone: "success",
      });
    },
    onError: () => toast({ message: "Couldn't create the invite.", tone: "error" }),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !data) {
    return <p className="text-ink-secondary">Couldn&apos;t load that list.</p>;
  }

  const list = data.list;
  const isOwner = list.role === "owner";

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ message: "Invite link copied.", tone: "success" });
    } catch {
      toast({ message: "Couldn't copy. Copy it manually.", tone: "error" });
    }
  };

  const removeMember = async (memberId: string, memberName: string) => {
    if (!(await confirm({ title: `Remove ${memberName}?`, destructive: true, confirmLabel: "Remove" })))
      return;
    try {
      await listsApi.removeMember(id, memberId);
      refresh();
    } catch {
      toast({ message: "Couldn't remove the member.", tone: "error" });
    }
  };

  const revokeInvite = async (inviteId: string) => {
    try {
      await listsApi.revokeInvite(id, inviteId);
      refresh();
    } catch {
      toast({ message: "Couldn't revoke the invite.", tone: "error" });
    }
  };

  const leave = async () => {
    if (!(await confirm({ title: `Leave ${list.name}?`, destructive: true, confirmLabel: "Leave" })))
      return;
    try {
      await listsApi.leave(id);
      refresh();
      router.replace("/lists");
    } catch {
      toast({ message: "Couldn't leave the list.", tone: "error" });
    }
  };

  const deleteList = async () => {
    if (
      !(await confirm({
        title: `Delete ${list.name}?`,
        message: "Every member loses access. People stay in their owners' accounts.",
        destructive: true,
        confirmLabel: "Delete",
      }))
    )
      return;
    try {
      await listsApi.remove(id);
      refresh();
      router.replace("/lists");
    } catch {
      toast({ message: "Couldn't delete the list.", tone: "error" });
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={list.name}
        subtitle={`${list.memberCount} ${list.memberCount === 1 ? "member" : "members"} · ${list.peopleCount} ${list.peopleCount === 1 ? "person" : "people"}`}
        action={<Badge tone={isOwner ? "biro" : "neutral"}>{list.role}</Badge>}
      />

      {/* Members */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Members</h2>
        <ul className="flex flex-col gap-2">
          {list.members.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-3"
            >
              <Avatar name={m.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{m.name}</p>
                <p className="truncate text-sm text-ink-muted">{m.email}</p>
              </div>
              {m.isOwner ? (
                <Badge tone="biro">Owner</Badge>
              ) : isOwner ? (
                <button
                  type="button"
                  onClick={() => removeMember(m.id, m.name)}
                  aria-label={`Remove ${m.name}`}
                  className="rounded-md p-2 text-ink-muted hover:bg-danger-bg hover:text-danger-fg"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* Invite (owner) */}
      {isOwner && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">Invite someone</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate(invitee.trim());
            }}
            className="flex gap-2"
          >
            <Input
              type="text"
              placeholder="Email or phone (optional)"
              value={invitee}
              onChange={(e) => setInvitee(e.target.value)}
            />
            <Button type="submit" disabled={invite.isPending}>
              <UserPlus aria-hidden="true" />
              Invite
            </Button>
          </form>

          {inviteLink && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-border-subtle bg-surface-sunken p-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-ink-secondary">{inviteLink}</span>
              <Button size="sm" variant="ghost" onClick={() => copyLink(inviteLink)}>
                <Copy aria-hidden="true" />
                Copy
              </Button>
            </div>
          )}

          {list.pendingInvites.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium text-ink-secondary">Pending invites</h3>
              <ul className="flex flex-col gap-2">
                {list.pendingInvites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center gap-3 rounded-md border border-border-subtle bg-surface p-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {inv.invitedEmailOrPhone || "Shared by link"}
                    </span>
                    <Badge tone="snooze">Pending</Badge>
                    <button
                      type="button"
                      onClick={() => revokeInvite(inv.id)}
                      aria-label="Revoke invite"
                      className="rounded-md p-1.5 text-ink-muted hover:bg-danger-bg hover:text-danger-fg"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Leave / delete */}
      <section className="mt-10 border-t border-border-subtle pt-6">
        {isOwner ? (
          <Button variant="destructive" onClick={deleteList}>
            <Trash2 aria-hidden="true" />
            Delete list
          </Button>
        ) : (
          <Button variant="destructive" onClick={leave}>
            <LogOut aria-hidden="true" />
            Leave list
          </Button>
        )}
      </section>
    </div>
  );
}
