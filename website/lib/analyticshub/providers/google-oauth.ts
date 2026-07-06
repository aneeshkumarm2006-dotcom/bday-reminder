/**
 * Shared-app Google OAuth for the hub (GA4 + Search Console). Raw fetch, no SDK —
 * modeled on backend/src/lib/google-oauth.ts. `access_type=offline` +
 * `prompt=consent` force a refresh token even on re-grants. A revoked token
 * surfaces as `invalid_grant`, which we tag `reconnect` so the source flips to
 * "reconnect_needed" rather than erroring opaquely.
 */
import { getGoogleOAuthConfig } from "../env";
import { ProviderError } from "./errors";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_READ_SCOPES =
  "https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly";

/** The callback the shared OAuth app must have registered for this origin. */
export function googleRedirectUri(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/analyticshub/api/oauth/google/callback`;
}

interface GoogleErrorBody {
  error?: string | { message?: string };
  error_description?: string;
}

function googleErrorMessage(json: GoogleErrorBody | null): string | undefined {
  if (!json) return undefined;
  if (json.error_description) return json.error_description;
  if (typeof json.error === "string") return json.error;
  if (json.error && typeof json.error === "object") return json.error.message;
  return undefined;
}

export function buildConsentUrl(origin: string, state: string): string {
  const cfg = getGoogleOAuthConfig();
  if (!cfg) {
    throw new ProviderError(
      "Google sign-in is unavailable — set GOOGLE_OAUTH_CLIENT_ID and " +
        "GOOGLE_OAUTH_CLIENT_SECRET (then redeploy), or connect via a service account.",
    );
  }
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: googleRedirectUri(origin),
    response_type: "code",
    scope: `openid email ${GOOGLE_READ_SCOPES}`,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

export async function exchangeCode(origin: string, code: string): Promise<GoogleTokenResponse> {
  const cfg = getGoogleOAuthConfig();
  if (!cfg) throw new ProviderError("Google OAuth is not configured.");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: googleRedirectUri(origin),
      grant_type: "authorization_code",
    }).toString(),
  });
  const json = (await res.json().catch(() => null)) as (GoogleTokenResponse & GoogleErrorBody) | null;
  if (!res.ok || !json?.access_token) {
    throw new ProviderError(
      googleErrorMessage(json) ?? `Google token exchange failed (${res.status}).`,
    );
  }
  return json;
}

/** Exchange a stored refresh token for a short-lived access token. */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const cfg = getGoogleOAuthConfig();
  if (!cfg) throw new ProviderError("Google OAuth is not configured.");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const json = (await res.json().catch(() => null)) as
    | (GoogleTokenResponse & GoogleErrorBody)
    | null;
  if (!res.ok || !json?.access_token) {
    const reconnect = json?.error === "invalid_grant";
    throw new ProviderError(
      googleErrorMessage(json) ?? `Google token refresh failed (${res.status}).`,
      { reconnect },
    );
  }
  return json.access_token;
}
