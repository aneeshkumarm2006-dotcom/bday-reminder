/**
 * Token storage for the web app. The native app uses expo-secure-store
 * (Keychain/Keystore); the browser has no equivalent, so — matching the Expo
 * web build — we keep the JWT pair in localStorage. Guarded for SSR, where
 * `window` is undefined (the auth provider only reads tokens client-side).
 */

const ACCESS_KEY = "circle_access_token";
const REFRESH_KEY = "circle_refresh_token";

export type Tokens = { accessToken: string; refreshToken: string };

const hasStorage = (): boolean => typeof window !== "undefined" && !!window.localStorage;

export async function saveTokens(tokens: Tokens): Promise<void> {
  if (!hasStorage()) return;
  window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export async function loadTokens(): Promise<Tokens | null> {
  if (!hasStorage()) return null;
  const accessToken = window.localStorage.getItem(ACCESS_KEY);
  const refreshToken = window.localStorage.getItem(REFRESH_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  if (!hasStorage()) return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}
