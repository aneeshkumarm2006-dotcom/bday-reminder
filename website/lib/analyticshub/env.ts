/**
 * Server-only env readers for the analytics hub. NEVER throws — `GET status`
 * relies on these to report configuration problems with messages that name the
 * fix, rather than crashing with a vague 500. The three hub-specific secrets are
 * ANALYTICSHUB_SECRET_KEY (credential encryption, validated in crypto.ts) and the
 * shared Google OAuth pair below. MONGODB_URI / SESSION_SECRET / SEO_DASHBOARD_
 * PASSWORD are reused from the existing dashboard.
 */
import { isDbConfigured } from "@/lib/blog/db";

export { isDbConfigured };

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
}

/** The shared Google OAuth app credentials, or null when not configured. */
export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGoogleOAuthConfigured(): boolean {
  return getGoogleOAuthConfig() !== null;
}

/**
 * The hub reuses the /seoteam shared-password login. This mirrors
 * `isDashboardConfigured()` so `GET status` can flag a missing login secret.
 */
export function isLoginConfigured(): boolean {
  const secret = process.env.SESSION_SECRET;
  return Boolean(process.env.SEO_DASHBOARD_PASSWORD && secret && secret.length >= 32);
}
