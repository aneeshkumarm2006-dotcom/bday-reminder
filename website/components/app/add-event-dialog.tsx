"use client";

import { useState } from "react";

import { DatePartsField, type DatePartsValue } from "@/components/app/date-parts-field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { eventsApi, type EventItem } from "@/lib/api";

/**
 * Add an Anniversary or Custom event to a person (FR-16). Birthday is automatic
 * (edited via the person's DOB), so it isn't offered here. Custom events take a
 * name. On success, hands the created event back to the parent.
 */
export function AddEventDialog({
  personId,
  open,
  onClose,
  onCreated,
}: {
  personId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (event: EventItem) => void;
}) {
  const { toast } = useToast();
  const [type, setType] = useState<"anniversary" | "custom">("anniversary");
  const [customName, setCustomName] = useState("");
  const [date, setDate] = useState<DatePartsValue>({ month: 1, day: 1, year: null });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (type === "custom" && !customName.trim()) {
      toast({ message: "Give the event a name.", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const { event } = await eventsApi.create({
        person: personId,
        type,
        customName: type === "custom" ? customName.trim() : null,
        date: { month: date.month, day: date.day, year: date.year },
      });
      onCreated(event);
      onClose();
      setCustomName("");
      setDate({ month: 1, day: 1, year: null });
    } catch {
      toast({ message: "Couldn't add the event. Try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add an event">
      <div className="flex flex-col gap-4">
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

        {type === "custom" && (
          <TextField
            label="Event name"
            placeholder="e.g. Graduation"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
        )}

        <DatePartsField value={date} onChange={setDate} />

        <div className="mt-1 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            Add event
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
