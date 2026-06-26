"use client";

import { useQuery } from "@tanstack/react-query";
import { PawPrint, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBlock } from "@/components/ui/spinner";
import { peopleApi, type PersonListItem } from "@/lib/api";
import { countdownLabel } from "@/lib/dates";

/** People directory (a web addition — the app surfaces people via the feed). Sortable. */
export default function PeoplePage() {
  const [sort, setSort] = useState<"next" | "name">("next");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["people", sort],
    queryFn: () => peopleApi.list({ sort }),
  });

  return (
    <div>
      <PageHeader
        title="People"
        action={
          <Link href="/people/new" className={buttonVariants()}>
            <Plus aria-hidden="true" />
            Add person
          </Link>
        }
      />

      <div className="mb-6 flex gap-2">
        <Chip selected={sort === "next"} onClick={() => setSort("next")}>
          By next date
        </Chip>
        <Chip selected={sort === "name"} onClick={() => setSort("name")}>
          By name
        </Chip>
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : isError || !data ? (
        <p className="text-ink-secondary">Couldn&apos;t load your people. Refresh to try again.</p>
      ) : data.people.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No people yet"
          body="Add someone to start tracking their birthday and events."
          action={
            <Link href="/people/new" className={buttonVariants()}>
              <Plus aria-hidden="true" />
              Add your first person
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.people.map((p) => (
            <PersonRow key={p.id} person={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonRow({ person }: { person: PersonListItem }) {
  const subtitle = [
    person.relationshipTag ?? undefined,
    person.type === "pet" ? "Pet" : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <Link
        href={`/people/${person.id}`}
        className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-3 transition-colors hover:bg-surface-sunken"
      >
        <Avatar name={person.fullName} src={person.photoUrl} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {person.type === "pet" && (
              <PawPrint size={15} className="shrink-0 text-ink-muted" aria-hidden="true" />
            )}
            <span className="truncate font-medium text-ink">{person.fullName}</span>
          </div>
          {subtitle && <p className="truncate text-sm text-ink-muted">{subtitle}</p>}
        </div>
        {person.next && (
          <span className="shrink-0 text-sm font-medium tabular-nums text-biro">
            {countdownLabel(person.next.daysRemaining)}
          </span>
        )}
      </Link>
    </li>
  );
}
