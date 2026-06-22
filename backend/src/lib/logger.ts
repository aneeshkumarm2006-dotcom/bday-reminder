/* eslint-disable no-console */
// The single sanctioned place to write to the console. Swap for pino/winston later.
export const logger = {
  info: (...args: unknown[]) => console.log('[api]', ...args),
  warn: (...args: unknown[]) => console.warn('[api]', ...args),
  error: (...args: unknown[]) => console.error('[api]', ...args),
};
