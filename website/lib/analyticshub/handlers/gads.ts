/**
 * Google Ads connection handlers. There is no dropdown — the customer id is
 * entered directly — so `save` validates with a 1-row searchStream probe and
 * stores only on success. `validate` probes without saving.
 */
import { z } from "zod";

import { bustSource } from "../cache";
import * as config from "../config";
import type { GadsCreds } from "../config";
import { toProviderFailure } from "../providers/errors";
import { probeGads } from "../providers/gads";
import { json, readBody } from "./respond";

const gadsSchema = z.object({
  developerToken: z.string().trim().min(1, "Developer token is required."),
  clientId: z.string().trim().min(1, "OAuth client ID is required."),
  clientSecret: z.string().trim().min(1, "OAuth client secret is required."),
  refreshToken: z.string().trim().min(1, "Refresh token is required."),
  customerId: z.string().trim().min(1, "Customer ID is required."),
  loginCustomerId: z.string().trim().optional(),
});

function parse(body: unknown): { creds: GadsCreds } | { error: string } {
  const parsed = gadsSchema.safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid credentials." };
  return { creds: parsed.data };
}

export async function handleGadsValidate(req: Request): Promise<Response> {
  const result = parse(await readBody(req));
  if ("error" in result) return json({ error: result.error }, 400);
  try {
    await probeGads(result.creds);
    return json({ ok: true });
  } catch (err) {
    return json({ error: toProviderFailure(err).message }, 400);
  }
}

export async function handleGadsSave(req: Request): Promise<Response> {
  const result = parse(await readBody(req));
  if ("error" in result) return json({ error: result.error }, 400);
  try {
    await probeGads(result.creds); // never store credentials that fail
    await config.setGadsCreds(result.creds);
    await config.clearReconnect("gads");
    await bustSource("gads");
    return json({ ok: true });
  } catch (err) {
    return json({ error: toProviderFailure(err).message }, 400);
  }
}

export async function handleGadsDisconnect(): Promise<Response> {
  await config.disconnectGads();
  await bustSource("gads");
  return json({ ok: true });
}
