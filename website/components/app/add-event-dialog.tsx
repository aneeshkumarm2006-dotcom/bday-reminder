"use client";

import { useState } from "react";

import { DatePartsField, type DatePartsValue } from "@/components/app/date-parts-field";
import { defaultTimeInheritLabel, ReminderTimePicker } from "@/components/app/reminder-prefs";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { eventsApi, type CreatePersonEventInput, type EventItem } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/**
 * Add or edit an event (FR-16/21/22). The birthday is created automatically from
 * the person's DOB, so it isn't *added* here - but it can be edited (reminder
 * time only; its date lives with the person). Custom events take a name. Three
 * modes share the same fields:
 *  - API create (person detail): pass `personId` + `onCreated`; submit calls
 *    `POST /events` and hands the created event back.
 *  - Draft create (Add person, before the person exists): pass `onAdd`; submit
 *    hands the validated draft back so the parent creates it with the person.
 *  - Edit (person detail): pass `event` + `onUpdated`; submit calls
 *    `PATCH /events/:id`.
 */
export function AddEventDialog({
  personId,
  event,
  open,
  onClose,
  onCreated,
  onUpdated,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  /** API create mode: the person to attach the event to (with `onCreated`). */
  personId?: string;
  /** Edit mode: the existing event to edit (with `onUpdated`). */
  event?: EventItem;
  /** API create mode: called with the created event after `POST /events`. */
  onCreated?: (event: EventItem) => void;
  /** Edit mode: called with the updated event after `PATCH /events/:id`. */
  onUpdated?: (event: EventItem) => void;
  /** Draft create mode: receive the validated event instead of hitting the API. */
  onAdd?: (draft: CreatePersonEventInput) => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isEdit = !!event;
  const isBirthday = event?.type === "birthday";

  const [type, setType] = useState<"anniversary" | "custom">("anniversary");
  const [customName, setCustomName] = useState("");
  const [date, setDate] = useState<DatePartsValue>({ month: 1, day: 1, year: null });
  // "" => inherit the user's global default reminder time; "HH:MM" => a set time.
  const [reminderTime, setReminderTime] = useState("");
  const [busy, setBusy] = useState(false);

  // Seed fields from the event being edited whenever the dialog opens for it.
  // Done during render (guarded by a tracker) rather than in an effect, so it
  // doesn't trigger a setState-in-effect cascade.
  const seedKey = open && event ? event.id : null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (seedKey !== seededFor) {
    setSeededFor(seedKey);
    if (event && seedKey) {
      setType(event.type === "custom" ? "custom" : "anniversary");
      setCustomName(event.customName ?? "");
      setDate({ month: event.date.month, day: event.date.day, year: event.date.year });
      setReminderTime(event.reminderTimeOverride ?? "");
    }
  }

  const resetFields = () => {
    setType("anniversary");
    setCustomName("");
    setDate({ month: 1, day: 1, year: null });
    setReminderTime("");
  };

  const submit = async () => {
    if (!isBirthday && type === "custom" && !customName.trim()) {
      toast({ message: "Give the event a name.", tone: "error" });
      return;
    }

    // Edit mode: PATCH only the fields this event type allows.
    if (isEdit) {
      setBusy(true);
      try {
        const { event: updated } = await eventsApi.update(event.id, {
          ...(isBirthday
            ? {}
            : {
                customName: event.type === "custom" ? customName.trim() : undefined,
                date: { month: date.month, day: date.day, year: date.year },
              }),
          reminderTimeOverride: reminderTime || null,
        });
        onUpdated?.(updated);
        onClose();
        resetFields();
      } catch {
        toast({ message: "Couldn't save the event. Try again.", tone: "error" });
      } finally {
        setBusy(false);
      }
      return;
    }

    const draft: CreatePersonEventInput = {
      type,
      customName: type === "custom" ? customName.trim() : null,
      date: { month: date.month, day: date.day, year: date.year },
      reminderTimeOverride: reminderTime || null,
    };

    // Draft mode (Add person): hand the event to the parent - no person yet.
    if (onAdd) {
      onAdd(draft);
      onClose();
      resetFields();
      return;
    }

    setBusy(true);
    try {
      const { event: created } = await eventsApi.create({ person: personId!, ...draft });
      onCreated?.(created);
      onClose();
      resetFields();
    } catch {
      toast({ message: "Couldn't add the event. Try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Edit event" : "Add an event"}>
      <div className="flex flex-col gap-4">
        {!isEdit && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-secondary">Type</label>
            <div className="flex gap-2">
              <Chip selected={type === "anniversary"} onClick={() => setType("anniversary")}>
                Anniversary
              </Chip>
              <Chip selected={type === "custom"} onClick={() => setType("custom")}>
                Custom
              </Chip>
            </div>
          </div>
        )}

        {!isBirthday && type === "custom" && (
          <TextField
            label="Event name"
            placeholder="e.g. Graduation"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
        )}

        {!isBirthday && <DatePartsField value={date} onChange={setDate} />}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-secondary">
            Reminder time
          </label>
          <ReminderTimePicker
            value={reminderTime}
            onChange={setReminderTime}
            inheritLabel={defaultTimeInheritLabel(user?.defaultReminderTime)}
          />
        </div>

        <div className="mt-1 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {isEdit ? "Save changes" : "Add event"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
