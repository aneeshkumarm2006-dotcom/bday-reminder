import { render as rtlRender } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { ThemeProvider } from '@/theme/theme-provider';

/**
 * Test render helper (TODO Stage 13): wraps a component in the app's
 * ThemeProvider so `useTokens()` (and any other theme hook) resolves, mirroring
 * how every screen mounts under `_layout.tsx`.
 */
function Wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

export function renderWithTheme(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Wrapper });
}

export * from '@testing-library/react-native';
