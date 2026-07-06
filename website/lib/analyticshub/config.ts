/**
 * Typed accessors over the config store. Credentials are encrypted (crypto.ts)
 * before storage and decrypted on read; project identity, source selections, and
 * status flags are plain JSON (not secret). Keeping every key in one place here
 * makes disconnect (which must clear creds + selection + reconnect flag) obvious.
 */
import { siteConfig } from "@/lib/site";

import { decryptJson, encryptJson } from "./crypto";
import { del, getRaw, setRaw } from "./store";
import type { ProjectIdentity, SourceKey } from "./types";

const K = {
  project: "project",
  googleMode: "google:mode",
  googleOAuth: "google:oauth",
  googleSA: "google:sa",
  googleSelection: "google:selection",
  metaCreds: "meta:creds",
  metaSelection: "meta:selection",
  gadsCreds: "gads:creds",
  reconnect: (s: SourceKey) => `reconnect:${s}`,
  oauthState: (state: string) => `oauthstate:${state}`,
} as const;

// ── Project identity ────────────────────────────────────────────────────────
export const DEFAULT_PROJECT: ProjectIdentity = {
  name: siteConfig.name,
  primaryColor: "#2c4bd8", // --biro
  accentColor: "#2e8b82", // --cal-custom
};

export async function getProject(): Promise<ProjectIdentity> {
  const raw = await getRaw(K.project);
  if (!raw) return DEFAULT_PROJECT;
  try {
    return { ...DEFAULT_PROJECT, ...(JSON.parse(raw) as Partial<ProjectIdentity>) };
  } catch {
    return DEFAULT_PROJECT;
  }
}

export async function setProject(project: ProjectIdentity): Promise<void> {
  await setRaw(K.project, JSON.stringify(project));
}

/** Setup is "complete" once the owner has saved (or confirmed) project identity. */
export async function isSetupComplete(): Promise<boolean> {
  return (await getRaw(K.project)) !== null;
}

// ── Google (GA4 + GSC) ──────────────────────────────────────────────────────
export type GoogleMode = "oauth" | "sa";

export interface GoogleOAuthCreds {
  refreshToken: string;
  scope?: string;
  connectedAt: string;
}

export interface GoogleSACreds {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
}

export interface GoogleSelection {
  propertyId?: string;
  propertyLabel?: string;
  siteUrl?: string;
}

export async function getGoogleMode(): Promise<GoogleMode | null> {
  const v = await getRaw(K.googleMode);
  return v === "oauth" || v === "sa" ? v : null;
}

export async function getGoogleOAuthCreds(): Promise<GoogleOAuthCreds | null> {
  const raw = await getRaw(K.googleOAuth);
  if (!raw) return null;
  try {
    return decryptJson<GoogleOAuthCreds>(raw);
  } catch {
    return null;
  }
}

export async function setGoogleOAuthCreds(creds: GoogleOAuthCreds): Promise<void> {
  await setRaw(K.googleOAuth, encryptJson(creds));
  await setRaw(K.googleMode, "oauth");
}

export async function getGoogleSACreds(): Promise<GoogleSACreds | null> {
  const raw = await getRaw(K.googleSA);
  if (!raw) return null;
  try {
    return decryptJson<GoogleSACreds>(raw);
  } catch {
    return null;
  }
}

export async function setGoogleSACreds(creds: GoogleSACreds): Promise<void> {
  await setRaw(K.googleSA, encryptJson(creds));
  await setRaw(K.googleMode, "sa");
}

export async function getGoogleSelection(): Promise<GoogleSelection> {
  const raw = await getRaw(K.googleSelection);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as GoogleSelection;
  } catch {
    return {};
  }
}

export async function setGoogleSelection(selection: GoogleSelection): Promise<void> {
  await setRaw(K.googleSelection, JSON.stringify(selection));
}

export async function isGoogleConnected(): Promise<boolean> {
  return (await getGoogleMode()) !== null;
}

export async function disconnectGoogle(): Promise<void> {
  await del(K.googleOAuth);
  await del(K.googleSA);
  await del(K.googleMode);
  await del(K.googleSelection);
  await clearReconnect("ga4");
  await clearReconnect("gsc");
}

// ── Meta Ads ────────────────────────────────────────────────────────────────
export interface MetaCreds {
  token: string;
}

export interface MetaSelection {
  accountId?: string;
  accountName?: string;
}

export async function getMetaCreds(): Promise<MetaCreds | null> {
  const raw = await getRaw(K.metaCreds);
  if (!raw) return null;
  try {
    return decryptJson<MetaCreds>(raw);
  } catch {
    return null;
  }
}

export async function setMetaCreds(creds: MetaCreds): Promise<void> {
  await setRaw(K.metaCreds, encryptJson(creds));
}

export async function getMetaSelection(): Promise<MetaSelection> {
  const raw = await getRaw(K.metaSelection);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as MetaSelection;
  } catch {
    return {};
  }
}

export async function setMetaSelection(selection: MetaSelection): Promise<void> {
  await setRaw(K.metaSelection, JSON.stringify(selection));
}

export async function isMetaConnected(): Promise<boolean> {
  const creds = await getMetaCreds();
  const selection = await getMetaSelection();
  return Boolean(creds && selection.accountId);
}

export async function disconnectMeta(): Promise<void> {
  await del(K.metaCreds);
  await del(K.metaSelection);
  await clearReconnect("meta");
}

// ── Google Ads ──────────────────────────────────────────────────────────────
export interface GadsCreds {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string;
}

export async function getGadsCreds(): Promise<GadsCreds | null> {
  const raw = await getRaw(K.gadsCreds);
  if (!raw) return null;
  try {
    return decryptJson<GadsCreds>(raw);
  } catch {
    return null;
  }
}

export async function setGadsCreds(creds: GadsCreds): Promise<void> {
  await setRaw(K.gadsCreds, encryptJson(creds));
}

export async function isGadsConnected(): Promise<boolean> {
  return (await getGadsCreds()) !== null;
}

export async function disconnectGads(): Promise<void> {
  await del(K.gadsCreds);
  await clearReconnect("gads");
}

// ── Reconnect flags (sticky until reconnect) ────────────────────────────────
export async function markReconnect(source: SourceKey): Promise<void> {
  await setRaw(K.reconnect(source), "1");
}

export async function clearReconnect(source: SourceKey): Promise<void> {
  await del(K.reconnect(source));
}

export async function needsReconnect(source: SourceKey): Promise<boolean> {
  return (await getRaw(K.reconnect(source))) === "1";
}

// ── OAuth state nonce (single-use, short TTL) ───────────────────────────────
export async function saveOAuthState(state: string, ttlSeconds = 600): Promise<void> {
  await setRaw(K.oauthState(state), "1", ttlSeconds);
}

export async function consumeOAuthState(state: string): Promise<boolean> {
  const v = await getRaw(K.oauthState(state));
  if (v) await del(K.oauthState(state));
  return Boolean(v);
}
