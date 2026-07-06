/**
 * Normalized data shapes for the analytics hub. Every provider maps its upstream
 * response into a `SourceResult` so the UI never needs to know which API a number
 * came from. Both server and client import these — keep this file to pure types
 * (no node:crypto / mongoose), so it is safe in a client bundle.
 */

export type SourceKey = "ga4" | "gsc" | "meta" | "gads" | "users";

/** Connection / fetch state for a single source. */
export type SourceStatus = "ok" | "not_connected" | "reconnect_needed" | "error";

/** One daily data point in the tidy/long series format the charts consume. */
export interface SeriesPoint {
  source: SourceKey;
  metric: string;
  /** ISO calendar day, "YYYY-MM-DD" (UTC). */
  date: string;
  value: number;
}

/** A generic detail-table column (top pages / queries / sources / signups). */
export interface DetailColumn {
  key: string;
  label: string;
  /** How the UI renders this column's cells. Defaults to "text". */
  format?:
    | "text"
    | "number"
    | "percent"
    | "currency"
    | "duration"
    | "position"
    | "date";
  /** Right-align + tabular-nums for numeric columns. */
  numeric?: boolean;
}

export interface DetailTable {
  key: string;
  title: string;
  columns: DetailColumn[];
  rows: Array<Record<string, string | number>>;
}

/**
 * The normalized envelope every `GET data/*` route returns for a source.
 * `totals` / `previous` are keyed by metric id; `previous` covers the immediately
 * preceding equal-length period so KPI cards can compute a delta without a second
 * request.
 */
export interface SourceResult {
  source: SourceKey;
  status: SourceStatus;
  series: SeriesPoint[];
  totals: Record<string, number>;
  previous: Record<string, number>;
  detail?: DetailTable[];
  /** Verbatim provider text when status is "error" / "reconnect_needed". */
  error?: string;
  /** ISO timestamp the data was produced (fresh fetch or cache write). */
  fetchedAt?: string;
  /** True when this envelope was served from the 6h cache. */
  cached?: boolean;
}

/** `GET data/all` returns one envelope per source. */
export type AllData = Partial<Record<SourceKey, SourceResult>>;

/** Project identity (name + brand colors), editable in Settings / the wizard. */
export interface ProjectIdentity {
  name: string;
  primaryColor: string;
  accentColor: string;
}

/** Per-source connection summary surfaced by `GET status`. */
export interface SourceConnection {
  key: SourceKey;
  status: SourceStatus;
  /** Human label of what is connected, e.g. a GA4 property or Meta account. */
  label?: string;
}

/** A single env/config check with a message that names the fix. */
export interface HealthCheck {
  ok: boolean;
  message?: string;
}

/** The full `GET status` payload the client boots from. */
export interface StatusPayload {
  authed: boolean;
  setupComplete: boolean;
  project: ProjectIdentity;
  checks: {
    secretKey: HealthCheck;
    database: HealthCheck;
    login: HealthCheck;
    googleOAuth: HealthCheck & { available: boolean };
  };
  sources: SourceConnection[];
}
