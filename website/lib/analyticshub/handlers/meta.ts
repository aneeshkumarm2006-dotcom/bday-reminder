/**
 * Meta Ads connection handlers. Validate a long-lived token (returns its ad
 * accounts for the dropdown); select saves token + account after re-validating;
 * disconnect clears everything. Never stores an unvalidated token.
 */
import { bustSource } from "../cache";
import * as config from "../config";
import { toProviderFailure } from "../providers/errors";
import { listMetaAccounts, validateMetaToken } from "../providers/meta";
import { json, readBody } from "./respond";

interface ValidateBody {
  token?: string;
}
interface SelectBody {
  token?: string;
  accountId?: string;
  accountName?: string;
}

export async function handleMetaValidate(req: Request): Promise<Response> {
  const body = (await readBody<ValidateBody>(req)) ?? {};
  if (!body.token) return json({ error: "Paste a Meta access token." }, 400);
  try {
    const [name, accounts] = await Promise.all([
      validateMetaToken(body.token),
      listMetaAccounts(body.token),
    ]);
    return json({ ok: true, name, accounts });
  } catch (err) {
    return json({ error: toProviderFailure(err).message }, 400);
  }
}

export async function handleMetaSelect(req: Request): Promise<Response> {
  const body = (await readBody<SelectBody>(req)) ?? {};
  if (!body.token || !body.accountId) {
    return json({ error: "A token and an ad account are required." }, 400);
  }
  try {
    await validateMetaToken(body.token); // never store an unvalidated token
    await config.setMetaCreds({ token: body.token });
    await config.setMetaSelection({ accountId: body.accountId, accountName: body.accountName });
    await config.clearReconnect("meta");
    await bustSource("meta");
    return json({ ok: true });
  } catch (err) {
    return json({ error: toProviderFailure(err).message }, 400);
  }
}

export async function handleMetaDisconnect(): Promise<Response> {
  await config.disconnectMeta();
  await bustSource("meta");
  return json({ ok: true });
}
