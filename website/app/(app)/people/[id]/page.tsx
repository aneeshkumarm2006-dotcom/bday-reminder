"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Mail, MessageSquare, PawPrint, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { AddEventDialog } from "@/components/app/add-event-dialog";
import { AutoSendDialog, type AutoSendDraft } from "@/components/app/auto-send-dialog";
import { NotesSection } from "@/components/app/notes-section";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { LoadingBlock } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { Ring } from "@/components/ring";
import {
  ApiError,
  configApi,
  eventsApi,
  notesApi,
  peopleApi,
  type EventItem,
  type Feb29Rule,
} from "@/lib/api";
import {
  ageTurning,
  countdownLabel,
  daysUntil,
  monthAbbr,
  nextOccurrence,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Person profile (FR-9/16/35) — events with rings, gift notes, edit/delete. */
export default function PersonProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [addOpen, setAddOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [savingChannel, setSavingChannel] = useState<"email" | "sms" | null>(null);

  const personQ = useQuery({ queryKey: ["person", id], queryFn: () => peopleApi.get(id) });
  const notesQ = useQuery({ queryKey: ["notes", id], queryFn: () => notesApi.list(id) });
  const { data: config, isError: configFailed } = useQuery({
    queryKey: ["config"],
    queryFn: () => configApi.get(),
  });

  if (personQ.isLoading) return <LoadingBlock />;
  if (personQ.isError || !personQ.data) {
    return <p className="text-ink-secondary">Couldn&apos;t load that person.</p>;
  }

  const { person, events } = personQ.data;

  const deletePerson = async () => {
    if (
      !(await confirm({
        title: `Delete ${person.fullName}?`,
        message: "This removes them and all their events, reminders, and notes.",
        destructive: true,
        confirmLabel: "Delete",
      }))
    )
      return;
    try {
      await peopleApi.remove(person.id);
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["upcoming"] });
      toast({ message: `${person.fullName} deleted.`, tone: "success" });
      router.replace("/people");
    } catch {
      toast({ message: "Couldn't delete. Try again.", tone: "error" });
    }
  };

  const deleteEvent = async (event: EventItem) => {
    if (!(await confirm({ title: "Delete this event?", destructive: true, confirmLabel: "Delete" })))
      return;
    try {
      await eventsApi.remove(event.id);
      qc.invalidateQueries({ queryKey: ["person", id] });
      qc.invalidateQueries({ queryKey: ["upcoming"] });
      toast({ message: "Event removed.", tone: "success" });
    } catch {
      toast({ message: "Couldn't remove the event.", tone: "error" });
    }
  };

  const invalidatePerson = () => {
    qc.invalidateQueries({ queryKey: ["person", id] });
    qc.invalidateQueries({ queryKey: ["people"] });
  };

  // Live mode: changes here persist immediately (unlike the edit form's
  // draft-mode popups). Message omitted on toggle-off so the saved text
  // survives an off/on cycle; never send null (it wipes the whole sub-doc).
  const autoSendOff = async (channel: "email" | "sms") => {
    setSavingChannel(channel);
    try {
      await peopleApi.update(
        person.id,
        channel === "email"
          ? { autoBirthdayEmail: { enabled: false } }
          : { autoBirthdaySms: { enabled: false } },
      );
      invalidatePerson();
      toast({ message: channel === "email" ? "Auto-send email off." : "Auto-send SMS off.", tone: "success" });
    } catch (e) {
      toast({ message: e instanceof ApiError ? e.message : "Couldn't save. Try again.", tone: "error" });
    } finally {
      setSavingChannel(null);
    }
  };

  // Confirm handlers for the popups; a thrown ApiError (e.g. "connect Gmail
  // first" for a shared person whose owner isn't connected) is surfaced by the
  // dialog itself, which stays open.
  const confirmAutoEmail = async ({ recipient, message, sendTime, sendTimeZone }: AutoSendDraft) => {
    await peopleApi.update(person.id, {
      email: recipient,
      autoBirthdayEmail: {
        enabled: true,
        message,
        sendTime: sendTime || null,
        sendTimeZone: sendTimeZone || null,
      },
    });
    invalidatePerson();
    toast({ message: "Auto-send email on.", tone: "success" });
  };

  const confirmAutoSms = async ({ recipient, message, sendTime, sendTimeZone }: AutoSendDraft) => {
    await peopleApi.update(person.id, {
      phone: recipient,
      autoBirthdaySms: {
        enabled: true,
        message,
        sendTime: sendTime || null,
        sendTimeZone: sendTimeZone || null,
      },
    });
    invalidatePerson();
    toast({ message: "Auto-send SMS on.", tone: "success" });
  };

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar name={person.fullName} src={person.photoUrl} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {person.type === "pet" && (
              <PawPrint size={18} className="text-ink-muted" aria-label="Pet" />
            )}
            <h1 className="truncate font-display text-2xl font-semibold text-ink">
              {person.fullName}
            </h1>
          </div>
          {person.relationshipTag && (
            <p className="mt-0.5 text-ink-secondary">{person.relationshipTag}</p>
          )}
          {person.lastEditedBy && (
            <p className="mt-1 text-xs text-ink-muted">Last edited by {person.lastEditedBy.name}</p>
          )}
        </div>
        <Link
          href={`/people/${person.id}/edit`}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          <Pencil aria-hidden="true" />
          Edit
        </Link>
      </div>

      {/* Events */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Events</h2>
          <Button size="sm" variant="ghost" onClick={() => setAddOpen(true)}>
            <CalendarPlus aria-hidden="true" />
            Add event
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              feb29Rule={person.feb29Rule}
              onEdit={() => setEditingEvent(event)}
              onDelete={event.type === "birthday" ? undefined : () => deleteEvent(event)}
            />
          ))}
        </div>
      </section>

      {/* Auto-send greetings (Stage 14/15) — interactive: the switch opens the
          setup popup to turn on, and changes persist immediately. */}
      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Auto-send</h2>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-4">
            <Mail size={20} className="shrink-0 text-biro" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">Birthday email</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {person.autoBirthdayEmail?.enabled ? (
                  <>
                    Emails {person.email || "their email"} each year, sent from your Gmail as you.{" "}
                    <button
                      type="button"
                      aria-label="Edit the birthday email message"
                      className="font-medium text-biro hover:underline"
                      onClick={() => setEmailDialogOpen(true)}
                    >
                      Edit message
                    </button>
                  </>
                ) : (
                  "Off. Turn on to email a greeting from your Gmail, as you."
                )}
              </p>
            </div>
            <Switch
              checked={!!person.autoBirthdayEmail?.enabled}
              disabled={savingChannel === "email"}
              onCheckedChange={(on) => (on ? setEmailDialogOpen(true) : autoSendOff("email"))}
              aria-label="Auto-send birthday email"
            />
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-4">
            <MessageSquare size={20} className="shrink-0 text-biro" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">Birthday SMS</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {person.autoBirthdaySms?.enabled ? (
                  <>
                    Texts {person.phone || "their phone"} each year, signed with your name.{" "}
                    <button
                      type="button"
                      aria-label="Edit the birthday SMS message"
                      className="font-medium text-biro hover:underline"
                      onClick={() => setSmsDialogOpen(true)}
                    >
                      Edit message
                    </button>
                  </>
                ) : (
                  "Off. Turn on to text a greeting, signed with your name."
                )}
              </p>
            </div>
            <Switch
              checked={!!person.autoBirthdaySms?.enabled}
              disabled={savingChannel === "sms"}
              onCheckedChange={(on) => (on ? setSmsDialogOpen(true) : autoSendOff("sms"))}
              aria-label="Auto-send birthday SMS"
            />
          </div>
        </div>
      </section>

      {/* Notes */}
      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Gift notes</h2>
        <NotesSection personId={person.id} initialNotes={notesQ.data?.notes ?? []} />
      </section>

      {/* Danger zone */}
      <section className="mt-10 border-t border-border-subtle pt-6">
        <Button variant="destructive" onClick={deletePerson}>
          <Trash2 aria-hidden="true" />
          Delete {person.fullName}
        </Button>
      </section>

      <AddEventDialog
        personId={person.id}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["person", id] });
          qc.invalidateQueries({ queryKey: ["upcoming"] });
        }}
      />

      <AddEventDialog
        personId={person.id}
        event={editingEvent ?? undefined}
        open={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        onUpdated={() => {
          setEditingEvent(null);
          qc.invalidateQueries({ queryKey: ["person", id] });
          qc.invalidateQueries({ queryKey: ["upcoming"] });
        }}
      />

      <AutoSendDialog
        channel="email"
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        personName={person.fullName}
        available={config ? !!config.gmailAutoSendAvailable : configFailed ? false : undefined}
        initialRecipient={person.email ?? ""}
        initialMessage={person.autoBirthdayEmail?.message ?? ""}
        initialSendTime={person.autoBirthdayEmail?.sendTime ?? ""}
        initialSendTimeZone={person.autoBirthdayEmail?.sendTimeZone ?? ""}
        alreadyEnabled={!!person.autoBirthdayEmail?.enabled}
        onConfirm={confirmAutoEmail}
      />
      <AutoSendDialog
        channel="sms"
        open={smsDialogOpen}
        onClose={() => setSmsDialogOpen(false)}
        personName={person.fullName}
        available={config ? !!config.smsAutoSendAvailable : configFailed ? false : undefined}
        initialRecipient={person.phone ?? ""}
        initialMessage={person.autoBirthdaySms?.message ?? ""}
        initialSendTime={person.autoBirthdaySms?.sendTime ?? ""}
        initialSendTimeZone={person.autoBirthdaySms?.sendTimeZone ?? ""}
        alreadyEnabled={!!person.autoBirthdaySms?.enabled}
        onConfirm={confirmAutoSms}
      />
    </div>
  );
}

function EventRow({
  event,
  feb29Rule,
  onEdit,
  onDelete,
}: {
  event: EventItem;
  feb29Rule: Feb29Rule;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const rule = event.type === "birthday" ? feb29Rule : "feb28";
  const occ = nextOccurrence(event.date.month, event.date.day, rule);
  const days = daysUntil(occ);
  const age = event.type === "birthday" ? ageTurning(occ, event.date.year) : null;

  const label =
    event.type === "birthday"
      ? "Birthday"
      : event.type === "anniversary"
        ? "Anniversary"
        : (event.customName ?? "Event");

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-3">
      <Ring
        day={occ.getDate()}
        month={monthAbbr(occ.getMonth() + 1)}
        size="md"
        state={days === 0 ? "today" : "upcoming"}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{label}</p>
        <p className="text-sm text-ink-muted tabular-nums">
          {countdownLabel(days)}
          {age != null ? ` · turns ${age}` : ""}
        </p>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${label}`}
          className="rounded-md p-2 text-ink-muted transition-colors hover:text-ink"
        >
          <Pencil size={16} aria-hidden="true" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${label}`}
          className="rounded-md p-2 text-ink-muted hover:bg-danger-bg hover:text-danger-fg"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
