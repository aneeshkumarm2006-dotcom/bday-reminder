import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFloatingShadow } from '@/theme/theme-provider';

import { Text } from './text';

/**
 * Toasts (DESIGN.md §8.11). Compact, bottom, surface + hairline border + subtle
 * shadow, auto-dismiss ~3s. Slide+fade up (§9). Verb-consistent copy is the
 * caller's job ("Marked as done.", "Snoozed until tomorrow.").
 */

type ToastContextValue = { show: (message: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const shadow = useFloatingShadow();
  const [message, setMessage] = useState<string | null>(null);
  // Held in state (not a ref) so it can be read in the render's style safely.
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(next);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
          ({ finished }) => {
            if (finished) setMessage(null);
          },
        );
      }, 3000);
    },
    [opacity],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Stable identity so consumers that depend on the context value (e.g. a
  // useCallback with `[toast]`) don't re-run every time a toast appears/hides.
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message !== null ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: insets.bottom + 16,
            alignItems: 'center',
            opacity,
            transform: [
              { translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            ],
          }}>
          <View
            className="mx-4 rounded-md border border-border-subtle bg-surface px-4 py-3"
            style={shadow}>
            <Text variant="body">{message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>.');
  return ctx;
}
