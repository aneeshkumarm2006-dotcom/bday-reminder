import * as AppleAuthentication from 'expo-apple-authentication';

import { authApi, type AppleSessionResponse } from './api';

/**
 * "Sign in with Apple" (identity login) - the app-side half of the backend's
 * POST /auth/apple/session. Required by App Store Guideline 4.8 because the app
 * also offers "Continue with Google".
 *
 * Much shorter than the Google flow (google-auth.ts): there is no consent URL,
 * no in-app browser and no deep-link return. Apple's native sheet runs in-process
 * and hands back a signed identity token, which we post straight to the server.
 *
 * The one sharp edge is that Apple returns `fullName` and `email` ONLY on the
 * very first authorization for this app. Every later sign-in omits them, so we
 * forward whatever we get and let the server fall back to the stored account
 * (it matches on Apple's stable `sub`, not the email).
 */

export type AppleSignInStatus = 'ok' | 'dismissed' | 'unavailable' | 'error';

export type AppleSignInResult =
  | { status: 'ok'; session: AppleSessionResponse }
  | { status: 'dismissed' | 'unavailable' | 'error' };

/** True on hardware that can present the Apple sheet (iOS 13+). */
export async function isAppleSignInAvailable(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (err) {
    // Apple reports a user-cancelled sheet as ERR_REQUEST_CANCELED; treat it as
    // a silent dismissal rather than an error worth showing.
    const code = (err as { code?: string })?.code;
    if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') {
      return { status: 'dismissed' };
    }
    return { status: 'error' };
  }

  if (!credential.identityToken) return { status: 'error' };

  try {
    const session = await authApi.appleSession({
      identityToken: credential.identityToken,
      // Both are null after the first authorization - the server handles that.
      fullName: credential.fullName
        ? {
            givenName: credential.fullName.givenName,
            familyName: credential.fullName.familyName,
          }
        : null,
      email: credential.email,
    });
    return { status: 'ok', session };
  } catch {
    // A rejected token or a network failure - either way, retryable.
    return { status: 'error' };
  }
}
