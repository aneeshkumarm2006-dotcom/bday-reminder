/**
 * GET status — what the client boots from. Reports the env/config health with
 * messages that name the fix (secret key, database, login, Google OAuth), plus
 * each source's connected / not-connected / reconnect-needed state and label.
 */
import { connectDb } from "@/lib/blog/db";

import * as config from "../config";
import { cryptoReady, secretKeyStatus } from "../crypto";
import { isDbConfigured, isGoogleOAuthConfigured, isLoginConfigured } from "../env";
import { SOURCE_ORDER } from "../metrics";
import type { SourceConnection, SourceStatus, StatusPayload } from "../types";
import { json } from "./respond";

async function databaseCheck(): Promise<{ ok: boolean; message?: string }> {
  if (!isDbConfigured()) {
    return {
      ok: false,
      message: "MONGODB_URI is not set. Reuse the backend cluster; add it to website/.env.local.",
    };
  }
  try {
    await connectDb();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return { ok: false, message: `Database connection failed: ${message}` };
  }
}

async function sourceConnection(
  key: SourceConnection["key"],
  dbOk: boolean,
): Promise<SourceConnection> {
  const reconnect = async (): Promise<SourceStatus | null> =>
    (await config.needsReconnect(key)) ? "reconnect_needed" : null;

  switch (key) {
    case "users":
      return { key, status: dbOk ? "ok" : "error" };
    case "ga4": {
      const sel = await config.getGoogleSelection();
      if (!cryptoReady() || !(await config.isGoogleConnected()) || !sel.propertyId) {
        return { key, status: "not_connected" };
      }
      return { key, status: (await reconnect()) ?? "ok", label: sel.propertyLabel ?? sel.propertyId };
    }
    case "gsc": {
      const sel = await config.getGoogleSelection();
      if (!cryptoReady() || !(await config.isGoogleConnected()) || !sel.siteUrl) {
        return { key, status: "not_connected" };
      }
      return { key, status: (await reconnect()) ?? "ok", label: sel.siteUrl };
    }
    case "meta": {
      if (!cryptoReady() || !(await config.isMetaConnected())) {
        return { key, status: "not_connected" };
      }
      const sel = await config.getMetaSelection();
      return { key, status: (await reconnect()) ?? "ok", label: sel.accountName ?? sel.accountId };
    }
    case "gads": {
      if (!cryptoReady() || !(await config.isGadsConnected())) {
        return { key, status: "not_connected" };
      }
      const creds = await config.getGadsCreds();
      return { key, status: (await reconnect()) ?? "ok", label: creds?.customerId };
    }
    default:
      return { key, status: "not_connected" };
  }
}

export async function handleStatus(): Promise<Response> {
  const [project, setupComplete, database] = await Promise.all([
    config.getProject(),
    config.isSetupComplete(),
    databaseCheck(),
  ]);

  const sources = await Promise.all(
    SOURCE_ORDER.map((key) => sourceConnection(key, database.ok)),
  );

  const oauthAvailable = isGoogleOAuthConfigured();
  const payload: StatusPayload = {
    authed: true,
    setupComplete,
    project,
    checks: {
      secretKey: secretKeyStatus(),
      database,
      login: isLoginConfigured()
        ? { ok: true }
        : {
            ok: false,
            message:
              "Dashboard login is not configured — set SEO_DASHBOARD_PASSWORD and a 32+ character SESSION_SECRET.",
          },
      googleOAuth: {
        available: oauthAvailable,
        ok: true,
        message: oauthAvailable
          ? undefined
          : "Google sign-in is unavailable (GOOGLE_OAUTH_* not set). You can still connect Google with a service-account JSON.",
      },
    },
    sources,
  };
  return json(payload);
}
