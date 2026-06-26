/// <reference types="nativewind/types" />

// Declare CSS side-effect imports (e.g. `import '@/global.css'`). Expo also
// declares this in expo/types, but that's reached only via the gitignored
// expo-env.d.ts, which CI never regenerates before `tsc` runs — so without
// this line CI fails with TS2882 under TypeScript 6.0+.
declare module '*.css';
