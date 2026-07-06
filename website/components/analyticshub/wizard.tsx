"use client";

/**
 * First-run wizard: confirm the auto-detected project identity → connect sources
 * (the same cards as Settings; all skippable) → Overview. There is no password
 * step — login is the shared /seoteam session the owner already used to get here.
 */
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { apiPost, useStatus } from "./api-client";
import { ConnectionCards } from "./connection-card";

function StepDots({ step }: { step: number }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      {[1, 2].map((n) => (
        <span
          key={n}
          className={cn("h-1.5 w-8 rounded-full", n <= step ? "bg-biro" : "bg-border-strong")}
        />
      ))}
    </div>
  );
}

export function SetupWizard() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: status } = useStatus();

  const [step, setStep] = useState(1);
  const [seeded, setSeeded] = useState(false);
  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2c4bd8");
  const [accentColor, setAccentColor] = useState("#2e8b82");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the form from the detected project once status loads.
  useEffect(() => {
    if (status && !seeded) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setName(status.project.name);
      setPrimaryColor(status.project.primaryColor);
      setAccentColor(status.project.accentColor);
      setSeeded(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [status, seeded]);

  async function saveProject() {
    setLoading(true);
    setError(null);
    try {
      await apiPost("setup", { name, primaryColor, accentColor });
      await qc.invalidateQueries({ queryKey: ["ahub"] });
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-4">
      <StepDots step={step} />
      {step === 1 ? (
        <Card className="p-6">
          <h1 className="font-display text-2xl font-semibold text-ink">Set up your analytics hub</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Confirm the basics — you can change these any time in Settings.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveProject();
            }}
            className="mt-5 space-y-4"
          >
            <div>
              <Label>Project name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="flex gap-4">
              <div>
                <Label>Primary color</Label>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-11 w-16 cursor-pointer rounded-md border border-border-strong bg-surface"
                  aria-label="Primary color"
                />
              </div>
              <div>
                <Label>Accent color</Label>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-11 w-16 cursor-pointer rounded-md border border-border-strong bg-surface"
                  aria-label="Accent color"
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className={cn(buttonVariants())}>
              {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
              Continue
            </button>
            {error && <p className="text-sm text-danger-fg">{error}</p>}
          </form>
        </Card>
      ) : (
        <div>
          <div className="mb-4">
            <h1 className="font-display text-2xl font-semibold text-ink">Connect your sources</h1>
            <p className="mt-1 text-sm text-ink-secondary">
              Connect what you use now — you can add the rest later. All of this is optional.
            </p>
          </div>
          {status && <ConnectionCards status={status} />}
          <div className="mt-6 flex items-center gap-3">
            <button type="button" onClick={() => router.push("/analyticshub")} className={cn(buttonVariants())}>
              Go to Overview →
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
