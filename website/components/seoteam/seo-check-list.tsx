"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SeoAnalysis, SeoCheckStatus } from "@/lib/blog/types";

const ICONS: Record<SeoCheckStatus, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
};

const COLORS: Record<SeoCheckStatus, string> = {
  pass: "text-ok-fg",
  warn: "text-snz-fg",
  fail: "text-danger-fg",
};

/** Renders the on-page SEO analysis with pass / warn / fail indicators. */
export function SeoCheckList({ analysis }: { analysis: SeoAnalysis }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <SeoReadinessPill analysis={analysis} />
        <span className="text-xs text-ink-muted">
          {analysis.counts.pass} pass · {analysis.counts.warn} warn ·{" "}
          {analysis.counts.fail} fail
        </span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {analysis.checks.map((check) => {
          const Icon = ICONS[check.status];
          return (
            <li key={check.id} className="flex items-start gap-2.5">
              <Icon
                size={18}
                className={cn("mt-0.5 shrink-0", COLORS[check.status])}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{check.label}</p>
                <p className="text-xs text-ink-muted">{check.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Compact "SEO-ready" verdict used in the panel header and the dashboard table. */
export function SeoReadinessPill({ analysis }: { analysis: SeoAnalysis }) {
  const { counts, ready } = analysis;
  const tone = !ready
    ? "bg-danger-bg text-danger-fg"
    : counts.warn > 0
      ? "bg-snz-bg text-snz-fg"
      : "bg-ok-bg text-ok-fg";
  const label = !ready
    ? `${counts.fail} issue${counts.fail === 1 ? "" : "s"}`
    : counts.warn > 0
      ? `${counts.warn} warning${counts.warn === 1 ? "" : "s"}`
      : "SEO-ready";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone,
      )}
    >
      {label}
    </span>
  );
}
