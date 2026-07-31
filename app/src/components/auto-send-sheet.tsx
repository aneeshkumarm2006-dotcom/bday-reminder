import { CheckCircle2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';

import {
  Button,
  Chip,
  FormScrollView,
  Icon,
  Label,
  Sheet,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import type { SmsChannel } from '@/lib/api';
import {
  defaultTimeInheritLabel,
  friendlyTimeLabel,
  ReminderTimePicker,
  TimeZonePicker,
} from '@/components/reminder-prefs';
import { PhoneField } from '@/components/phone-field';
import { ApiError } from '@/lib/api';
import { connectGmail } from '@/lib/gmail-auth';
import { clearPendingReturn } from '@/lib/pending-return';
import { isE164 } from '@/lib/phone';
import { timeZoneLabel } from '@/lib/timezones';
import {
  defaultGreeting,
  EMAIL_MAX,
  fillTemplate,
  firstName,
  matchTemplateId,
  SMS_MAX,
  templatesFor,
  type GreetingChannel,
} from '@/lib/greeting-templates';
import { useAuth } from '@/providers/auth-provider';
import { useTokens } from '@/theme/theme-provider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AutoSendDraft = {
  recipient: string;
  message: string;
  sendTime: string;
  sendTimeZone: string;
  /** Selected rail for the SMS sheet ('sms' | 'whatsapp'); ignored by the email sheet. */
  smsChannel: SmsChannel;
  /** Chosen greeting preset id, or null for custom text; drives the WhatsApp template. */
  smsTemplateId: string | null;
};

/**
 * Auto-send setup sheet (Stage 14/15) — opened by the auto-send toggles instead
 * of revealing fields inline. One component for both channels. Two modes, set
 * by the parent's `onConfirm`:
 *  - Draft (add/edit person): confirm hands `{recipient, message}` back; the
 *    form syncs its email/phone field and flips its local toggle on.
 *  - Live (person profile): confirm PATCHes the person; a thrown ApiError is
 *    surfaced as a toast and the sheet stays open.
 * The email channel requires a connected Gmail before it can be confirmed —
 * `connectGmail()` runs the OAuth browser session inline from the sheet.
 */
export function AutoSendSheet({
  channel,
  visible,
  onClose,
  personName,
  available,
  whatsappAvailable,
  initialRecipient,
  initialMessage,
  initialSendTime,
  initialSendTimeZone,
  initialSmsChannel = 'sms',
  alreadyEnabled,
  onConfirm,
  onBeforeConnect,
}: {
  channel: GreetingChannel;
  visible: boolean;
  onClose: () => void;
  /** For {name} substitution and the fixed email subject preview. */
  personName: string;
  /** Server provisioning flag for the SMS rail; undefined = config still loading.
   * For the email sheet this is the Gmail auto-send flag. */
  available: boolean | undefined;
  /** Server provisioning flag for the WhatsApp rail (SMS sheet only). */
  whatsappAvailable?: boolean;
  initialRecipient: string;
  initialMessage: string;
  /** Stored "HH:mm" send time; "" = inherit the user's default reminder time. */
  initialSendTime: string;
  /** Stored IANA zone `sendTime` is anchored in; "" = inherit the account timezone. */
  initialSendTimeZone: string;
  /** Stored rail for the SMS sheet ('sms' | 'whatsapp'); defaults to SMS. */
  initialSmsChannel?: SmsChannel;
  /** true → editing an existing setup ("Save"); false → enabling ("Turn on"). */
  alreadyEnabled: boolean;
  onConfirm: (draft: AutoSendDraft) => void | Promise<void>;
  /**
   * Called with the sheet's current values just before the Gmail consent flow
   * opens (email channel only). Android often dispatches the OAuth return as a
   * fresh Intent, which resets the navigation stack and unmounts whatever was
   * behind this sheet — the parent uses this to park its own draft plus these
   * values so both come back intact.
   */
  onBeforeConnect?: (draft: AutoSendDraft) => void | Promise<void>;
}) {
  const toast = useToast();
  const t = useTokens();
  const { height: windowHeight } = useWindowDimensions();
  const { user, refreshUser } = useAuth();
  const isEmail = channel === 'email';
  const fillOpts = { name: personName, sender: user?.name };
  const maxLen = isEmail ? EMAIL_MAX : SMS_MAX;

  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [sendTime, setSendTime] = useState('');
  const [sendTimeZone, setSendTimeZone] = useState('');
  const [smsChannel, setSmsChannel] = useState<SmsChannel>('sms');
  const [customPicked, setCustomPicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Seed the fields whenever the sheet opens. Done during render (guarded by a
  // tracker) rather than in an effect - same pattern as AddEventSheet.
  const [seededVisible, setSeededVisible] = useState(false);
  if (visible !== seededVisible) {
    setSeededVisible(visible);
    if (visible) {
      setRecipient(initialRecipient);
      setMessage(initialMessage.trim() || defaultGreeting(channel, fillOpts));
      setSendTime(initialSendTime);
      setSendTimeZone(initialSendTimeZone);
      setSmsChannel(initialSmsChannel);
      setCustomPicked(false);
      setBusy(false);
      setConnecting(false);
    }
  }

  // The WhatsApp option only shows when that rail is provisioned; when only one
  // rail exists the sheet stays single-channel (its current behavior). Whether
  // the *selected* rail is available drives the gate and the confirm button.
  const isWhatsapp = !isEmail && smsChannel === 'whatsapp';
  const showChannelToggle = !isEmail && (available === true || whatsappAvailable === true);
  const effectiveAvailable = isEmail ? available : isWhatsapp ? whatsappAvailable : available;

  const gmailReady = !!user?.gmailConnected;
  // The time the greeting actually goes out at: the chosen slot, or the user's
  // default reminder time when left on inherit (""). When a send timezone is
  // picked, the time is anchored there (e.g. "9:00 AM EST"), so we note the zone.
  const effectiveTime = friendlyTimeLabel(sendTime || user?.defaultReminderTime);
  const effectiveTimeLabel = sendTimeZone
    ? `${effectiveTime} (${timeZoneLabel(sendTimeZone)})`
    : effectiveTime;
  const matched = matchTemplateId(message, channel, fillOpts);
  const activeTemplate = customPicked ? null : matched;

  /** The sheet exactly as it stands - parked before an auth hand-off, saved on confirm. */
  const currentDraft = (): AutoSendDraft => ({
    recipient: recipient.trim(),
    message: message.trim(),
    sendTime,
    sendTimeZone,
    smsChannel,
    smsTemplateId: isEmail ? null : activeTemplate,
  });

  const onConnectPress = async () => {
    setConnecting(true);
    try {
      // Park the whole screen before the browser takes over; on Android the
      // return trip can wipe the navigation stack out from under us.
      await onBeforeConnect?.(currentDraft());
      const result = await connectGmail();
      if (result === 'connected') {
        // The session captured the redirect, so this screen was never torn down
        // and the parked copy is spent - drop it before it can hijack a later,
        // unrelated connect.
        await clearPendingReturn();
        await refreshUser();
      }
      else if (result === 'error') toast.show("Couldn't connect Gmail. Please try again.");
      // 'dismissed' → nothing changes; the sheet stays open, still not connected.
    } catch {
      toast.show("Couldn't connect Gmail. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  // A half-typed number is stored happily but silently skipped at send time, so
  // the text rails require a complete E.164 number before this can be turned on.
  const recipientOk = isEmail ? EMAIL_RE.test(recipient.trim()) : isE164(recipient);
  const messageOk = message.trim().length > 0 && message.trim().length <= maxLen;
  const canConfirm =
    effectiveAvailable === true &&
    recipientOk &&
    messageOk &&
    (!isEmail || gmailReady) &&
    !busy &&
    !connecting;

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await onConfirm(currentDraft());
      onClose();
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={
        isEmail
          ? 'Auto-send birthday email'
          : isWhatsapp
            ? 'Auto-send birthday WhatsApp'
            : 'Auto-send birthday SMS'
      }>
      {/* Rail picker — only when WhatsApp is also provisioned; otherwise the sheet
          stays single-channel. Sits above the availability gate so you can always
          switch back to an available rail. */}
      {showChannelToggle ? (
        <View className="mb-4">
          <Label>Send by</Label>
          <View className="flex-row gap-2">
            <Chip
              label="SMS"
              selected={!isWhatsapp}
              disabled={available !== true}
              onPress={() => setSmsChannel('sms')}
            />
            <Chip
              label="WhatsApp"
              selected={isWhatsapp}
              disabled={whatsappAvailable !== true}
              onPress={() => setSmsChannel('whatsapp')}
            />
          </View>
        </View>
      ) : null}
      {effectiveAvailable !== true ? (
        <View className="gap-4 pb-2">
          <View className="rounded-sm bg-warn-bg p-3">
            <Text variant="caption" className="text-warn-fg">
              {effectiveAvailable === undefined
                ? 'Checking availability…'
                : isEmail
                  ? "Auto-send email isn't available on this server yet, so it can't be turned on. Check back later."
                  : isWhatsapp
                    ? "Auto-send WhatsApp isn't available on this server yet, so it can't be turned on. Check back later."
                    : "Auto-send texts aren't available on this server yet, so they can't be turned on. Check back later."}
            </Text>
          </View>
          <Button fullWidth variant="secondary" onPress={onClose}>
            Close
          </Button>
        </View>
      ) : (
        // Height-bounded body: six template chips + fields can overflow small
        // screens. The Sheet lifts clear of the keyboard; this scroller then
        // brings whichever field you tapped (the message box sits low) into
        // view inside what's left.
        <FormScrollView style={{ maxHeight: windowHeight * 0.72, flexShrink: 1 }}>
          <View className="gap-4 pb-2">
            {isEmail ? (
              <TextField
                label="Their email"
                value={recipient}
                onChangeText={setRecipient}
                placeholder="emma@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                hint="Saved to the person when you confirm."
              />
            ) : (
              <PhoneField
                label="Their phone"
                value={recipient}
                onChange={setRecipient}
                hint="Saved to the person when you confirm. Pick their country code."
              />
            )}

            <View>
              <Label>Greeting</Label>
              <View className="flex-row flex-wrap gap-2">
                {templatesFor(channel).map((tpl) => (
                  <Chip
                    key={tpl.id}
                    label={tpl.label}
                    selected={activeTemplate === tpl.id}
                    onPress={() => {
                      setCustomPicked(false);
                      setMessage(fillTemplate(tpl.text, fillOpts));
                    }}
                  />
                ))}
                <Chip
                  label="Write your own"
                  selected={activeTemplate === null}
                  onPress={() => setCustomPicked(true)}
                />
              </View>
            </View>

            <TextField
              label="Message"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={isEmail ? 3 : 2}
              maxLength={maxLen}
              autoCapitalize="sentences"
              hint={
                isEmail
                  ? `Subject will be "Happy Birthday, ${firstName(personName)}!" · sent as a designed birthday card`
                  : isWhatsapp
                    ? `${message.length}/${SMS_MAX} · Keep it short and friendly — one message.`
                    : `${message.length}/${SMS_MAX} · Keep it short — one message. An emoji costs extra.`
              }
            />

            <View>
              <Label>Send time</Label>
              <ReminderTimePicker
                value={sendTime}
                onChange={setSendTime}
                inheritLabel={defaultTimeInheritLabel(user?.defaultReminderTime)}
              />
            </View>

            <View>
              <Label>Time zone</Label>
              <TimeZonePicker
                value={sendTimeZone}
                onChange={setSendTimeZone}
                inheritLabel={`My timezone (${user?.timezone ?? 'auto'})`}
              />
              <Text variant="caption" className="mt-1.5 text-ink-muted">
                {`Sends at that time in this zone — pick where ${firstName(personName)} lives to greet them at their local time.`}
              </Text>
            </View>

            {isEmail ? (
              <View className="rounded-md bg-surface-sunken p-3">
                {gmailReady ? (
                  <View className="flex-row items-start gap-2.5">
                    <Icon icon={CheckCircle2} size={18} color={t.okFg} />
                    <Text variant="caption" className="flex-1 text-ink-secondary">
                      {`Sends from ${user?.gmailEmail ?? 'your Gmail'} — as you, once a year on their birthday at ${effectiveTimeLabel}. Your note arrives as a designed birthday card, with a small “Sent with Circle the date” line at the bottom.`}
                    </Text>
                  </View>
                ) : connecting ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator color={t.biro} />
                    <Text variant="caption" className="text-ink-muted">
                      Connecting your Gmail…
                    </Text>
                  </View>
                ) : (
                  <View className="gap-3">
                    <Text variant="caption" className="text-ink-secondary">
                      {"This sends from your Gmail, as you. You'll sign in with Google and allow “send email on your behalf” — we never see your inbox."}
                    </Text>
                    <Button variant="secondary" onPress={onConnectPress}>
                      Continue with Google
                    </Button>
                  </View>
                )}
              </View>
            ) : (
              <View className="gap-2">
                <View className="rounded-md bg-surface-sunken p-3">
                  <Text variant="caption" className="text-ink-secondary">
                    {`${
                      isWhatsapp
                        ? 'The WhatsApp message comes from a shared business number'
                        : 'The text comes from a shared number'
                    } — not yours — and is signed with your name${
                      user?.name ? ` (${user.name})` : ''
                    }, once a year on their birthday at ${effectiveTimeLabel}.`}
                  </Text>
                </View>
                {isWhatsapp && activeTemplate === null ? (
                  <View className="rounded-md bg-warn-bg p-3">
                    <Text variant="caption" className="text-warn-fg">
                      WhatsApp can only auto-send an approved template — pick a greeting above. Custom
                      text only reaches them if you already have an open WhatsApp chat.
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            <Button fullWidth loading={busy} disabled={!canConfirm} onPress={confirm}>
              {alreadyEnabled ? 'Save' : 'Turn on'}
            </Button>
          </View>
        </FormScrollView>
      )}
    </Sheet>
  );
}
