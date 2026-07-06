"use client";

/**
 * Connection cards — one per source, shared by Settings and the first-run wizard.
 * Every save performs a live validation call server-side and surfaces the
 * provider's verbatim error; a credential is never stored unless it works. The
 * Google card covers GA4 + Search Console (OAuth or a service-account key).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SourceConnection, SourceStatus, StatusPayload } from "@/lib/analyticshub/types";

import { apiGet, apiPost } from "./api-client";

// ── shared bits ─────────────────────────────────────────────────────────────
const BADGE: Record<SourceStatus, { label: string; className: string }> = {
  ok: { label: "Connected", className: "bg-ok-bg text-ok-fg" },
  not_connected: { label: "Not connected", className: "bg-surface-sunken text-ink-muted" },
  reconnect_needed: { label: "Reconnect needed", className: "bg-warn-bg text-warn-fg" },
  error: { label: "Error", className: "bg-danger-bg text-danger-fg" },
};

function StatusBadge({ status }: { status: SourceStatus }) {
  const b = BADGE[status];
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", b.className)}>{b.label}</span>;
}

function CardShell({
  title,
  hint,
  status,
  children,
}: {
  title: string;
  hint?: string;
  status?: SourceStatus;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
        {status && <StatusBadge status={status} />}
      </div>
      {hint && <p className="mb-3 text-sm text-ink-muted">{hint}</p>}
      {children}
    </Card>
  );
}

function Feedback({ error, success }: { error?: string | null; success?: string | null }) {
  if (!error && !success) return null;
  return (
    <p className={cn("mt-2 text-sm", error ? "text-danger-fg" : "text-ok-fg")}>{error ?? success}</p>
  );
}

function useAction() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function run(fn: () => Promise<void>, okMessage?: string) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await fn();
      setSuccess(okMessage ?? "Saved.");
      await qc.invalidateQueries({ queryKey: ["ahub"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }
  return { loading, error, success, run, setError };
}

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={loading} className={cn(buttonVariants({ size: "sm" }))}>
      {loading && <Loader2 size={15} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

function Disconnect({ path, label = "Disconnect" }: { path: string; label?: string }) {
  const { loading, run } = useAction();
  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void run(() => apiPost(path), "Disconnected.")}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
    >
      {label}
    </button>
  );
}

function Collapsible({ summary, children }: { summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm font-medium text-biro hover:underline"
      >
        <ChevronDown size={15} className={cn("transition-transform", open && "rotate-180")} aria-hidden />
        {summary}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

// ── Google (GA4 + Search Console) ───────────────────────────────────────────
interface GoogleOptions {
  mode: "oauth" | "sa" | null;
  selection: { propertyId?: string; propertyLabel?: string; siteUrl?: string };
  properties: Array<{ property: string; label: string }>;
  sites: string[];
  propertiesError?: string;
  sitesError?: string;
}

function GoogleCard({ status, oauthAvailable }: { status: StatusPayload["sources"]; oauthAvailable: boolean }) {
  const ga4 = status.find((s) => s.key === "ga4")?.status ?? "not_connected";
  const gsc = status.find((s) => s.key === "gsc")?.status ?? "not_connected";
  const combined: SourceStatus =
    ga4 === "reconnect_needed" || gsc === "reconnect_needed"
      ? "reconnect_needed"
      : ga4 === "ok" || gsc === "ok"
        ? "ok"
        : "not_connected";

  const options = useQuery({
    queryKey: ["ahub", "google-options"],
    queryFn: () => apiGet<GoogleOptions>("google/options"),
    staleTime: 15_000,
  });
  const data = options.data;
  const connected = Boolean(data?.mode);

  const select = useAction();
  const sa = useAction();
  const [propertyId, setPropertyId] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [keyJson, setKeyJson] = useState("");

  // Sync the form to the fetched selection once it loads (mount-time hydration).
  useEffect(() => {
    if (!data?.selection) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPropertyId(data.selection.propertyId ?? "");
    setSiteUrl(data.selection.siteUrl ?? "");
  }, [data?.selection]);

  return (
    <CardShell
      title="Google — Analytics & Search Console"
      hint="Sign in with Google or paste a service-account key, then pick a GA4 property and a Search Console site."
      status={combined}
    >
      {options.isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : connected ? (
        <div className="space-y-4">
          <div>
            <Label>GA4 property</Label>
            {data && data.properties.length > 0 ? (
              <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} aria-label="GA4 property">
                <option value="">— none —</option>
                {data.properties.map((p) => (
                  <option key={p.property} value={p.property}>
                    {p.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                placeholder="properties/123456789"
              />
            )}
            {data?.propertiesError && <p className="mt-1 text-xs text-warn-fg">{data.propertiesError}</p>}
          </div>
          <div>
            <Label>Search Console site</Label>
            {data && data.sites.length > 0 ? (
              <Select value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} aria-label="Search Console site">
                <option value="">— none —</option>
                {data.sites.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            ) : (
              <Input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://example.com/" />
            )}
            {data?.sitesError && <p className="mt-1 text-xs text-warn-fg">{data.sitesError}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={select.loading}
              onClick={() =>
                void select.run(() => {
                  const label = data?.properties.find((p) => p.property === propertyId)?.label;
                  return apiPost("google/select", { propertyId, propertyLabel: label, siteUrl });
                }, "Selection saved.")
              }
              className={cn(buttonVariants({ size: "sm" }))}
            >
              {select.loading && <Loader2 size={15} className="animate-spin" aria-hidden />}
              Save selection
            </button>
            <Disconnect path="google/disconnect" />
          </div>
          <Feedback error={select.error} success={select.success} />
        </div>
      ) : (
        <div className="space-y-3">
          {oauthAvailable ? (
            <button
              type="button"
              onClick={() => {
                window.location.href = "/analyticshub/api/oauth/google/start";
              }}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Sign in with Google
            </button>
          ) : (
            <p className="rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink-muted">
              Google sign-in is unavailable (GOOGLE_OAUTH_* not set). Use a service-account key below.
            </p>
          )}

          <Collapsible summary="Use a service-account key instead">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sa.run(
                  () => apiPost("google/service-account", { keyJson, propertyId, siteUrl }),
                  "Connected.",
                );
              }}
              className="space-y-3"
            >
              <div>
                <Label>Service-account key JSON</Label>
                <Textarea
                  value={keyJson}
                  onChange={(e) => setKeyJson(e.target.value)}
                  placeholder='{ "type": "service_account", ... }'
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label>GA4 property ID</Label>
                <Input value={propertyId} onChange={(e) => setPropertyId(e.target.value)} placeholder="properties/123456789" />
              </div>
              <div>
                <Label>Search Console site URL</Label>
                <Input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://example.com/" />
              </div>
              <SubmitButton loading={sa.loading}>Validate & connect</SubmitButton>
              <Feedback error={sa.error} success={sa.success} />
            </form>
          </Collapsible>
        </div>
      )}
    </CardShell>
  );
}

// ── Meta Ads ────────────────────────────────────────────────────────────────
function MetaCard({ status }: { status: SourceConnection }) {
  const validate = useAction();
  const save = useAction();
  const [token, setToken] = useState("");
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [accountId, setAccountId] = useState("");

  if (status.status === "ok") {
    return (
      <CardShell title="Meta Ads" status={status.status}>
        <p className="mb-3 text-sm text-ink-secondary">
          Connected{status.label ? ` · ${status.label}` : ""}.
        </p>
        <Disconnect path="meta/disconnect" />
      </CardShell>
    );
  }

  return (
    <CardShell
      title="Meta Ads"
      hint="Paste a long-lived access token with the ads_read permission, then choose an ad account."
      status={status.status}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void validate.run(async () => {
            const res = await apiPost<{ accounts: Array<{ id: string; name: string }> }>("meta/validate", {
              token,
            });
            setAccounts(res.accounts);
            setAccountId(res.accounts[0]?.id ?? "");
          }, "Token valid — pick an account.");
        }}
        className="space-y-3"
      >
        <div>
          <Label>Access token</Label>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="EAAB…"
          />
        </div>
        <SubmitButton loading={validate.loading}>Validate token</SubmitButton>
        <Feedback error={validate.error} success={accounts.length ? null : validate.success} />
      </form>

      {accounts.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-border-subtle pt-4">
          <div>
            <Label>Ad account</Label>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Ad account">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.id})
                </option>
              ))}
            </Select>
          </div>
          <button
            type="button"
            disabled={save.loading}
            onClick={() =>
              void save.run(() => {
                const name = accounts.find((a) => a.id === accountId)?.name;
                return apiPost("meta/select", { token, accountId, accountName: name });
              }, "Connected.")
            }
            className={cn(buttonVariants({ size: "sm" }))}
          >
            {save.loading && <Loader2 size={15} className="animate-spin" aria-hidden />}
            Save account
          </button>
          <Feedback error={save.error} success={save.success} />
        </div>
      )}
    </CardShell>
  );
}

// ── Google Ads ──────────────────────────────────────────────────────────────
const GADS_FIELDS = [
  { key: "developerToken", label: "Developer token", type: "password" },
  { key: "clientId", label: "OAuth client ID", type: "text" },
  { key: "clientSecret", label: "OAuth client secret", type: "password" },
  { key: "refreshToken", label: "Refresh token", type: "password" },
  { key: "customerId", label: "Customer ID (10 digits)", type: "text" },
  { key: "loginCustomerId", label: "Login customer ID (MCC, optional)", type: "text" },
] as const;

function GoogleAdsCard({ status }: { status: SourceConnection }) {
  const save = useAction();
  const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  if (status.status === "ok" && !editing) {
    return (
      <CardShell title="Google Ads" status={status.status}>
        <p className="mb-3 text-sm text-ink-secondary">
          Connected{status.label ? ` · customer ${status.label}` : ""}.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            Update credentials
          </button>
          <Disconnect path="gads/disconnect" />
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell
      title="Google Ads"
      hint="Advanced. Needs a developer token, an OAuth client, a refresh token, and the customer ID."
      status={status.status}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(() => apiPost("gads/save", form), "Connected.");
        }}
        className="space-y-3"
      >
        {GADS_FIELDS.map((f) => (
          <div key={f.key}>
            <Label>{f.label}</Label>
            <Input
              type={f.type}
              value={form[f.key] ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
          </div>
        ))}
        <div className="flex gap-2">
          <SubmitButton loading={save.loading}>Validate & connect</SubmitButton>
          {editing && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Cancel
            </button>
          )}
        </div>
        <Feedback error={save.error} success={save.success} />
      </form>
    </CardShell>
  );
}

// ── Users ───────────────────────────────────────────────────────────────────
function UsersCard({ status }: { status: SourceConnection }) {
  return (
    <CardShell title="Users" status={status.status}>
      <p className="flex items-start gap-2 text-sm text-ink-secondary">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok-fg" aria-hidden />
        {status.status === "ok"
          ? "Reads signups straight from your app database — no setup needed."
          : "The database is not reachable. Check MONGODB_URI, then reload."}
      </p>
    </CardShell>
  );
}

// ── Project identity ────────────────────────────────────────────────────────
export function ProjectCard({ project }: { project: StatusPayload["project"] }) {
  const { loading, error, success, run } = useAction();
  const [name, setName] = useState(project.name);
  const [primaryColor, setPrimaryColor] = useState(project.primaryColor);
  const [accentColor, setAccentColor] = useState(project.accentColor);

  return (
    <CardShell title="Project">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => apiPost("project", { name, primaryColor, accentColor }), "Saved.");
        }}
        className="space-y-3"
      >
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex gap-4">
          <div>
            <Label>Primary</Label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-11 w-16 cursor-pointer rounded-md border border-border-strong bg-surface"
              aria-label="Primary color"
            />
          </div>
          <div>
            <Label>Accent</Label>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-11 w-16 cursor-pointer rounded-md border border-border-strong bg-surface"
              aria-label="Accent color"
            />
          </div>
        </div>
        <SubmitButton loading={loading}>Save</SubmitButton>
        <Feedback error={error} success={success} />
      </form>
    </CardShell>
  );
}

// ── Container ────────────────────────────────────────────────────────────────
export function ConnectionCards({ status }: { status: StatusPayload }) {
  const bySource = new Map(status.sources.map((s) => [s.key, s]));
  const fallback = (key: SourceConnection["key"]): SourceConnection =>
    bySource.get(key) ?? { key, status: "not_connected" };

  return (
    <div className="space-y-4">
      <GoogleCard status={status.sources} oauthAvailable={status.checks.googleOAuth.available} />
      <MetaCard status={fallback("meta")} />
      <GoogleAdsCard status={fallback("gads")} />
      <UsersCard status={fallback("users")} />
    </div>
  );
}
