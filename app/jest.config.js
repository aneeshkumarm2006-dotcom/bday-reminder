// Jest config for the Expo app component tests (TODO Stage 13).
// `jest-expo` provides the babel transform (babel-preset-expo + NativeWind +
// reanimated/worklets), the RN module mocks, and a sane transformIgnorePatterns.
// We add the `@/` path alias and our own setup (reanimated + AsyncStorage mocks).
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  // jest-expo ships a default transformIgnorePatterns covering RN/Expo packages;
  // extend it so the ESM-published UI deps are transformed too.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|lucide-react-native|nativewind|react-native-css-interop|react-native-reanimated|react-native-worklets|react-native-gesture-handler))',
  ],
};
