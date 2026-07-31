"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

import { ListCatchUp } from "@/components/app/list-catch-up";
import { listsApi } from "@/lib/api";

/**
 * Revisit the catch-up for a list you're already in. The same component runs
 * inline right after accepting an invite; this route is how you get back to it
 * later from the list itself.
 */
export default function ListCatchUpPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const { data, isError } = useQuery({
    queryKey: ["list", id],
    queryFn: () => listsApi.get(id),
  });

  if (isError) {
    router.replace("/lists");
    return null;
  }
  if (!data) return <p className="text-sm text-ink-muted">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <ListCatchUp
        listId={id}
        listName={data.list.name}
        onDone={() => router.push(`/lists/${id}`)}
      />
    </div>
  );
}
