import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { useFloatingShadow } from '@/theme/theme-provider';

import { Button } from './button';
import { Text } from './text';

/**
 * Confirm dialog (DESIGN.md §8.9, §10). Destructive confirms use the danger
 * color and state the consequence plainly. Exposed as an imperative
 * `confirm({...})` returning a promise so callers can `await` a yes/no.
 */

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Filled danger confirm button + danger framing. */
  destructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const shadow = useFloatingShadow();
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setState({ options, resolve })),
    [],
  );

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const opts = state?.options;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal visible={!!state} transparent animationType="fade" onRequestClose={() => close(false)}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-6"
          onPress={() => close(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={shadow}
            className="w-full max-w-[400px] rounded-xl bg-surface p-5">
            <Text variant="heading">{opts?.title ?? ''}</Text>
            {opts?.message ? (
              <Text variant="body" className="mt-2 text-ink-secondary">
                {opts.message}
              </Text>
            ) : null}
            <View className="mt-5 flex-row justify-end gap-2">
              <Button variant="ghost" onPress={() => close(false)}>
                {opts?.cancelLabel ?? 'Cancel'}
              </Button>
              {opts?.destructive ? (
                <Pressable
                  onPress={() => close(true)}
                  accessibilityRole="button"
                  className="min-h-[44px] flex-row items-center justify-center rounded-md bg-danger-fg px-4 active:scale-[0.98]">
                  <Text variant="button" className="text-paper">
                    {opts?.confirmLabel ?? 'Delete'}
                  </Text>
                </Pressable>
              ) : (
                <Button onPress={() => close(true)}>{opts?.confirmLabel ?? 'Confirm'}</Button>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>.');
  return ctx;
}
