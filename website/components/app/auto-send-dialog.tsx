"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useId, useState } from "react";

import {
  defaultTimeInheritLabel,
  friendlyTimeLabel,
  ReminderTimePicker,
  TimeZonePicker,
} from "@/components/app/reminder-prefs";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog } from "@/components/ui/dialog";
import { Label, Textarea, TextField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ApiError, gmailApi, type SmsChannel } from "@/lib/api";
import {
  defaultGreeting,
  EMAIL_MAX,
  fillTemplate,
  firstName,
  matchTemplateId,
  SMS_MAX,
  templatesFor,
  type GreetingChannel,
} from "@/lib/greeting-templates";
import { useAuth } from "@/providers/auth-provider";
import { timeZoneLabel } from "@/lib/timezones";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AutoSendDraft = {
  recipient: string;
  message: string;
  sendTime: string;
  sendTimeZone: string;
  /** Selected rail for the SMS dialog ('sms' | 'whatsapp'); ignored by the email dialog. */
  smsChannel: SmsChannel;
  /** Chosen greeting preset id, or null for custom text; drives the WhatsApp template. */
  smsTemplateId: string | null;
};

/**
 * Auto-send setup popup (Stage 14/15) — opened by the auto-send toggles instead
 * of revealing fields inline. One component for both channels. Two modes, set
 * by the parent's `onConfirm`:
 *  - Draft (person form): confirm hands `{recipient, message}` back; the form
 *    syncs its email/phone field and flips its local toggle on. Saved on Save.
 *  - Live (person profile): confirm PATCHes the person; a thrown ApiError here
 *    surfaces the backend guard message as a toast and keeps the popup open.
 * The email channel requires a connected Gmail before it can be confirmed —
 * the consent flow opens in a new tab so this dialog (and the form behind it)
 * survives, and we re-check on return via window focus/visibilitychange.
 */
