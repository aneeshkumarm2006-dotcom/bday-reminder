import type {
  AuditEntry,
  ContentRevision,
  LandingSection,
  LegalDoc,
  LegalDocKey,
  NavigationConfig,
  NotFoundHit,
  PageMeta,
  Redirect,
  SitePage,
  SiteSettings,
} from "./types";

/**
 * Client-side fetch helpers for the admin panel, mirroring
 * `lib/blog/dashboard-api.ts`. The dashboard session is an httpOnly cookie, so
 * same-origin requests carry it automatically — there's no token to thread
 * through. Every endpoint is under `/seoteam/api/**`, which `proxy.ts` gates and
 * each handler re-checks.
 */
async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((data.error as string) || `Request failed (${res.status}).`);
  }
  return data as T;
}

/* ------------------------------ site settings ----------------------------- */

export async function saveSiteSettings(body: SiteSettings): Promise<SiteSettings> {
  const { settings } = await request<{ settings: SiteSettings }>("/seoteam/api/site", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return settings;
}

export async function saveStructuredData(
  body: SiteSettings["structuredData"],
): Promise<SiteSettings> {
  const { settings } = await request<{ settings: SiteSettings }>(
    "/seoteam/api/structured-data",
    { method: "PUT", body: JSON.stringify(body) },
  );
  return settings;
}

/* --------------------------------- landing -------------------------------- */

export async function saveLanding(
  sections: LandingSection[],
  mode: "draft" | "publish",
): Promise<{ sections: LandingSection[] }> {
  return request<{ sections: LandingSection[] }>("/seoteam/api/landing", {
    method: "PUT",
    body: JSON.stringify({ sections, mode }),
  });
}

/* -------------------------------- page meta ------------------------------- */

export async function savePageMeta(body: PageMeta): Promise<PageMeta> {
  const { meta } = await request<{ meta: PageMeta }>("/seoteam/api/meta", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return meta;
}

export async function resetPageMeta(path: string): Promise<void> {
  await request(`/seoteam/api/meta?path=${encodeURIComponent(path)}`, {
    method: "DELETE",
  });
}

/* ------------------------------- navigation ------------------------------- */

export async function saveNavigation(body: NavigationConfig): Promise<NavigationConfig> {
  const { navigation } = await request<{ navigation: NavigationConfig }>(
    "/seoteam/api/navigation",
    { method: "PUT", body: JSON.stringify(body) },
  );
  return navigation;
}

/* ---------------------------------- pages --------------------------------- */

export interface SitePagePayload {
  title: string;
  slug: string;
  status: "draft" | "published";
  publishedAt: string | null;
  blocks: SitePage["blocks"];
  showInSitemap: boolean;
  author: string;
}

export async function createSitePage(body: SitePagePayload): Promise<SitePage> {
  const { page } = await request<{ page: SitePage }>("/seoteam/api/pages", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return page;
}

export async function updateSitePage(
  id: string,
  body: Partial<SitePagePayload>,
): Promise<SitePage> {
  const { page } = await request<{ page: SitePage }>(`/seoteam/api/pages/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return page;
}

export async function deleteSitePage(id: string): Promise<void> {
  await request(`/seoteam/api/pages/${id}`, { method: "DELETE" });
}

export async function duplicateSitePage(id: string): Promise<SitePage> {
  const { page } = await request<{ page: SitePage }>(`/seoteam/api/pages/${id}`, {
    method: "POST",
  });
  return page;
}

/* -------------------------------- redirects ------------------------------- */

export async function createRedirect(body: {
  from: string;
  to: string;
  type: 301 | 302;
  enabled: boolean;
  note: string;
}): Promise<Redirect> {
  const { redirect } = await request<{ redirect: Redirect }>("/seoteam/api/redirects", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return redirect;
}

export async function updateRedirect(
  id: string,
  body: Partial<{ from: string; to: string; type: 301 | 302; enabled: boolean; note: string }>,
): Promise<Redirect> {
  const { redirect } = await request<{ redirect: Redirect }>(
    `/seoteam/api/redirects/${id}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  return redirect;
}

export async function deleteRedirect(id: string): Promise<void> {
  await request(`/seoteam/api/redirects/${id}`, { method: "DELETE" });
}

export async function dismiss404(path: string): Promise<void> {
  await request(`/seoteam/api/404-log?path=${encodeURIComponent(path)}`, {
    method: "DELETE",
  });
}

export async function fetch404Log(): Promise<NotFoundHit[]> {
  const { hits } = await request<{ hits: NotFoundHit[] }>("/seoteam/api/404-log");
  return hits;
}

/* ---------------------------------- legal --------------------------------- */

export async function saveLegalDoc(body: LegalDoc): Promise<LegalDoc> {
  const { doc } = await request<{ doc: LegalDoc }>(`/seoteam/api/legal/${body.key}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return doc;
}

export async function fetchLegalDoc(key: LegalDocKey): Promise<LegalDoc> {
  const { doc } = await request<{ doc: LegalDoc }>(`/seoteam/api/legal/${key}`);
  return doc;
}

/* ---------------------------- revisions & audit --------------------------- */

export async function fetchRevisions(params: {
  entityType?: string;
  entityId?: string;
}): Promise<ContentRevision[]> {
  const qs = new URLSearchParams();
  if (params.entityType) qs.set("entityType", params.entityType);
  if (params.entityId) qs.set("entityId", params.entityId);
  const { revisions } = await request<{ revisions: ContentRevision[] }>(
    `/seoteam/api/revisions?${qs.toString()}`,
  );
  return revisions;
}

export async function restoreRevision(id: string): Promise<void> {
  await request(`/seoteam/api/revisions/${id}/restore`, { method: "POST" });
}

export async function fetchAudit(params: {
  entityType?: string;
  editor?: string;
}): Promise<AuditEntry[]> {
  const qs = new URLSearchParams();
  if (params.entityType) qs.set("entityType", params.entityType);
  if (params.editor) qs.set("editor", params.editor);
  const { entries } = await request<{ entries: AuditEntry[] }>(
    `/seoteam/api/activity?${qs.toString()}`,
  );
  return entries;
}

/* ------------------------------ export / import --------------------------- */

export async function importBundle(bundle: unknown): Promise<{ applied: string[] }> {
  return request<{ applied: string[] }>("/seoteam/api/import", {
    method: "POST",
    body: JSON.stringify(bundle),
  });
}
