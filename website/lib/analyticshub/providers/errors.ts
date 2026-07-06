/**
 * Provider error type. `reconnect` marks a credential that has gone bad (revoked
 * Google refresh token, expired Meta token, etc.) so the data layer can flip that
 * one source to "reconnect_needed" — independent of the others.
 */
export class ProviderError extends Error {
  reconnect: boolean;

  constructor(message: string, opts?: { reconnect?: boolean }) {
    super(message);
    this.name = "ProviderError";
    this.reconnect = opts?.reconnect ?? false;
  }
}

/** Narrow an unknown thrown value to a message + reconnect flag. */
export function toProviderFailure(err: unknown): { message: string; reconnect: boolean } {
  if (err instanceof ProviderError) return { message: err.message, reconnect: err.reconnect };
  if (err instanceof Error) return { message: err.message, reconnect: false };
  return { message: "Unexpected error.", reconnect: false };
}
