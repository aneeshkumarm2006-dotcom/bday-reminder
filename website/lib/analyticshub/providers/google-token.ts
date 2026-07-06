/**
 * Resolves a Google access token from whichever mode the owner connected (OAuth
 * refresh token or a service-account key). GA4 + GSC providers depend only on
 * this, staying agnostic to how Google was connected.
 */
import { getGoogleMode, getGoogleOAuthCreds, getGoogleSACreds } from "../config";
import { ProviderError } from "./errors";
import { getSaAccessToken } from "./google-sa";
import { refreshAccessToken } from "./google-oauth";

export async function getGoogleAccessToken(): Promise<string> {
  const mode = await getGoogleMode();
  if (mode === "oauth") {
    const creds = await getGoogleOAuthCreds();
    if (!creds) throw new ProviderError("Google is not connected.", { reconnect: true });
    return refreshAccessToken(creds.refreshToken);
  }
  if (mode === "sa") {
    const creds = await getGoogleSACreds();
    if (!creds) throw new ProviderError("Google service account is not configured.");
    return getSaAccessToken(creds);
  }
  throw new ProviderError("Google is not connected.");
}
