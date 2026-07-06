"use client";

import { Suspense } from "react";

import { Settings } from "@/components/analyticshub/settings";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <Settings />
    </Suspense>
  );
}
