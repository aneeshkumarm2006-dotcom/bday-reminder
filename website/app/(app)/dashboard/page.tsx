"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { PersonCard } from "@/components/app/person-card";
import { buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBlock } from "@/components/ui/spinner";
import { peopleApi, type UpcomingGroup, type UpcomingItem } from "@/lib/api";
import { cn } from "@/lib/utils";

/** The Upcoming feed (FR-1/9/14) — the post-login home. Grouped, tag-filterable. */
const GROUP_ORDER: UpcomingGroup[] = ["This week", "This month", "Later"];

export default function DashboardPage() {
  const [tag, setTag] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["upcoming"],
    queryFn: () => peopleApi.upcoming(),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !data) {
    return <p className="text-ink-secondary">Couldn&apos;t load your feed. Refresh to try again.</p>;
  }

  const filtered = tag ? data.items.filter((i) => i.relationshipTag === tag) : data.items;
  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    items: filtered.filter((i) => i.group === g),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <PageHeader
        title="Upcoming"
        action={
          <Link href="/people/new" className={cn(buttonVariants(), "hidden sm:inline-flex")}>
            <Plus aria-hidden="true" />
            Add person
          </Link>
        }
      />

      {data.tags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Chip selected={tag === null} onClick={() => setTag(null)}>
            All
          </Chip>
          {data.tags.map((t) => (
            <Chip key={t} selected={tag === t} onClick={() => setTag(t)}>
              {t}
            </Chip>
          ))}
        </div>
      )}

      {data.items.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No birthdays yet"
          body="Add the people who matter and we'll count down to every date."
          action={
            <Link href="/people/new" className={buttonVariants()}>
              <Plus aria-hidden="true" />
              Add your first person
            </Link>
          }
        />
      ) : groups.length === 0 ? (
        <p className="text-ink-secondary">No upcoming events for this filter.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(({ group, items }) => (
            <Section key={group} title={group} items={items} />
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: UpcomingItem[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <PersonCard key={`${item.personId}-${item.eventId}`} item={item} />
        ))}
      </div>
    </section>
  );
}