export function AutoSendDialog({
  channel,
  open,
  onClose,
  personName,
  available,
  whatsappAvailable,
  initialRecipient,
  initialMessage,
  initialSendTime,
  initialSendTimeZone,
  initialSmsChannel = "sms",
  alreadyEnabled,
  onConfirm,
}: {
  channel: GreetingChannel;
  open: boolean;
  onClose: () => void;
  /** For {name} substitution and the fixed email subject preview. */
  personName: string;
  /** Server provisioning flag for the SMS rail (or Gmail for the email dialog);
   * undefined = config still loading. */
  available: boolean | undefined;
  /** Server provisioning flag for the WhatsApp rail (SMS dialog only). */
  whatsappAvailable?: boolean;
  initialRecipient: string;
  initialMessage: string;
  /** Stored "HH:mm" send time; "" = inherit the user's default reminder time. */
  initialSendTime: string;
  /** Stored IANA zone `sendTime` is anchored in; "" = inherit the account timezone. */
  initialSendTimeZone: string;
  /** Stored rail for the SMS dialog ('sms' | 'whatsapp'); defaults to SMS. */
  initialSmsChannel?: SmsChannel;
  /** true → editing an existing setup ("Save"); false → enabling ("Turn on"). */
  alreadyEnabled: boolean;
  onConfirm: (draft: AutoSendDraft) => void | Promise<void>;
}) {
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const messageId = useId();
  const isEmail = channel === "email";
  const fillOpts = { name: personName, sender: user?.name };
  const maxLen = isEmail ? EMAIL_MAX : SMS_MAX;

  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [sendTime, setSendTime] = useState("");
  const [sendTimeZone, setSendTimeZone] = useState("");
  const [smsChannel, setSmsChannel] = useState<SmsChannel>("sms");
  const [customPicked, setCustomPicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connectWaiting, setConnectWaiting] = useState(false);

  // Seed fields whenever the dialog opens. Done during render (guarded by a
  // tracker) rather than in an effect — same pattern as AddEventDialog.
  const [seededOpen, setSeededOpen] = useState(false);
  if (open !== seededOpen) {
    setSeededOpen(open);
    if (open) {
      setRecipient(initialRecipient);
      setMessage(initialMessage.trim() || defaultGreeting(channel, fillOpts));
      setSendTime(initialSendTime);
      setSendTimeZone(initialSendTimeZone);
      setSmsChannel(initialSmsChannel);
      setCustomPicked(false);
      setBusy(false);
      setConnectWaiting(false);
    }
  }

  // The WhatsApp option only shows when that rail is provisioned; when only one
  // rail exists the dialog stays single-channel (its current behavior). Whether
  // the *selected* rail is available drives the gate and the confirm button.
  const isWhatsapp = !isEmail && smsChannel === "whatsapp";
  const showChannelToggle = !isEmail && (available === true || whatsappAvailable === true);
  const effectiveAvailable = isEmail ? available : isWhatsapp ? whatsappAvailable : available;

  const gmailReady = !!user?.gmailConnected;
  // The time the greeting actually goes out at: the chosen slot, or the user's
  // default reminder time when left on inherit (""). When a send timezone is
  // picked, the time is anchored there (e.g. "9:00 AM EST"), so we note the zone.
  const effectiveTime = friendlyTimeLabel(sendTime || user?.defaultReminderTime);
  const zoneNote = sendTimeZone ? ` (${timeZoneLabel(sendTimeZone)})` : "";
  const effectiveTimeLabel = `${effectiveTime}${zoneNote}`;

  // While the OAuth tab is open, re-check the connection whenever the user
  // comes back to this tab — no interval polling needed.
  useEffect(() => {
    if (!open || !isEmail || !connectWaiting || gmailReady) return;
    let cancelled = false;
    const check = () => {
      void refreshUser().then((me) => {
        if (!cancelled && me?.gmailConnected) setConnectWaiting(false);
      });
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [open, isEmail, connectWaiting, gmailReady, refreshUser]);

  const startConnect = async () => {
    // Open the tab synchronously inside the click gesture — Safari revokes the
    // popup allowance after an await — then point it at the consent URL.
    const tab = window.open("about:blank", "_blank");
    try {
      const { url } = await gmailApi.connectUrl();
      if (tab) tab.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
      setConnectWaiting(true);
    } catch {
      tab?.close();
      toast({ message: "Couldn't start the Gmail connection. Try again.", tone: "error" });
    }
  };

  const recheckConnect = async () => {
    const me = await refreshUser();
    if (me?.gmailConnected) {
      setConnectWaiting(false);
    } else {
      toast({ message: "Gmail isn't connected yet. Finish the Google sign-in first.", tone: "error" });
    }
  };

  const matched = matchTemplateId(message, channel, fillOpts);
  const activeTemplate = customPicked ? null : matched;

  const recipientOk = isEmail ? EMAIL_RE.test(recipient.trim()) : recipient.trim().length > 0;
  const messageOk = message.trim().length > 0 && message.trim().length <= maxLen;
  const canConfirm =
    effectiveAvailable === true && recipientOk && messageOk && (!isEmail || gmailReady) && !busy;

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await onConfirm({
        recipient: recipient.trim(),
        message: message.trim(),
        sendTime,
        sendTimeZone,
        smsChannel,
        smsTemplateId: isEmail ? null : activeTemplate,
      });
      onClose();
    } catch (e) {
      toast({
        message: e instanceof ApiError ? e.message : "Couldn't save. Try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        isEmail
          ? "Auto-send birthday email"
          : isWhatsapp
            ? "Auto-send birthday WhatsApp"
            : "Auto-send birthday SMS"
      }
      description={
        isEmail
          ? `A greeting emails itself on ${firstName(personName)}'s birthday — sent from your Gmail, as you.`
          : `A ${isWhatsapp ? "WhatsApp message" : "text"} goes out on ${firstName(personName)}'s birthday, signed with your name.`
      }
    >
      {/* Rail picker — only when WhatsApp is also provisioned; otherwise the
          dialog stays single-channel. Sits above the availability gate so you can
          always switch back to an available rail. */}
      {showChannelToggle ? (
        <div className="mb-4">
          <Label id="auto-send-rail">Send by</Label>
          <div role="group" aria-labelledby="auto-send-rail" className="flex flex-wrap gap-2">
            <Chip
              selected={!isWhatsapp}
              disabled={available !== true}
              onClick={() => setSmsChannel("sms")}
            >
              SMS
            </Chip>
            <Chip
              selected={isWhatsapp}
              disabled={whatsappAvailable !== true}
              onClick={() => setSmsChannel("whatsapp")}
            >
              WhatsApp
            </Chip>
          </div>
        </div>
      ) : null}
      {effectiveAvailable !== true ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border-subtle bg-surface-sunken p-4 text-sm text-ink-secondary">
            {effectiveAvailable === undefined
              ? "Checking availability…"
              : isEmail
                ? "Auto-send email isn't available on this server yet, so it can't be turned on. Check back later."
                : isWhatsapp
                  ? "Auto-send WhatsApp isn't available on this server yet, so it can't be turned on. Check back later."
                  : "Auto-send texts aren't available on this server yet, so they can't be turned on. Check back later."}
          </div>
          <div className="flex justify-end">
            {/* Explicit type: this dialog can render inside the person form's
                <form>, where a typeless button is an implicit submit. */}
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <TextField
            label={isEmail ? "Their email" : "Their phone"}
            type={isEmail ? "email" : "tel"}
            autoComplete="off"
            placeholder={isEmail ? "emma@example.com" : "(555) 123-4567"}
            helper="Saved to the person when you confirm."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />

          <div>
            <Label id={`${messageId}-greeting`}>Greeting</Label>
            <div
              role="group"
              aria-labelledby={`${messageId}-greeting`}
              className="flex flex-wrap gap-2"
            >
              {templatesFor(channel).map((t) => (
                <Chip
                  key={t.id}
                  selected={activeTemplate === t.id}
                  onClick={() => {
                    setCustomPicked(false);
                    setMessage(fillTemplate(t.text, fillOpts));
                  }}
                >
                  {t.label}
                </Chip>
              ))}
              <Chip selected={activeTemplate === null} onClick={() => setCustomPicked(true)}>
                Write your own
              </Chip>
            </div>
          </div>

          <div>
            <Label htmlFor={messageId}>Message</Label>
            <Textarea
              id={messageId}
              value={message}
              maxLength={maxLen}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-ink-muted">
              {isEmail ? (
                <>
                  Subject will be &ldquo;Happy Birthday, {firstName(personName)}!&rdquo; · sent as a
                  designed birthday card
                </>
              ) : (
                <>
                  <span
                    className={
                      message.length > SMS_MAX ? "tabular-nums text-danger-fg" : "tabular-nums"
                    }
                  >
                    {message.length}/{SMS_MAX}
                  </span>{" "}
                  {isWhatsapp
                    ? "· Keep it short and friendly — one message."
                    : "· Keep it short — one message. An emoji costs extra."}
                </>
              )}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-secondary">Send time</label>
            <ReminderTimePicker
              value={sendTime}
              onChange={setSendTime}
              inheritLabel={defaultTimeInheritLabel(user?.defaultReminderTime)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-secondary">
              Time zone
            </label>
            <TimeZonePicker
              value={sendTimeZone}
              onChange={setSendTimeZone}
              inheritLabel={`My timezone (${user?.timezone ?? "auto"})`}
            />
            <p className="mt-1.5 text-xs text-ink-muted">
              Sends at that time in this zone — pick where {firstName(personName)} lives to greet
              them at their local time.
            </p>
          </div>

          {isEmail ? (
            <div className="rounded-lg border border-border-subtle bg-surface-sunken p-4">
              {gmailReady ? (
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok-fg" aria-hidden="true" />
                  <p className="text-sm text-ink-secondary">
                    Sends from <span className="font-medium text-ink">{user?.gmailEmail}</span> — as
                    you, once a year on their birthday at {effectiveTimeLabel}. Your note arrives as a
                    designed birthday card, with a small &ldquo;Sent with Circle the date&rdquo; line
                    at the bottom.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-ink-secondary">
                    This sends from <span className="font-medium text-ink">your Gmail</span>, as
                    you. You&rsquo;ll sign in with Google and allow &ldquo;send email on your
                    behalf&rdquo; — we never see your inbox.
                  </p>
                  {connectWaiting ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm text-ink-muted">
                        Finish connecting in the new tab, then come back here.
                      </p>
                      <Button type="button" variant="secondary" onClick={recheckConnect}>
                        I&rsquo;ve connected
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={startConnect}
                      className="self-start"
                    >
                      Continue with Google
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="rounded-lg border border-border-subtle bg-surface-sunken p-4">
                <p className="text-sm text-ink-secondary">
                  {isWhatsapp
                    ? "The WhatsApp message comes from a shared business number"
                    : "The text comes from a shared number"}{" "}
                  — not yours — and is signed with your name
                  {user?.name ? ` (${user.name})` : ""}, once a year on their birthday at{" "}
                  {effectiveTimeLabel}.
                </p>
              </div>
              {isWhatsapp && activeTemplate === null ? (
                <div className="rounded-lg bg-warn-bg p-4">
                  <p className="text-sm text-warn-fg">
                    WhatsApp can only auto-send an approved template — pick a greeting above. Custom
                    text only reaches them if you already have an open WhatsApp chat.
                  </p>
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-1 flex justify-end gap-3">
            {/* Explicit type: this dialog can render inside the person form's
                <form>, where a typeless button is an implicit submit. */}
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={confirm} disabled={!canConfirm}>
              {alreadyEnabled ? "Save" : "Turn on"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
