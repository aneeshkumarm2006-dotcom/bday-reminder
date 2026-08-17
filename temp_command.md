# Android — run & build commands

All commands run from the `app/` folder:

```bash
cd "C:/Users/anees/Desktop/Bday reminder app and site/app"
```

---

## 0. Before a production build (do these once / each release)

**a) Bump `versionCode`.** `app.json` says version `1.0.3` but `versionCode` is still `4`,
which is what 1.0.2 shipped with — Play rejects a duplicate. The `production` profile has
`autoIncrement: true`, but with `appVersionSource: "local"` **and** an `app.config.js`
present, EAS often can't write the bump back into a dynamic config. Do it by hand:

- Edit `app.json` line 34 → `"versionCode": 5`
- Verify:

```bash
npx expo config --type public --json | grep -o '"versionCode":[0-9]*'
```

**b) Confirm `GOOGLE_SERVICES_JSON` exists on EAS.** `google-services.json` is gitignored,
so it is NOT in the archive EAS uploads. Missing it = push notifications silently dead
(this is what shipped in 1.0.2). Check first, create only if absent:

```bash
npx eas env:list --scope project
```

```bash
npx eas env:create --scope project --name GOOGLE_SERVICES_JSON \
  --type file --visibility secret --value ./google-services.json
```

---

## 1. Pre-flight

```bash
npm run typecheck
npm test
npm run lint
npx expo-doctor
```

---

## 2. Run locally

The app needs a **development build** — Expo Go will not work. It uses native modules Expo Go
doesn't ship: `react-native-keyboard-controller`, `@howincodes/expo-dynamic-app-icon`,
`react-native-android-widget`, `expo-secure-store`.

One-time — build the dev client and install it on the phone/emulator:

```bash
npx eas build --profile development --platform android
```

Then every session:

```bash
npx expo start
```

```bash
npx expo start --clear      # after app.json / plugin / metro changes
```

`.env` → `EXPO_PUBLIC_API_URL` drives local runs. On a **physical device** this must be your
machine's LAN IP (e.g. `http://192.168.1.20:4040`), not `localhost`. Builds ignore `.env` —
all three EAS profiles hardcode the Render API URL.

---

## 3. Build

Internal APK — sideload onto a device to test the real binary:

```bash
npx eas build --profile preview --platform android
```

Play Store AAB:

```bash
npx eas build --profile production --platform android
```

---

## 4. Submit to Play

```bash
npx eas submit --profile production --platform android --latest
```

---

## 5. Optional — build natively on this machine

`android/` does not exist yet (managed prebuild flow). This generates it:

```bash
npx expo prebuild --clean
```

```bash
npx expo run:android
```

---

## Notes

- `app.json` line 3 still reads `"name": "Circle the date"` — that's the store-facing
  display name. Deliberate per the rename (identifiers kept), but worth a conscious call
  before uploading.
- Keyboard avoidance (`react-native-keyboard-controller`) only works in a dev/EAS build.
  If a screen doesn't lift in Expo Go, that's the reason — not the code.
