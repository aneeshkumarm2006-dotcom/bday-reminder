"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/spinner";
import { ToggleRow } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { calendarApi, type UpdateCalendarSyncInput } from "@/lib/api";

/** Calendar sync (FR-38/39/40) — subscribe to your birthdays in any calendar app. */
export default function CalendarSyncPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["calendar"],
    queryFn: () => calendarApi.get(),
  });

  const update = useMutation({
    mutationFn: (patch: UpdateCalendarSyncInput) => calendarApi.update(patch),
    onSuccess: (next) => qc.setQueryData(["calendar"], next),
    onError: () => toast({ message: "Couldn't update calendar sync.", tone: "error" }),
  });

  const rotate = useMutation({
    mutationFn: () => calendarApi.rotate(),
    onSuccess: (next) => {
      qc.setQueryData(["calendar"], next);
      toast({ message: "New link generated. The old one no longer works.", tone: "success" });
    },
    onError: () => toast({ message: "Couldn't rotate the link.", tone: "error" }),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !data) {
    return <p className="text-ink-secondary">Couldn&apos;t load calendar settings.</p>;
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ message: "Link copied.", tone: "success" });
    } catch {
      toast({ message: "Couldn't copy. Copy it manually.", tone: "error" });
    }
  };

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Calendar sync"
        subtitle="Subscribe to your birthdays in Apple, Google, or Outlook."
      />

      <div className="rounded-lg border border-border-subtle bg-surface p-4">
        <ToggleRow
          label="Sync to my calendar"
          description="Serve a live, auto-updating feed of your dates."
          checked={data.enabled}
          onCheckedChange={(enabled) => update.mutate({ enabled })}
        />
      </div>

      {data.enabled && (
        <>
          <section className="mt-6">
            <h2 className="mb-2 font-display text-lg font-semibold text-ink">What to include</h2>
            <div className="rounded-lg border border-border-subtle bg-surface p-4">
              <ToggleRow
                label="My birthdays"
                checked={data.includePersonal}
                onCheckedChange={(includePersonal) => update.mutate({ includePersonal })}
              />
              {data.availableLists.map((l) => (
                <ToggleRow
                  key={l.id}
                  label={l.name}
                  checked={data.lists.includes(l.id)}
                  onCheckedChange={(on) =>
                    update.mutate({
                      lists: on ? [...data.lists, l.id] : data.lists.filter((x) => x !== l.id),
                    })
                  }
                />
              ))}
            </div>
          </section>

          {data.feedUrl && (
            <section className="mt-6">
              <h2 className="mb-2 font-display text-lg font-semibold text-ink">Subscribe link</h2>
              <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-sunken p-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-ink-secondary">
                  {data.feedUrl}
                </span>
                <Button size="sm" variant="ghost" onClick={() => copy(data.feedUrl!)}>
                  <Copy aria-hidden="true" />
                  Copy
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.webcalUrl && (
                  <a href={data.webcalUrl} className="text-sm font-medium text-biro hover:underline">
                    Add to Apple Calendar
                  </a>
                )}
              </div>
              <Button
                className="mt-4"
                variant="secondary"
                size="sm"
                onClick={() => rotate.mutate()}
                disabled={rotate.isPending}
              >
                <RefreshCw aria-hidden="true" />
                Reset link
              </Button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
