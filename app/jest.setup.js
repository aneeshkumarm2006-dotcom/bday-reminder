/* eslint-disable no-undef */
// Jest setup for app component tests (TODO Stage 13).

// Reanimated is mocked via the manual mock in `__mocks__/react-native-reanimated.js`
// (the bundled v4 mock pulls in native worklets and throws under Jest). Jest
// applies a root `__mocks__/` module mock automatically.

// AsyncStorage: in-memory mock (the ThemeProvider hydrates its preference from it).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Safe-area: use the library's official jest mock (zero insets + pass-through
// provider/view) so screen-level components render without a native module.
// Required lazily so the JSX inside the mock isn't hoisted into this factory.
jest.mock('react-native-safe-area-context', () => {
  // The library's mock exposes everything on its default export; re-expose as
  // named exports so `import { useSafeAreaInsets } from …` resolves.
  const mock = require('react-native-safe-area-context/jest/mock');
  return { __esModule: true, ...(mock.default ?? mock) };
});

// Silence the act(...) / animation warnings that the reanimated mock can emit;
// keep real errors visible.
const originalWarn = console.warn;
console.warn = (...args) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('useNativeDriver') || msg.includes('Reduced motion')) return;
  originalWarn(...args);
};
