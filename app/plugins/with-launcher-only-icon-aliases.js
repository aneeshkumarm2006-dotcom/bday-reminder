const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

/**
 * Strips everything but MAIN/LAUNCHER from the dated icon aliases.
 *
 * `@howincodes/expo-dynamic-app-icon` builds one `<activity-alias>` per icon and
 * copies MainActivity's whole set of intent-filters onto each - including the
 * `circlethedate://` VIEW filter. An alias only needs to be *launchable*; the
 * deep link belongs to MainActivity, which every alias already targets.
 *
 * Left alone, the moment an alias is enabled two enabled components advertise
 * the same scheme, and Android answers a `circlethedate://` link with an "Open
 * with" chooser instead of resolving it. That would land on the Google sign-in
 * return, the Gmail/Google-import returns and invite links - i.e. the dynamic
 * icon would quietly break sign-in.
 *
 * Config-plugin manifest mods run in reverse array order, so this is listed
 * BEFORE the icon plugin in app.json in order to run AFTER it - verified by
 * prebuilding and grepping the aliases, not assumed.
 */
const withLauncherOnlyIconAliases = (config) =>
  withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    const prefix = `${cfg.android?.package ?? ''}.MainActivity`;
    for (const alias of app['activity-alias'] ?? []) {
      if (!alias.$?.['android:name']?.startsWith(prefix)) continue;
      alias['intent-filter'] = (alias['intent-filter'] ?? []).filter((filter) =>
        (filter.action ?? []).some(
          (a) => a.$?.['android:name'] === 'android.intent.action.MAIN',
        ),
      );
    }

    return cfg;
  });

module.exports = withLauncherOnlyIconAliases;
