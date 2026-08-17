import { getAppIcon, setAppIcon, type IconName } from '@howincodes/expo-dynamic-app-icon';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * The launcher icon, circling today's date.
 *
 * Apple's own Calendar icon is drawn live by SpringBoard through a private API
 * no App Store app can reach, so the honest equivalent is 31 pre-baked icons
 * (one per day, cut from the same mark as everything else - see
 * `scripts/generate-icons.mjs`) and a switch to the right one.
 *
 * The catch, and it is inherent rather than a shortcoming of this code: **the
 * icon can only be changed while the app is running.** Neither platform will let
 * a sleeping app repaint itself. So the icon tracks the last day the app was
 * open, not the wall clock - correct for anyone who opens it daily, drifting for
 * anyone who does not. There is no API that fixes that; this is the ceiling.
 *
 * Both platforms are therefore driven off the same moment - the app going to
 * background - which is also the only moment either one is willing to do it:
 *
 *  - iOS switches silently when `isInBackground` is true. Passing false would
 *    pop the "You have changed the icon for…" system alert, every single day.
 *  - Android cannot switch in the foreground at all; the module swaps the
 *    enabled `activity-alias` a few seconds after the app pauses. The launcher
 *    picks the new icon up on its own.
 */

/** `day01` … `day31`, matching the plugin keys generated into app.json. */
function iconNameForToday(now: Date = new Date()): IconName {
  return `day${String(now.getDate()).padStart(2, '0')}` as IconName;
}

/**
 * Point the launcher icon at today, if it isn't already.
 *
 * Reads the current icon first so we only ever write on an actual day change:
 * on Android every write toggles a manifest component, and doing that on each
 * background - rather than once a day - is churn the launcher does not need.
 */
export async function syncAppIconToToday(): Promise<void> {
  try {
    const wanted = iconNameForToday();
    const current = await getAppIcon();
    if (current === wanted) return;
    await setAppIcon(wanted, true);
  } catch {
    // An unsupported device, a launcher that refuses the alias, or a module
    // missing in Expo Go. The icon is decoration - never break a launch over it.
  }
}

/**
 * Keep the icon in step for as long as the app lives. Returns an unsubscribe.
 *
 * Backgrounding is the trigger, plus one sync at startup to catch the case where
 * the app was killed rather than backgrounded on the previous day.
 */
export function startAppIconSync(): () => void {
  void syncAppIconToToday();

  const onChange = (state: AppStateStatus) => {
    // 'inactive' is iOS's transient state (app switcher, an incoming call) and
    // is not a real background - acting on it would fire the change repeatedly.
    if (state === 'background') void syncAppIconToToday();
  };

  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
}
