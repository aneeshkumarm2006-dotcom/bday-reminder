"use client";

/**
 * Settings view: config health notices (each message names the fix), the project
 * card, and the connection cards. Also handles the Google OAuth return
 * (?connected / ?error) by refreshing status and showing a banner.
 */
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Card } from "@/components/ui/card";
import type { HealthCheck } from "@/lib/analyticshub/types";

import { useStatus } from "./api-client";
import { ConnectionCards, ProjectCard } from "./connection-card";
import { KpiSkeleton } from "./skeleton";

function Notice({
  tone,
  children,
}: {
  tone: "danger" | "warn" | "info" | "ok";
  children: React.ReactNode;
}) {
  const map = {
    danger: { cls: "bg-danger-bg text-danger-fg", Icon: AlertTriangle },
    warn: { cls: "bg-warn-bg text-warn-fg", Icon: AlertTriangle },
    info: { cls: "bg-surface-sunken text-ink-secondary", Icon: Info },
    ok: { cls: "bg-ok-bg text-ok-fg", Icon: CheckCircle2 },
  }[tone];
  const Icon = map.Icon;
  return (
    <div className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${map.cls}`}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export function Settings() {
  const { data: status, isLoading } = useStatus();
  const params = useSearchParams();
  const qc = useQueryClient();
  const connected = params.get("connected");
  const oauthError = params.get("error");

  useEffect(() => {
    if (connected) void qc.invalidateQueries({ queryKey: ["ahub"] });
  }, [connected, qc]);

  if (isLoading || !status) {
    return (
      <div className="space-y-4">
        <KpiSkeleton />
        <KpiSkeleton />
      </div>
    );
  }

  const failing: Array<{ tone: "danger" | "warn"; check: HealthCheck }> = [];
  if (!status.checks.secretKey.ok) failing.push({ tone: "danger", check: status.checks.secretKey });
  if (!status.checks.database.ok) failing.push({ tone: "danger", check: status.checks.database });
  if (!status.checks.login.ok) failing.push({ tone: "warn", check: status.checks.login });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Connect your data sources and set your project identity.
        </p>
      </header>

      {(oauthError || connected || failing.length > 0 || !status.checks.googleOAuth.available) && (
        <div className="space-y-2">
          {oauthError && <Notice tone="danger">{oauthError}</Notice>}
          {connected === "google" && <Notice tone="ok">Google connected — pick a property and site below.</Notice>}
          {failing.map((f, i) => (
            <Notice key={i} tone={f.tone}>
              {f.check.message}
            </Notice>
          ))}
          {!status.checks.googleOAuth.available && status.checks.googleOAuth.message && (
            <Notice tone="info">{status.checks.googleOAuth.message}</Notice>
          )}
        </div>
      )}

      <ProjectCard project={status.project} />
      <ConnectionCards status={status} />

      <Card className="p-5">
        <h3 className="font-display text-base font-semibold text-ink">Login</h3>
        <p className="mt-1 text-sm text-ink-secondary">
          This hub uses the same password as your <span className="font-medium">/seoteam</span>{" "}
          dashboard. To change it, update <code className="text-xs">SEO_DASHBOARD_PASSWORD</code> in
          your environment and redeploy.
        </p>
      </Card>
    </div>
  );
}
