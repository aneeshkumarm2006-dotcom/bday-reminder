/**
 * Service-account (2-legged) Google auth — the "paste a JSON key" path for GA4 +
 * Search Console. Builds and RS256-signs a JWT assertion with node:crypto (no
 * SDK) and exchanges it at the token endpoint. Access tokens are cached in memory
 * for their lifetime, keyed by the service-account email.
 */
import { createSign } from "node:crypto";

import type { GoogleSACreds } from "../config";
import { GOOGLE_READ_SCOPES } from "./google-oauth";
import { ProviderError } from "./errors";

const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

/** Parse a pasted service-account key JSON into the fields we store. */
export function parseServiceAccount(raw: string): GoogleSACreds {
  let obj: { client_email?: string; private_key?: string; token_uri?: string };
  try {
    obj = JSON.parse(raw) as typeof obj;
  } catch {
    throw new ProviderError("Service-account key must be valid JSON (the whole file).");
  }
  if (!obj.client_email || !obj.private_key) {
    throw new ProviderError(
      "Service-account JSON is missing client_email or private_key — paste the full key file.",
    );
  }
  return {
    clientEmail: obj.client_email,
    privateKey: obj.private_key,
    tokenUri: obj.token_uri ?? DEFAULT_TOKEN_URI,
  };
}

interface CachedToken {
  token: string;
  exp: number;
}
const tokenCache = new Map<string, CachedToken>();

interface SaTokenBody {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export async function getSaAccessToken(creds: GoogleSACreds): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const cached = tokenCache.get(creds.clientEmail);
  if (cached && cached.exp - 60 > now) return cached.token;

  const tokenUri = creds.tokenUri || DEFAULT_TOKEN_URI;
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: creds.clientEmail,
    scope: GOOGLE_READ_SCOPES,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  // Operators often paste the key with literal "\n" — normalize to real newlines.
  const privateKey = creds.privateKey.replace(/\\n/g, "\n");

  let signature: string;
  try {
    signature = createSign("RSA-SHA256").update(signingInput).sign(privateKey, "base64url");
  } catch {
    throw new ProviderError(
      "Service-account private_key is invalid — paste the full PEM including the " +
        "BEGIN/END lines and newlines.",
    );
  }
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  const json = (await res.json().catch(() => null)) as SaTokenBody | null;
  if (!res.ok || !json?.access_token) {
    const msg = json?.error_description || json?.error || `SA token grant failed (${res.status}).`;
    throw new ProviderError(msg);
  }
  tokenCache.set(creds.clientEmail, {
    token: json.access_token,
    exp: now + (json.expires_in ?? 3600),
  });
  return json.access_token;
}
