/** Canned, deterministic data for the analytics-hub visual e2e (no live APIs). */
import { SOURCES } from "../lib/analyticshub/metrics";
import type {
  AllData,
  DetailTable,
  SeriesPoint,
  SourceKey,
  SourceResult,
  StatusPayload,
} from "../lib/analyticshub/types";

const RANGE = { from: "2026-06-30", to: "2026-07-06" };

function days(): string[] {
  const out: string[] = [];
  const end = new Date("2026-07-06T00:00:00.000Z");
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function metricValue(format: string, dayIdx: number, metricIdx: number): number {
  switch (format) {
    case "percent":
      return 0.028 + 0.004 * Math.sin(dayIdx + metricIdx) + 0.001 * metricIdx;
    case "position":
      return 9 - 0.25 * dayIdx + metricIdx * 0.4;
    case "currency":
      return 18 + dayIdx * 5 + metricIdx * 4;
    case "ratio":
      return 1.8 + 0.12 * dayIdx;
    case "duration":
      return 55 + dayIdx * 6;
    default:
      return Math.round(60 + dayIdx * 14 + metricIdx * 9);
  }
}

function detailFor(source: SourceKey): DetailTable[] {
  if (source === "ga4") {
    return [
      {
        key: "topPages",
        title: "Top pages",
        columns: [
          { key: "label", label: "Page" },
          { key: "value", label: "Views", format: "number", numeric: true },
        ],
        rows: ["/", "/pricing", "/blog", "/features", "/contact"].map((p, i) => ({
          label: p,
          value: 900 - i * 130,
        })),
      },
      {
        key: "topSources",
        title: "Top sources",
        columns: [
          { key: "label", label: "Source" },
          { key: "value", label: "Sessions", format: "number", numeric: true },
        ],
        rows: ["google", "(direct)", "bing", "twitter", "newsletter"].map((s, i) => ({
          label: s,
          value: 700 - i * 110,
        })),
      },
    ];
  }
  if (source === "gsc") {
    return [
      {
        key: "topQueries",
        title: "Top queries",
        columns: [
          { key: "query", label: "Query" },
          { key: "clicks", label: "Clicks", format: "number", numeric: true },
          { key: "impressions", label: "Impressions", format: "number", numeric: true },
          { key: "ctr", label: "CTR", format: "percent", numeric: true },
          { key: "position", label: "Position", format: "position", numeric: true },
        ],
        rows: ["birthday reminder app", "remember birthdays", "birthday tracker"].map((q, i) => ({
          query: q,
          clicks: 240 - i * 60,
          impressions: 5200 - i * 900,
          ctr: 0.046 - i * 0.006,
          position: 4.2 + i * 1.1,
        })),
      },
    ];
  }
  if (source === "users") {
    return [
      {
        key: "recentSignups",
        title: "Recent signups",
        columns: [
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "createdAt", label: "Joined", format: "date", numeric: true },
        ],
        rows: ["Ada Lovelace", "Alan Turing", "Grace Hopper", "Katherine Johnson"].map((n, i) => ({
          name: n,
          email: `${n.split(" ")[0].toLowerCase()}@example.com`,
          createdAt: `2026-07-0${6 - i}T10:00:00.000Z`,
        })),
      },
    ];
  }
  return [];
}

// Per-source multiplier so overlaid overview lines are visibly distinct.
const SOURCE_FACTOR: Record<SourceKey, number> = {
  ga4: 1,
  gsc: 0.55,
  meta: 1.3,
  gads: 0.75,
  users: 0.28,
};

function buildSource(source: SourceKey): SourceResult {
  const def = SOURCES.find((s) => s.key === source);
  if (!def) throw new Error(source);
  const d = days();
  const series: SeriesPoint[] = [];
  const totals: Record<string, number> = {};
  const previous: Record<string, number> = {};
  const factor = SOURCE_FACTOR[source];

  def.metrics.forEach((m, mi) => {
    const additive = m.format === "number" || m.format === "currency";
    const values = d.map((date, i) => {
      const raw = metricValue(m.format, i, mi);
      const value = Number((additive ? raw * factor : raw).toFixed(m.format === "percent" ? 4 : 2));
      series.push({ source, metric: m.id, date, value });
      return value;
    });
    const total = additive
      ? values.reduce((a, b) => a + b, 0)
      : values.reduce((a, b) => a + b, 0) / values.length;
    totals[m.id] = Number(total.toFixed(2));
    previous[m.id] = Number((total * 0.88).toFixed(2));
  });

  if (source === "users") totals.totalUsers = 1240;

  return {
    source,
    status: "ok",
    series,
    totals,
    previous,
    detail: detailFor(source),
    fetchedAt: "2026-07-06T20:00:00.000Z",
  };
}

export function buildAll(): { range: typeof RANGE; sources: AllData } {
  const sources: AllData = {};
  for (const s of SOURCES) sources[s.key] = buildSource(s.key);
  return { range: RANGE, sources };
}

export function sourceResponse(source: SourceKey) {
  return { range: RANGE, source: buildSource(source) };
}

export function notConnected(source: SourceKey) {
  return {
    range: RANGE,
    source: { source, status: "not_connected", series: [], totals: {}, previous: {} },
  };
}

const OK_CHECKS: StatusPayload["checks"] = {
  secretKey: { ok: true },
  database: { ok: true },
  login: { ok: true },
  googleOAuth: { available: true, ok: true },
};

export function okStatus(): StatusPayload {
  return {
    authed: true,
    setupComplete: true,
    project: { name: "Circle the date", primaryColor: "#2c4bd8", accentColor: "#2e8b82" },
    checks: OK_CHECKS,
    sources: SOURCES.map((s) => ({
      key: s.key,
      status: "ok",
      label: s.key === "ga4" ? "properties/123456" : s.key === "gsc" ? "https://circlethedate.app/" : undefined,
    })),
  };
}

export function partialStatus(): StatusPayload {
  return {
    ...okStatus(),
    sources: SOURCES.map((s) => ({
      key: s.key,
      status: s.key === "users" ? "ok" : "not_connected",
    })),
  };
}

export function wizardStatus(): StatusPayload {
  return { ...partialStatus(), setupComplete: false };
}
