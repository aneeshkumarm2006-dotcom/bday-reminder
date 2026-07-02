import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { API_URL, authApi, type GoogleSessionResponse } from './api';

/**
 * "Sign in with Google" (identity login) - the app-side half of the backend's
 * /auth/google flow. Opens `/auth/google/start?platform=app` in an in-app auth
 * session; after consent the backend redirects to the
 * `circlethedate://google-login?status=ok&handoff=…` deep link, and we exchange
 * the one-time handoff for the normal JWT pair via POST /auth/google/session.
 * Identity only (name + email) - the Gmail send-as permission stays a separate,
 * later opt-in (gmail-auth.ts).
 */

const RETURN_URL = 'circlethedate://google-login';
const START_URL = `${API_URL}/auth/google/start?platform=app`;

export type GoogleSignInStatus = 'ok' | 'dismissed' | 'unavailable' | 'error';

export type GoogleSignInResult =
  | { status: 'ok'; session: GoogleSessionResponse }
  | { status: 'dismissed' | 'unavailable' | 'error' };

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const result = await WebBrowser.openAuthSessionAsync(START_URL, RETURN_URL);
  if (result.type !== 'success' || !result.url) {
    // 'cancel' / 'dismiss' = the user backed out; anything else is a failure.
    return { status: result.type === 'cancel' || result.type === 'dismiss' ? 'dismissed' : 'error' };
  }
  const params = Linking.parse(result.url).queryParams ?? {};
  if (params.status === 'unavailable') return { status: 'unavailable' };
  const handoff = params.handoff;
  if (params.status !== 'ok' || typeof handoff !== 'string' || handoff.length === 0) {
    return { status: 'error' };
  }
  try {
    const session = await authApi.googleSession(handoff);
    return { status: 'ok', session };
  } catch {
    // Expired/replayed handoff or a network failure - either way, retryable.
    return { status: 'error' };
  }
}
