"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/**
 * Imperative confirm dialog for destructive actions (DESIGN.md §10). Call
 * `confirm({ title, ... })` and await a boolean. One dialog at a time.
 */

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConfirmOptions | null>(null);
  const resolver = React.useRef<((value: boolean) => void) | null>(null);

  const confirm = React.useCallback((options: ConfirmOptions) => {
    setState(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Dialog open onClose={() => settle(false)} title={state.title} description={state.message}>
          <div className="mt-2 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => settle(false)}>
              {state.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={state.destructive ? "destructive" : "primary"}
              onClick={() => settle(true)}
            >
              {state.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </Dialog>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>.");
  return ctx;
}
