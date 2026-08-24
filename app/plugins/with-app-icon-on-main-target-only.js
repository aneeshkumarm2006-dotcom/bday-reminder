const { withXcodeProject } = require('expo/config-plugins');

/**
 * Keeps the AppIcon asset-catalog settings off the project level, so only the
 * app target compiles an app icon.
 *
 * `@howincodes/expo-dynamic-app-icon` needs three build settings to compile the
 * 31 dated icons - ASSETCATALOG_COMPILER_APPICON_NAME plus the alternates list.
 * It writes them by looping over *every* XCBuildConfiguration in the project:
 *
 *   for (const id of Object.keys(configurations)) { ...set on all three... }
 *
 * That sweep catches the app target's own Debug/Release (which is what it
 * wanted) and also the PBXProject's Debug/Release - the project-level defaults
 * that every target inherits unless it overrides them.
 *
 * A single-target app never notices. This one has a second target: the
 * `Birthdays` WidgetKit extension that `@bacons/apple-targets` generates. It
 * inherits ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon from the project level
 * and has no asset catalog of its own - widgets draw the host app's icon - so
 * actool fails the whole build:
 *
 *   None of the input catalogs contained a matching stickers icon set,
 *   app icon set, or icon stack named "AppIcon".
 *
 * Stripping the three settings from the project-level configurations fixes it
 * without touching the app target's explicit copies, so the dated icons still
 * compile exactly as before.
 *
 * Scoped to the project level rather than to the widget target because a mod
 * cannot see that target: apple-targets adds `Birthdays` after every
 * withXcodeProject mod has run, so logging the target list from inside this one
 * shows only `Circlethedate`, wherever it sits in the plugins array. Clearing
 * the inherited default needs no reference to the target at all, and covers any
 * future extension for free.
 *
 * Mods run in reverse array order, so this is listed BEFORE the icon plugin in
 * app.json in order to run AFTER it - the same inversion, and the same reason,
 * as `with-launcher-only-icon-aliases` next door. Listed after it instead and
 * the icon plugin simply writes the settings back.
 *
 * Verified by prebuilding and mapping each configuration to its target: 4
 * configurations carried the setting before, 2 after - and the 2 that remain
 * are the ones with PRODUCT_BUNDLE_IDENTIFIER = com.circlethedate.app.
 */
const APPICON_BUILD_SETTINGS = [
  'ASSETCATALOG_COMPILER_APPICON_NAME',
  'ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES',
  'ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS',
];

const withAppIconOnMainTargetOnly = (config) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const listId = project.getFirstProject().firstProject.buildConfigurationList;
    const list = project.pbxXCConfigurationList()[listId];
    const buildConfigurations = project.pbxXCBuildConfigurationSection();

    for (const { value } of list?.buildConfigurations ?? []) {
      const settings = buildConfigurations[value]?.buildSettings;
      if (!settings) continue;
      for (const setting of APPICON_BUILD_SETTINGS) delete settings[setting];
    }

    return cfg;
  });

module.exports = withAppIconOnMainTargetOnly;
