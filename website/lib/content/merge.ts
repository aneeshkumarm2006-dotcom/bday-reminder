/**
 * The golden rule of the admin panel: **hardcoded defaults, DB overrides**.
 *
 * The public site must build and render perfectly with no database configured
 * (the same graceful pattern as `LatestPosts` on the homepage). Every read of
 * admin-managed content therefore runs the stored document through `deepMerge`
 * over a typed default, so a half-filled — or corrupt, or legacy-shaped — Mongo
 * doc can never blank a section of the marketing site.
 *
 * Fallback rules, per field type:
 *   - `undefined` / `null` override → keep the default (this is what makes a
 *     "Reset to default" button a simple `$unset`).
 *   - strings → an empty/whitespace-only override falls back to the default.
 *   - numbers → non-finite falls back.
 *   - booleans → only `undefined`/`null` falls back, so `false` is honoured
 *     (otherwise "hide this section" could never be saved).
 *   - arrays → replace wholesale, and an **empty array is honoured** (removing
 *     every nav link or bullet has to be possible). Only a non-array override
 *     falls back.
 *   - objects → recurse key-by-key over the *default's* keys only, which also
 *     makes the defaults a whitelist: unknown DB fields are dropped rather than
 *     leaking into the render.
 */

type Plain = Record<string, unknown>;

function isPlainObject(value: unknown): value is Plain {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deepMerge<T>(defaults: T, override: unknown): T {
  if (override === undefined || override === null) return defaults;

  // A default of null/undefined marks a nullable field (e.g. announcement dates)
  // — there is no shape to merge against, so take the override as-is.
  if (defaults === null || defaults === undefined) return override as T;

  if (Array.isArray(defaults)) {
    return (Array.isArray(override) ? override : defaults) as T;
  }

  if (isPlainObject(defaults)) {
    if (!isPlainObject(override)) return defaults;
    const out: Plain = { ...defaults };
    for (const key of Object.keys(defaults)) {
      if (key in override) {
        out[key] = deepMerge((defaults as Plain)[key], override[key]);
      }
    }
    return out as T;
  }

  if (typeof defaults === "string") {
    return (typeof override === "string" && override.trim() !== ""
      ? override
      : defaults) as T;
  }
  if (typeof defaults === "number") {
    return (typeof override === "number" && Number.isFinite(override)
      ? override
      : defaults) as T;
  }
  if (typeof defaults === "boolean") {
    return (typeof override === "boolean" ? override : defaults) as T;
  }
  return defaults;
}

/**
 * Merge a whole list of override items over defaults matched by `id`, keeping
 * the override's order. Items whose id (and type) match nothing in the defaults
 * fall back to `templateFor(item)` — used by the landing editor so a section
 * added or reordered in the admin still renders with every key present.
 * Returns the defaults when the override isn't a usable, non-empty array.
 */
export function mergeById<T extends { id: string }>(
  defaults: T[],
  raw: unknown,
  templateFor: (item: Plain) => T | null,
): T[] {
  if (!Array.isArray(raw)) return defaults;
  const byId = new Map(defaults.map((d) => [d.id, d]));
  const out: T[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) continue;
    const id = typeof item.id === "string" ? item.id : "";
    const base = (id && byId.get(id)) || templateFor(item);
    if (!base) continue; // unknown type → drop rather than render garbage
    const merged = deepMerge(base, item);
    out.push(id ? { ...merged, id } : merged);
  }
  return out.length > 0 ? out : defaults;
}
