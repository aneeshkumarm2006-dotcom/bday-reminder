"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { MemberAvatars } from "@/components/app/member-avatars";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TextField } from "@/components/ui/input";
import { LoadingBlock } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { listsApi } from "@/lib/api";

/** Shared / family lists (FR-41/44) — track birthdays together. */
export default function ListsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");

  const { data, isLoading, isError } = useQuery({ queryKey: ["lists"], queryFn: () => listsApi.list() });

  const create = useMutation({
    mutationFn: (listName: string) => listsApi.create(listName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lists"] });
      setCreateOpen(false);
      setName("");
      toast({ message: "List created.", tone: "success" });
    },
    onError: () => toast({ message: "Couldn't create the list.", tone: "error" }),
  });

  return (
    <div>
      <PageHeader
        title="Lists"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" />
            New list
          </Button>
        }
      />

      {isLoading ? (
        <LoadingBlock />
      ) : isError || !data ? (
        <p className="text-ink-secondary">Couldn&apos;t load your lists. Refresh to try again.</p>
      ) : data.lists.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No shared lists yet"
          body="Create a list to track the same birthdays with family or friends."
          action={<Button onClick={() => setCreateOpen(true)}>Create a list</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.lists.map((l) => (
            <Link
              key={l.id}
              href={`/lists/${l.id}`}
              className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4 transition-colors hover:bg-surface-sunken"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-lg font-semibold text-ink">{l.name}</h2>
                <Badge tone={l.role === "owner" ? "biro" : "neutral"}>{l.role}</Badge>
              </div>
              <p className="text-sm text-ink-muted">
                {l.memberCount} {l.memberCount === 1 ? "member" : "members"} · {l.peopleCount}{" "}
                {l.peopleCount === 1 ? "person" : "people"}
              </p>
              <MemberAvatars members={l.members} />
            </Link>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="New list">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate(name.trim());
          }}
          className="flex flex-col gap-4"
        >
          <TextField
            label="List name"
            placeholder="e.g. The Smiths"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !name.trim()}>
              Create
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
