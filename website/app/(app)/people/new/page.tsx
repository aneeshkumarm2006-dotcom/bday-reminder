"use client";

import { PageHeader } from "@/components/app/page-header";
import { PersonForm } from "@/components/app/person-form";

/** Add a new person (FR-5). */
export default function NewPersonPage() {
  return (
    <div>
      <PageHeader title="Add a person" />
      <PersonForm />
    </div>
  );
}
