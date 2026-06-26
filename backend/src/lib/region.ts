/**
 * Region defaults. Circle the date is built US- and Canada-first (a "soft"
 * default: the product still works anywhere, but unset/ambiguous inputs lean
 * North American). One source of truth so the User model and the signup route
 * stay in step.
 *
 * The app auto-detects the device's IANA zone and sends it on signup
 * (`app/src/providers/auth-provider.tsx`), so this fallback only applies when a
 * client can't report one. Eastern time is the most populous US/CA zone, which
 * makes it the least-surprising default.
 */
export const DEFAULT_TIMEZONE = 'America/New_York';
