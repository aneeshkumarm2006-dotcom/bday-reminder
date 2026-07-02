import { CheckCircle2 } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button, Chip, Icon, Label, Sheet, Text, TextField, useToast } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { connectGmail } from '@/lib/gmail-auth';
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

export type AutoSendDraft = { recipient: string; message: string };

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
  initialRecipient,
  initialMessage,
  alreadyEnabled,
  onConfirm,
}: {
  channel: GreetingChannel;
  visible: boolean;
  onClose: () => void;
  /** For {name} substitution and the fixed email subject preview. */
  personName: string;
  /** Server provisioning flag; undefined = config still loading. */
  available: boolean | undefined;
  initialRecipient: string;
  initialMessage: string;
  /** true → editing an existing setup ("Save"); false → enabling ("Turn on"). */
  alreadyEnabled: boolean;
  onConfirm: (draft: AutoSendDraft) => void | Promise<void>;
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
      setCustomPicked(false);
      setBusy(false);
      setConnecting(false);
    }
  }

  const gmailReady = !!user?.gmailConnected;
  const matched = matchTemplateId(message, channel, fillOpts);
  const activeTemplate = customPicked ? null : matched;

  const onConnectPress = async () => {
    setConnecting(true);
    try {
      const result = await connectGmail();
      if (result === 'connected') await refreshUser();
      else if (result === 'error') toast.show("Couldn't connect Gmail. Please try again.");
      // 'dismissed' → nothing changes; the sheet stays open, still not connected.
    } catch {
      toast.show("Couldn't connect Gmail. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const recipientOk = isEmail ? EMAIL_RE.test(recipient.trim()) : recipient.trim().length > 0;
  const messageOk = message.trim().length > 0 && message.trim().length <= maxLen;
  const canConfirm =
    available === true && recipientOk && messageOk && (!isEmail || gmailReady) && !busy && !connecting;

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await onConfirm({ recipient: recipient.trim(), message: message.trim() });
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
      title={isEmail ? 'Auto-send birthday email' : 'Auto-send birthday SMS'}>
      {available !== true ? (
        <View className="gap-4 pb-2">
          <View className="rounded-sm bg-warn-bg p-3">
            <Text variant="caption" className="text-warn-fg">
              {available === undefined
                ? 'Checking availability…'
                : isEmail
                  ? "Auto-send email isn't available on this server yet, so it can't be turned on. Check back later."
                  : "Auto-send texts aren't available on this server yet, so they can't be turned on. Check back later."}
            </Text>
          </View>
          <Button fullWidth variant="secondary" onPress={onClose}>
            Close
          </Button>
        </View>
      ) : (
        // Keyboard-aware, height-bounded body: the multiline message field sits
        // low in the sheet, so it would otherwise hide behind the keyboard on
        // iOS, and six template chips + fields can overflow small screens.
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: windowHeight * 0.72 }}>
            <View className="gap-4 pb-2">
              <TextField
                label={isEmail ? 'Their email' : 'Their phone'}
                value={recipient}
                onChangeText={setRecipient}
                placeholder={isEmail ? 'emma@example.com' : '(555) 123-4567'}
                keyboardType={isEmail ? 'email-address' : 'phone-pad'}
                autoCapitalize="none"
                autoCorrect={false}
                hint="Saved to the person when you confirm."
              />

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
                    : `${message.length}/${SMS_MAX} · Keep it short — one message. An emoji costs extra.`
                }
              />

              {isEmail ? (
                <View className="rounded-md bg-surface-sunken p-3">
                  {gmailReady ? (
                    <View className="flex-row items-start gap-2.5">
                      <Icon icon={CheckCircle2} size={18} color={t.okFg} />
                      <Text variant="caption" className="flex-1 text-ink-secondary">
                        {`Sends from ${user?.gmailEmail ?? 'your Gmail'} — as you, once a year on their birthday. Your note arrives as a designed birthday card, with a small “Sent with Circle the date” line at the bottom.`}
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
                <View className="rounded-md bg-surface-sunken p-3">
                  <Text variant="caption" className="text-ink-secondary">
                    {`The text comes from a shared number — not yours — and is signed with your name${
                      user?.name ? ` (${user.name})` : ''
                    }, once a year on their birthday.`}
                  </Text>
                </View>
              )}

              <Button fullWidth loading={busy} disabled={!canConfirm} onPress={confirm}>
                {alreadyEnabled ? 'Save' : 'Turn on'}
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Sheet>
  );
}
