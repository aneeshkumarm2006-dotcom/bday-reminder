import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { gmailApi } from './api';

/**
 * Gmail send-as connect flow (Stage 14). Opens the backend-issued Google consent
 * URL in an in-app auth session; the backend stores the token and redirects to
 * the `circlethedate://gmail-connected?status=ok|error` deep link, which resolves
 * `openAuthSessionAsync`. We only read the status - the token never touches the
 * app. Callers should refresh the user (GET /me) afterward to pick up the new
 * `gmailConnected` flag.
 */

const RETURN_URL = 'circlethedate://gmail-connected';

export type GmailConnectResult = 'connected' | 'dismissed' | 'error';

export async function connectGmail(): Promise<GmailConnectResult> {
  const { url } = await gmailApi.connectUrl();
  const result = await WebBrowser.openAuthSessionAsync(url, RETURN_URL);
  if (result.type !== 'success' || !result.url) {
    // 'cancel' / 'dismiss' = the user backed out; anything else is a failure.
    return result.type === 'cancel' || result.type === 'dismiss' ? 'dismissed' : 'error';
  }
  const status = Linking.parse(result.url).queryParams?.status;
  return status === 'ok' ? 'connected' : 'error';
}
