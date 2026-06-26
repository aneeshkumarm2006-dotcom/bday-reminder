"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { PersonForm } from "@/components/app/person-form";
import { LoadingBlock } from "@/components/ui/spinner";
import { peopleApi } from "@/lib/api";

/** Edit an existing person (FR-8). */
export default function EditPersonPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["person", id],
    queryFn: () => peopleApi.get(id),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !data) {
    return <p className="text-ink-secondary">Couldn&apos;t load that person.</p>;
  }

  return (
    <div>
      <PageHeader title={`Edit ${data.person.fullName}`} />
      <PersonForm existing={data} />
    </div>
  );
}
