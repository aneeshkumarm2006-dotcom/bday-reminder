// App entry (TODO Stage 10). Expo Router's default entry boots the app; we then
// register the Android home-screen widget's background task handler. Metro
// resolves `./src/widget/register` to `register.android.ts` on Android (real
// registration) and `register.ts` elsewhere (no-op), so neither iOS nor web
// ever bundles the Android widget library.
import 'expo-router/entry';

import { registerWidget } from './src/widget/register';

registerWidget();
