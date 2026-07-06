"use client";

import { AlertTriangle, PlugZap } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Friendly full-page "not connected" card with a link to settings. */
export function ConnectPrompt({ title, description }: { title: string; description?: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-biro-tint text-biro">
        <PlugZap size={22} aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-secondary">
          {description ?? "Add credentials in settings to see data here."}
        </p>
      </div>
      <Link href="/analyticshub/settings" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
        Connect in settings →
      </Link>
    </Card>
  );
}

/** Error / reconnect state showing the provider's verbatim message. */
export function ErrorState({ message, reconnect }: { message?: string; reconnect?: boolean }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full",
          reconnect ? "bg-warn-bg text-warn-fg" : "bg-danger-bg text-danger-fg",
        )}
      >
        <AlertTriangle size={22} aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">
          {reconnect ? "Reconnect needed" : "Something went wrong"}
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-secondary">
          {message ?? "Try again in a moment."}
        </p>
      </div>
      <Link
        href="/analyticshub/settings"
        className={cn(buttonVariants({ variant: reconnect ? "primary" : "secondary", size: "sm" }))}
      >
        {reconnect ? "Reconnect in settings →" : "Open settings"}
      </Link>
    </Card>
  );
}
