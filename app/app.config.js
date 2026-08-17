/**
 * Everything static lives in app.json; this file exists for the one value that
 * cannot: the path to `google-services.json`.
 *
 * Android push is dead without it. `expo-notifications` calls
 * `FirebaseMessaging.getInstance()` under `getExpoPushTokenAsync()`, which
 * throws "Unable to get Firebase Messaging instance. Did you configure
 * `googleServicesFile` path in app config?" when the file was never copied into
 * the native project - and `registerForPushNotifications` swallows that, so the
 * app looks fine while no device ever registers a token. That is what shipped
 * in 1.0.2.
 *
 * The file holds Firebase client credentials and is gitignored, so it is NOT in
 * the archive EAS uploads. On EAS it therefore has to arrive as a *file*
 * environment variable (one-time setup):
 *
 *   eas env:create --scope project --name GOOGLE_SERVICES_JSON \
 *     --type file --visibility secret --value ./google-services.json
 *
 * EAS materialises that as a temp file and puts its path in the env var. Local
 * `expo prebuild` / `expo run:android` falls through to the working copy.
 *
 * No `??` fallback to a placeholder on purpose: if neither source is present we
 * want the build to fail loudly rather than ship another push-less binary.
 */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
