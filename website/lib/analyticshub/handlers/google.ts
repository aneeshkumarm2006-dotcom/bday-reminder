/**
 * Google (GA4 + Search Console) connection handlers. OAuth start → consent
 * redirect; callback → store encrypted refresh token then redirect back to
 * settings. Options lists GA4 properties + GSC sites; select/service-account
 * validate with a 1-row probe before saving; every save/disconnect busts the
 * ga4 + gsc caches. All third-party errors surface verbatim.
 */
import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { bustSource } from "../cache";
import * as config from "../config";
import { toProviderFailure } from "../providers/errors";
import { listGa4Properties, probeGa4 } from "../providers/ga4";
import { listGscSites, probeGsc } from "../providers/gsc";
import { buildConsentUrl, exchangeCode } from "../providers/google-oauth";
import { getSaAccessToken, parseServiceAccount } from "../providers/google-sa";
import { getGoogleAccessToken } from "../providers/google-token";
import { json, origin, readBody } from "./respond";

function settingsUrl(req: Request): URL {
  return new URL("/analyticshub/settings", new URL(req.url).origin);
}

/** GET oauth/google/start — full-page redirect to Google consent. */
export async function handleGoogleStart(req: Request): Promise<Response> {
  try {
    const state = randomBytes(16).toString("hex");
    await config.saveOAuthState(state);
    return NextResponse.redirect(buildConsentUrl(origin(req), state));
  } catch (err) {
    const url = settingsUrl(req);
    url.searchParams.set("error", toProviderFailure(err).message);
    return NextResponse.redirect(url);
  }
}

/** GET oauth/google/callback — exchange code, store refresh token, redirect. */
export async function handleGoogleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const settings = settingsUrl(req);
  const providerError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (providerError) {
    settings.searchParams.set("error", `Google: ${providerError}`);
    return NextResponse.redirect(settings);
  }
  if (!code || !state || !(await config.consumeOAuthState(state))) {
    settings.searchParams.set("error", "Invalid or expired sign-in attempt. Please try again.");
    return NextResponse.redirect(settings);
  }

  try {
    const token = await exchangeCode(origin(req), code);
    if (!token.refresh_token) {
      throw new Error(
        "Google did not return a refresh token. Remove this app at " +
          "myaccount.google.com/permissions, then reconnect.",
      );
    }
    await config.setGoogleOAuthCreds({
      refreshToken: token.refresh_token,
      scope: token.scope,
      connectedAt: new Date().toISOString(),
    });
    await config.clearReconnect("ga4");
    await config.clearReconnect("gsc");
    await bustSource("ga4");
    await bustSource("gsc");
    settings.searchParams.set("connected", "google");
  } catch (err) {
    settings.searchParams.set("error", toProviderFailure(err).message);
  }
  return NextResponse.redirect(settings);
}

/** GET google/options — property + site dropdowns for whichever mode is active. */
export async function handleGoogleOptions(): Promise<Response> {
  if (!(await config.isGoogleConnected())) {
    return json({ mode: null, selection: {}, properties: [], sites: [] });
  }
  try {
    const token = await getGoogleAccessToken();
    const [propertiesResult, sitesResult, selection, mode] = await Promise.all([
      listGa4Properties(token).then(
        (properties) => ({ properties }),
        (err) => ({ properties: [], error: toProviderFailure(err).message }),
      ),
      listGscSites(token).then(
        (sites) => ({ sites }),
        (err) => ({ sites: [], error: toProviderFailure(err).message }),
      ),
      config.getGoogleSelection(),
      config.getGoogleMode(),
    ]);
    return json({
      mode,
      selection,
      properties: propertiesResult.properties,
      propertiesError: "error" in propertiesResult ? propertiesResult.error : undefined,
      sites: sitesResult.sites,
      sitesError: "error" in sitesResult ? sitesResult.error : undefined,
    });
  } catch (err) {
    return json({ error: toProviderFailure(err).message }, 400);
  }
}

interface SelectBody {
  propertyId?: string;
  propertyLabel?: string;
  siteUrl?: string;
}

/** POST google/select — validate + save the chosen property/site (OAuth mode). */
export async function handleGoogleSelect(req: Request): Promise<Response> {
  const body = (await readBody<SelectBody>(req)) ?? {};
  if (!body.propertyId && !body.siteUrl) {
    return json({ error: "Choose a GA4 property and/or a Search Console site." }, 400);
  }
  try {
    const token = await getGoogleAccessToken();
    if (body.propertyId) await probeGa4(token, body.propertyId);
    if (body.siteUrl) await probeGsc(token, body.siteUrl);
    await config.setGoogleSelection({
      propertyId: body.propertyId,
      propertyLabel: body.propertyLabel,
      siteUrl: body.siteUrl,
    });
    await bustSource("ga4");
    await bustSource("gsc");
    return json({ ok: true });
  } catch (err) {
    return json({ error: toProviderFailure(err).message }, 400);
  }
}

interface ServiceAccountBody extends SelectBody {
  keyJson?: string;
}

/** POST google/service-account — validate SA key + selection, then save. */
export async function handleGoogleServiceAccount(req: Request): Promise<Response> {
  const body = (await readBody<ServiceAccountBody>(req)) ?? {};
  if (!body.keyJson) return json({ error: "Paste the service-account key JSON." }, 400);
  if (!body.propertyId && !body.siteUrl) {
    return json({ error: "Enter a GA4 property ID and/or a Search Console site URL." }, 400);
  }
  try {
    const creds = parseServiceAccount(body.keyJson);
    const token = await getSaAccessToken(creds);
    if (body.propertyId) await probeGa4(token, body.propertyId);
    if (body.siteUrl) await probeGsc(token, body.siteUrl);
    await config.setGoogleSACreds(creds);
    await config.setGoogleSelection({
      propertyId: body.propertyId,
      propertyLabel: body.propertyLabel ?? body.propertyId,
      siteUrl: body.siteUrl,
    });
    await config.clearReconnect("ga4");
    await config.clearReconnect("gsc");
    await bustSource("ga4");
    await bustSource("gsc");
    return json({ ok: true });
  } catch (err) {
    return json({ error: toProviderFailure(err).message }, 400);
  }
}

export async function handleGoogleDisconnect(): Promise<Response> {
  await config.disconnectGoogle();
  await bustSource("ga4");
  await bustSource("gsc");
  return json({ ok: true });
}
