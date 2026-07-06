"use client";

import { useStatus } from "@/components/analyticshub/api-client";
import { Overview } from "@/components/analyticshub/overview";
import { KpiSkeleton } from "@/components/analyticshub/skeleton";
import { SetupWizard } from "@/components/analyticshub/wizard";

export default function AnalyticsHubOverviewPage() {
  const { data, isLoading } = useStatus();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (data && !data.setupComplete) return <SetupWizard />;
  return <Overview />;
}
