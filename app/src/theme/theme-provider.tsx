import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useNativewindColorScheme } from 'nativewind';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { darkTokens, lightTokens, type Tokens } from './tokens';

/**
 * Dark-mode plumbing (DESIGN.md §11, TODO Stage 2). Defaults to following the
 * device (`system`) but supports a persisted user override. NativeWind's
 * class strategy flips the `.dark` token set; we mirror the resolved scheme
 * here so imperative code (SVG, status bar) can read the active JS `tokens`.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'circle-the-date:theme-preference';

type ThemeContextValue = {
  /** What the user chose: light, dark, or follow-system. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** The resolved scheme actually in effect. */
  scheme: 'light' | 'dark';
  /** Active color tokens (hex) for imperative styling. */
  tokens: Tokens;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { colorScheme, setColorScheme } = useNativewindColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  // Hydrate the saved preference once on mount.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!active) return;
        const next = (saved as ThemePreference | null) ?? 'system';
        setPreferenceState(next);
        setColorScheme(next);
      })
      .catch(() => {
        /* fall back to system default */
      });
    return () => {
      active = false;
    };
  }, [setColorScheme]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    setColorScheme(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const scheme: 'light' | 'dark' = colorScheme === 'dark' ? 'dark' : 'light';
  const tokens = scheme === 'dark' ? darkTokens : lightTokens;

  return (
    <ThemeContext.Provider value={{ preference, setPreference, scheme, tokens }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useThemeContext() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('Theme hooks must be used within <ThemeProvider>.');
  }
  return ctx;
}

/** Full theme controls: preference + resolved scheme + setter. */
export function useThemePreference() {
  return useThemeContext();
}

/** Active color tokens (hex) for SVG, status bar, and other imperative needs. */
export function useTokens(): Tokens {
  return useThemeContext().tokens;
}

/**
 * Elevation for things that genuinely float — popovers, sheets, the mobile
 * action bar (DESIGN.md §5). Cards use borders, never this. Returns a `style`
 * object using the cross-platform `boxShadow` supported by React Native 0.85+.
 */
export function useFloatingShadow(): { boxShadow: string } {
  const { scheme } = useThemeContext();
  return scheme === 'dark'
    ? { boxShadow: '0px 1px 2px rgba(0,0,0,0.4), 0px 8px 24px rgba(0,0,0,0.35)' }
    : { boxShadow: '0px 1px 2px rgba(35,32,32,0.06), 0px 8px 24px rgba(35,32,32,0.06)' };
}
