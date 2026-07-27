"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";

/**
 * Confirmation dialog that requires typing an exact phrase. Reserved for the
 * actions this admin can't undo with a revision restore: deleting a page,
 * flipping the site to noindex, importing over everything.
 *
 * Note the explicit `type="button"` on every control — the site's `Dialog`
 * isn't a portal, so a bare button inside a form-embedded dialog submits the
 * outer form (this bit us in the auto-send popups).
 */
interface TypedConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  phrase: string;
  confirmLabel?: string;
}

/**
 * Mounting the body only while open is what resets the typed phrase — a fresh
 * `useState("")` per opening, rather than an effect that clears it.
 */
export function TypedConfirmDialog(props: TypedConfirmProps) {
  if (!props.open) return null;
  return <TypedConfirmBody {...props} />;
}

function TypedConfirmBody({
  onClose,
  onConfirm,
  title,
  message,
  phrase,
  confirmLabel = "I understand, continue",
}: TypedConfirmProps) {
  const [value, setValue] = React.useState("");
  const id = React.useId();

  const matches = value.trim() === phrase;

  return (
    <Dialog open onClose={onClose} title={title} description={message}>
      <div className="mt-2">
        <Label htmlFor={id}>
          Type <span className="font-medium text-ink">{phrase}</span> to confirm
        </Label>
        <Input
          id={id}
          value={value}
          autoComplete="off"
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={!matches}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
