"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, ImagePlus, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AddEventDialog } from "@/components/app/add-event-dialog";
import { AutoSendDialog } from "@/components/app/auto-send-dialog";
import { DatePartsField, type DatePartsValue } from "@/components/app/date-parts-field";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input, TextField } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ToggleRow } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import {
  configApi,
  listsApi,
  peopleApi,
  uploadsApi,
  type CreatePersonEventInput,
  type Feb29Rule,
  type PersonType,
  type PersonWithEvents,
  type SmsChannel,
} from "@/lib/api";
import { monthAbbr } from "@/lib/dates";
import { eventTypeMeta } from "@/lib/event-style";
import { useAuth } from "@/providers/auth-provider";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Short human date for a pending-event row, e.g. "Jun 12" or "Jun 12, 1990". */
function formatEventDate(date: { month: number; day: number; year?: number | null }): string {
  return `${monthAbbr(date.month)} ${date.day}${date.year != null ? `, ${date.year}` : ""}`;
}

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

export function PersonForm({
  existing,
  initialDate,
}: {
  existing?: PersonWithEvents;
  /** Prefilled month/day when adding from the Calendar (tap a day → add). */
  initialDate?: { month: number; day: number };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const person = existing?.person;

  const birthday = existing?.events.find((e) => e.type === "birthday");

  const [fullName, setFullName] = useState(person?.fullName ?? "");
  const [type, setType] = useState<PersonType>(person?.type ?? "human");
  const [date, setDate] = useState<DatePartsValue>(
    birthday
      ? { month: birthday.date.month, day: birthday.date.day, year: birthday.date.year }
      : initialDate
        ? { month: initialDate.month, day: initialDate.day, year: null }
        : { month: 1, day: 1, year: null },
  );
  const [feb29Rule, setFeb29Rule] = useState<Feb29Rule>(person?.feb29Rule ?? "feb28");
  const presetTag = person?.relationshipTag && RELATIONSHIP_PRESETS.includes(person.relationshipTag);
  const [tag, setTag] = useState<string>(presetTag ? person!.relationshipTag! : "");
  const [customTag, setCustomTag] = useState<string>(presetTag ? "" : (person?.relationshipTag ?? ""));
  const [useCustom, setUseCustom] = useState<boolean>(!!person?.relationshipTag && !presetTag);
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [autoSendOn, setAutoSendOn] = useState(person?.autoBirthdayEmail?.enabled ?? false);
  const [autoSendMessage, setAutoSendMessage] = useState(person?.autoBirthdayEmail?.message ?? "");
  const [autoSendTime, setAutoSendTime] = useState(person?.autoBirthdayEmail?.sendTime ?? "");
  const [autoSendTz, setAutoSendTz] = useState(person?.autoBirthdayEmail?.sendTimeZone ?? "");
  const [autoSmsOn, setAutoSmsOn] = useState(person?.autoBirthdaySms?.enabled ?? false);
  const [autoSmsChannel, setAutoSmsChannel] = useState<SmsChannel>(
    person?.autoBirthdaySms?.channel ?? "sms",
  );
  const [autoSmsTemplateId, setAutoSmsTemplateId] = useState<string | null>(
    person?.autoBirthdaySms?.templateId ?? null,
  );
  const [autoSmsMessage, setAutoSmsMessage] = useState(person?.autoBirthdaySms?.message ?? "");
  const [autoSmsTime, setAutoSmsTime] = useState(person?.autoBirthdaySms?.sendTime ?? "");
  const [autoSmsTz, setAutoSmsTz] = useState(person?.autoBirthdaySms?.sendTimeZone ?? "");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(person?.photoUrl ?? null);
  const [selectedLists, setSelectedLists] = useState<string[]>(person?.lists ?? []);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Extra dates (anniversary/custom) added while creating the person; held
  // locally and saved atomically with them (add mode only - editing manages
  // events from the profile). Reuses the detail page's AddEventDialog.
  const [pendingEvents, setPendingEvents] = useState<CreatePersonEventInput[]>([]);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);

  const { data: listsData } = useQuery({ queryKey: ["lists"], queryFn: () => listsApi.list() });
  const { data: config, isError: configFailed } = useQuery({
    queryKey: ["config"],
    queryFn: () => configApi.get(),
  });

  // The greeting templates personalize with the person's first name, so ask for
  // the name before opening the setup popup — otherwise "Happy birthday, there!"
  // gets baked into the saved message.
  const openAutoSendDialog = (channel: "email" | "sms") => {
    if (!fullName.trim()) {
      toast({ message: "Add their name first — the greeting uses it.", tone: "error" });
      return;
    }
    if (channel === "email") setEmailDialogOpen(true);
    else setSmsDialogOpen(true);
  };

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
    const trimmedEmail = email.trim();
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
      toast({ message: "Enter a valid email address.", tone: "error" });
      return;
    }
    if (autoSendOn && !trimmedEmail) {
      toast({ message: "Add an email so the birthday greeting has somewhere to go.", tone: "error" });
      return;
    }
    if (autoSmsOn && !phone.trim()) {
      toast({ message: "Add a phone so the birthday SMS has somewhere to go.", tone: "error" });
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
      email: trimmedEmail || null,
      autoBirthdayEmail: {
        enabled: autoSendOn,
        message: autoSendMessage.trim() || null,
        sendTime: autoSendTime || null,
        sendTimeZone: autoSendTz || null,
      },
      autoBirthdaySms: {
        enabled: autoSmsOn,
        channel: autoSmsChannel,
        templateId: autoSmsTemplateId,
        message: autoSmsMessage.trim() || null,
        sendTime: autoSmsTime || null,
        sendTimeZone: autoSmsTz || null,
      },
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
        const { person: created } = await peopleApi.create({
          ...payload,
          // Extra anniversary/custom dates created with the person (FR-16).
          events: pendingEvents.length > 0 ? pendingEvents : undefined,
        });
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

      {/* Other dates - anniversaries / custom events created with the person
          (FR-16). Add mode only; editing manages these on the profile. */}
      {!person && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-secondary">Other dates</label>
          <div className="flex flex-col gap-2">
            {pendingEvents.map((ev, i) => {
              const meta = eventTypeMeta({ eventType: ev.type, customName: ev.customName ?? null });
              const EventIcon = meta.Icon;
              return (
                <div
                  key={`${ev.type}-${i}`}
                  className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2.5"
                >
                  <EventIcon size={18} className={`shrink-0 ${meta.textClass}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{meta.label}</p>
                    <p className="text-xs text-ink-muted">{formatEventDate(ev.date)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingEvents((cur) => cur.filter((_, j) => j !== i))}
                    aria-label={`Remove ${meta.label}`}
                    className="rounded-full p-1 text-ink-muted transition-colors hover:text-ink"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setEventDialogOpen(true)}
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong py-3 text-sm font-medium text-biro transition-colors hover:bg-surface"
            >
              <CalendarPlus size={18} aria-hidden="true" />
              Add event
            </button>
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            Anniversaries or custom dates. They appear on the calendar and remind you like birthdays.
          </p>
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

      {/* Email */}
      <TextField
        label="Email (optional)"
        type="email"
        autoComplete="off"
        helper="Where an auto-sent birthday greeting would go."
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {/* Auto-send birthday email (Stage 14) — turning it on opens the setup
          popup (template, message, Gmail permission); the toggle only flips ON
          once that's confirmed. */}
      <div>
        <ToggleRow
          label="Auto-send birthday email"
          description="Email a greeting on their birthday, sent from your Gmail as you."
          checked={autoSendOn}
          onCheckedChange={(on) => (on ? openAutoSendDialog("email") : setAutoSendOn(false))}
        />
        {autoSendOn ? (
          <p className="mt-1 text-xs text-ink-muted">
            To {email.trim() || "their email"}
            {user?.gmailEmail ? ` from ${user.gmailEmail}` : ""}, every year.{" "}
            <button
              type="button"
              aria-label="Edit the birthday email message"
              className="font-medium text-biro hover:underline"
              onClick={() => setEmailDialogOpen(true)}
            >
              Edit message
            </button>
          </p>
        ) : (
          <p className="mt-1 text-xs text-ink-muted">
            {user?.gmailConnected
              ? "Off. Your Gmail is connected and ready."
              : "Off. You'll connect your Gmail when you turn this on."}
          </p>
        )}
      </div>

      {/* Auto-send birthday SMS (Stage 15) — same popup flow, no per-user
          account to connect (one shared Twilio number). */}
      <div>
        <ToggleRow
          label="Auto-send birthday text"
          description="Send a greeting on their birthday by SMS or WhatsApp, signed with your name."
          checked={autoSmsOn}
          onCheckedChange={(on) => (on ? openAutoSendDialog("sms") : setAutoSmsOn(false))}
        />
        {autoSmsOn ? (
          <p className="mt-1 text-xs text-ink-muted">
            By {autoSmsChannel === "whatsapp" ? "WhatsApp" : "SMS"} to {phone.trim() || "their phone"}
            , signed {user?.name || "you"}, every year.{" "}
            <button
              type="button"
              aria-label="Edit the birthday SMS message"
              className="font-medium text-biro hover:underline"
              onClick={() => setSmsDialogOpen(true)}
            >
              Edit message
            </button>
          </p>
        ) : (
          <p className="mt-1 text-xs text-ink-muted">
            Off. Sent from a shared number, signed with your name.
          </p>
        )}
      </div>

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

      {/* Draft-mode event picker for the "Other dates" section (add only). */}
      {!person && (
        <AddEventDialog
          open={eventDialogOpen}
          onClose={() => setEventDialogOpen(false)}
          onAdd={(draft) => setPendingEvents((cur) => [...cur, draft])}
        />
      )}

      {/* Auto-send setup popups (draft mode: confirm updates form state; the
          person is saved on submit). Confirm also syncs the recipient back
          into the Email/Phone field above. */}
      <AutoSendDialog
        channel="email"
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        personName={fullName}
        available={config ? !!config.gmailAutoSendAvailable : configFailed ? false : undefined}
        initialRecipient={email}
        initialMessage={autoSendMessage}
        initialSendTime={autoSendTime}
        initialSendTimeZone={autoSendTz}
        alreadyEnabled={autoSendOn}
        onConfirm={({ recipient, message, sendTime, sendTimeZone }) => {
          setEmail(recipient);
          setAutoSendMessage(message);
          setAutoSendTime(sendTime);
          setAutoSendTz(sendTimeZone);
          setAutoSendOn(true);
        }}
      />
      <AutoSendDialog
        channel="sms"
        open={smsDialogOpen}
        onClose={() => setSmsDialogOpen(false)}
        personName={fullName}
        available={config ? !!config.smsAutoSendAvailable : configFailed ? false : undefined}
        whatsappAvailable={
          config ? !!config.whatsappAutoSendAvailable : configFailed ? false : undefined
        }
        initialRecipient={phone}
        initialMessage={autoSmsMessage}
        initialSendTime={autoSmsTime}
        initialSendTimeZone={autoSmsTz}
        initialSmsChannel={autoSmsChannel}
        alreadyEnabled={autoSmsOn}
        onConfirm={({ recipient, message, sendTime, sendTimeZone, smsChannel, smsTemplateId }) => {
          setPhone(recipient);
          setAutoSmsMessage(message);
          setAutoSmsTime(sendTime);
          setAutoSmsTz(sendTimeZone);
          setAutoSmsChannel(smsChannel);
          setAutoSmsTemplateId(smsTemplateId);
          setAutoSmsOn(true);
        }}
      />
    </form>
  );
}
