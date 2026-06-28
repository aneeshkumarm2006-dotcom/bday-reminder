"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { PersonForm } from "@/components/app/person-form";

/** Reads an optional ?month&day prefill (from the Calendar) for the form. */
function NewPersonForm() {
  const params = useSearchParams();
  const month = Number(params.get("month"));
  const day = Number(params.get("day"));
  const initialDate =
    Number.isInteger(month) && month >= 1 && month <= 12 &&
    Number.isInteger(day) && day >= 1 && day <= 31
      ? { month, day }
      : undefined;
  return <PersonForm initialDate={initialDate} />;
}

/** Add a new person (FR-5). Optionally prefilled with a date from the Calendar. */
export default function NewPersonPage() {
  return (
    <div>
      <PageHeader title="Add a person" />
      {/* useSearchParams must sit under a Suspense boundary (Next.js). */}
      <Suspense fallback={null}>
        <NewPersonForm />
      </Suspense>
    </div>
  );
}
