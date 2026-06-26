"use client";

import type { ReactNode } from "react";

import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";

/**
 * Client-side providers shared across the whole site so the auth session is a
 * single source of truth from the marketing pages through login into the app
 * (no re-hydration when navigating /login → /dashboard). Query caches per-user
 * data; Toast/Confirm back the app's feedback + destructive-action flows.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
