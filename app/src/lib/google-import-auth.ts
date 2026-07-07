import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { googleImportApi } from './api';

/**
 * Google Calendar + Contacts import connect flow (Stage 16). Mirrors the Gmail
 * connect flow: opens the backend-issued Google consent URL in an in-app auth
 * session; the backend stores the refresh token and redirects to the
 * `circlethedate://google-import-connected?status=ok|error` deep link, which
 * resolves `openAuthSessionAsync`. We only read the status - the token never
 * touches the app. Callers refresh the user (GET /me) afterward to pick up the new
 * `googleImportConnected` flag, then call `googleImportApi.preview()`.
 *
 * Crucially, this consent is triggered ONLY when the user starts an import - never
 * at login - so the calendar/contacts permission is requested just-in-time.
 */

const RETURN_URL = 'circlethedate://google-import-connected';

export type GoogleImportConnectResult = 'connected' | 'dismissed' | 'error';

export async function connectGoogleImport(): Promise<GoogleImportConnectResult> {
  const { url } = await googleImportApi.connectUrl();
  const result = await WebBrowser.openAuthSessionAsync(url, RETURN_URL);
  if (result.type !== 'success' || !result.url) {
    // 'cancel' / 'dismiss' = the user backed out; anything else is a failure.
    return result.type === 'cancel' || result.type === 'dismiss' ? 'dismissed' : 'error';
  }
  const status = Linking.parse(result.url).queryParams?.status;
  return status === 'ok' ? 'connected' : 'error';
}
