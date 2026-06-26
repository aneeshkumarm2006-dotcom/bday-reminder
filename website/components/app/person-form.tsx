"use client";

import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DatePartsField, type DatePartsValue } from "@/components/app/date-parts-field";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input, TextField } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  listsApi,
  peopleApi,
  uploadsApi,
  type Feb29Rule,
  type PersonType,
  type PersonWithEvents,
} from "@/lib/api";

/**
 * Add / edit person form (FR-5/8/10/13/14/15). Birthday is set here via DOB and
 * kept as the person's auto birthday event. Relationship tag is a preset chip or
 * a custom value; Feb-29 rule only shows for a Feb-29 birthday; lists let shared
 * members see the person. Photo uploads through the backend (Cloudinary or a
 * data-URL fallback).
 */

const RELATIONSHIP_PRESETS = ["Family", "Friend", "Colleague", "Partner", "Other"];
const FEB29_OPTIONS: { value: Feb29Rule; label: string }[] = [
  { value: "feb28", label: "Feb 28 in common years" },
  { value: "mar1", label: "Mar 1 in common years" },
  { value: "feb29only", label: "Only in leap years" },
];

export function PersonForm({ existing }: { existing?: PersonWithEvents }) {
  const router = useRouter();
  const { toast } = useToast();
  const person = existing?.person;

  const birthday = existing?.events.find((e) => e.type === "birthday");

  const [fullName, setFullName] = useState(person?.fullName ?? "");
  const [type, setType] = useState<PersonType>(person?.type ?? "human");
  const [date, setDate] = useState<DatePartsValue>(
    birthday
      ? { month: birthday.date.month, day: birthday.date.day, year: birthday.date.year }
      : { month: 1, day: 1, year: null },
  );
  const [feb29Rule, setFeb29Rule] = useState<Feb29Rule>(person?.feb29Rule ?? "feb28");
  const presetTag = person?.relationshipTag && RELATIONSHIP_PRESETS.includes(person.relationshipTag);
  const [tag, setTag] = useState<string>(presetTag ? person!.relationshipTag! : "");
  const [customTag, setCustomTag] = useState<string>(presetTag ? "" : (person?.relationshipTag ?? ""));
  const [useCustom, setUseCustom] = useState<boolean>(!!person?.relationshipTag && !presetTag);
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(person?.photoUrl ?? null);
  const [selectedLists, setSelectedLists] = useState<string[]>(person?.lists ?? []);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: listsData } = useQuery({ queryKey: ["lists"], queryFn: () => listsApi.list() });

  const isLeapDay = date.month === 2 && date.day === 29;

  const onPickPhoto = async (file: File) => {
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { url } = await uploadsApi.photo(dataUrl);
      setPhotoUrl(url);
    } catch {
      toast({ message: "Couldn't upload that photo. Try a smaller image.", tone: "error" });
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ message: "Add a name.", tone: "error" });
      return;
    }
    const relationshipTag = useCustom ? customTag.trim() || null : tag || null;
    const payload = {
      fullName: fullName.trim(),
      type,
      dob: { month: date.month, day: date.day, year: date.year },
      feb29Rule: isLeapDay ? feb29Rule : ("feb28" as Feb29Rule),
      relationshipTag,
      phone: phone.trim() || null,
      photoUrl,
      lists: selectedLists,
    };

    setBusy(true);
    try {
      if (person) {
        await peopleApi.update(person.id, payload);
        toast({ message: "Saved.", tone: "success" });
        router.replace(`/people/${person.id}`);
      } else {
        const { person: created } = await peopleApi.create(payload);
        toast({ message: "Person added.", tone: "success" });
        router.replace(`/people/${created.id}`);
      }
    } catch {
      toast({ message: "Couldn't save. Try again.", tone: "error" });
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-5">
      {/* Photo + name */}
      <div className="flex items-center gap-4">
        <label className="group relative cursor-pointer" aria-label="Upload photo">
          <Avatar name={fullName || "?"} src={photoUrl} size={64} />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/40 opacity-0 transition-opacity group-hover:opacity-100">
            {uploading ? (
              <Loader2 size={20} className="animate-spin text-paper" />
            ) : (
              <ImagePlus size={20} className="text-paper" />
            )}
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && onPickPhoto(e.target.files[0])}
          />
        </label>
        <div className="flex-1">
          <TextField
            label="Name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
      </div>

      {/* Type */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-secondary">Type</label>
        <div className="flex gap-2">
          <Chip selected={type === "human"} onClick={() => setType("human")}>
            Person
          </Chip>
          <Chip selected={type === "pet"} onClick={() => setType("pet")}>
            Pet
          </Chip>
        </div>
      </div>

      {/* Birthday */}
      <DatePartsField label="Birthday" value={date} onChange={setDate} />
      {isLeapDay && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-secondary">
            In non-leap years, observe on
          </label>
          <Select value={feb29Rule} onChange={(e) => setFeb29Rule(e.target.value as Feb29Rule)}>
            {FEB29_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Relationship tag */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-secondary">Relationship</label>
        <div className="flex flex-wrap gap-2">
          {RELATIONSHIP_PRESETS.map((t) => (
            <Chip
              key={t}
              selected={!useCustom && tag === t}
              onClick={() => {
                setUseCustom(false);
                setTag(tag === t ? "" : t);
              }}
            >
              {t}
            </Chip>
          ))}
          <Chip selected={useCustom} onClick={() => setUseCustom(true)}>
            Custom…
          </Chip>
        </div>
        {useCustom && (
          <Input
            className="mt-2"
            placeholder="e.g. Neighbour"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
          />
        )}
      </div>

      {/* Phone */}
      <TextField
        label="Phone (optional)"
        type="tel"
        autoComplete="off"
        helper="Needed for the day-of greeting shortcut."
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      {/* Lists */}
      {listsData && listsData.lists.length > 0 && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-secondary">
            Add to shared lists
          </label>
          <div className="flex flex-wrap gap-2">
            {listsData.lists.map((l) => (
              <Chip
                key={l.id}
                selected={selectedLists.includes(l.id)}
                onClick={() =>
                  setSelectedLists((prev) =>
                    prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id],
                  )
                }
              >
                {l.name}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 flex gap-3">
        <Button type="submit" size="lg" disabled={busy || uploading}>
          {person ? "Save changes" : "Add person"}
        </Button>
        <Button type="button" size="lg" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
