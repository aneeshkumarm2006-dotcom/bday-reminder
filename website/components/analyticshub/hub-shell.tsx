"use client";

/**
 * Root of the sidebar app. Owns the React Query client + the date-range/refresh
 * context that every page reads, and lays out the sidebar (desktop) / horizontal
 * strip (mobile) + shared topbar. Rendered by app/analyticshub/layout.tsx.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { useState } from "react";

import { useStatus } from "./api-client";
import { DateRangeProvider } from "./date-range-context";
import { HubNav } from "./sidebar";
import { Topbar } from "./topbar";

function HubBrand() {
  const { data } = useStatus();
  const name = data?.project.name ?? "Analytics";
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-biro text-paper">
        <BarChart3 size={16} aria-hidden />
      </span>
      <span className="truncate font-display text-sm font-semibold text-ink">{name}</span>
    </div>
  );
}

export function HubShell({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DateRangeProvider>
        <div className="min-h-screen bg-paper text-ink">
          <div className="mx-auto flex w-full max-w-[1440px]">
            <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-4 border-r border-border-subtle px-3 py-4 md:flex">
              <HubBrand />
              <HubNav orientation="vertical" />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <div className="border-b border-border-subtle px-3 py-2 md:hidden">
                <div className="overflow-x-auto">
                  <HubNav orientation="horizontal" />
                </div>
              </div>
              <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6">{children}</main>
            </div>
          </div>
        </div>
      </DateRangeProvider>
    </QueryClientProvider>
  );
}
