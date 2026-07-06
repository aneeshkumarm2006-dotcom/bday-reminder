"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDay, formatMetricValue, fullNumber } from "@/lib/analyticshub/format";
import type { DetailColumn, DetailTable as DetailTableData } from "@/lib/analyticshub/types";

function renderCell(value: string | number, format: DetailColumn["format"]): string {
  if (typeof value === "string" && (!format || format === "text")) return value;
  if (format === "date") {
    return typeof value === "string" && value ? formatDay(value.slice(0, 10), true) : "—";
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  switch (format) {
    case "number":
      return fullNumber(n);
    case "percent":
      return `${(n * 100).toFixed(2)}%`;
    case "currency":
      return formatMetricValue(n, "currency");
    case "duration":
      return formatMetricValue(n, "duration");
    case "position":
      return n.toFixed(1);
    default:
      return String(value);
  }
}

/** Generic detail table (top pages / queries / sources / recent signups). */
export function DetailTable({ table }: { table: DetailTableData }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border-subtle px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">{table.title}</h3>
      </div>
      {table.rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-muted">No data for this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                {table.columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn("px-4 py-2 font-medium", col.numeric && "text-right")}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i} className="border-t border-border-subtle hover:bg-surface-sunken">
                  {table.columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-2 text-ink",
                        col.numeric ? "text-right tabular-nums" : "max-w-[22rem] truncate",
                      )}
                      title={!col.numeric ? String(row[col.key] ?? "") : undefined}
                    >
                      {renderCell(row[col.key] ?? "", col.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
