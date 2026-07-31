import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarPlus, Camera, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AddEventSheet } from '@/components/add-event-sheet';
import { AutoSendSheet, type AutoSendDraft } from '@/components/auto-send-sheet';
import { DatePartsField, MAX_DAY } from '@/components/date-parts-field';
import { PhoneField } from '@/components/phone-field';
import {
  ChannelToggles,
  DEFAULT_CHANNELS,
  defaultTimeInheritLabel,
  LeadTimeChips,
  ReminderTimePicker,
} from '@/components/reminder-prefs';
import {
  Button,
  Chip,
  FormScrollView,
  Icon,
  Label,
  Screen,
  Select,
  Text,
  TextField,
  ToggleRow,
  useToast,
  type SelectOption,
} from '@/components/ui';
import { cn, focusRing } from '@/lib/cn';
import {
  ApiError,
  configApi,
  eventsApi,
  listsApi,
  peopleApi,
  type ChannelPreferences,
  type CreatePersonEventInput,
  type CreatePersonInput,
  type Feb29Rule,
  type PersonType,
  type SharedListView,
  type SmsChannel,
} from '@/lib/api';
import { monthAbbr } from '@/lib/dates';
import { eventTypeMeta } from '@/lib/event-style';
import { savePendingReturn, takePendingReturn } from '@/lib/pending-return';
import { formatPhone, isE164 } from '@/lib/phone';
import { pickAndUploadPhoto } from '@/lib/photo';
import { useAuth } from '@/providers/auth-provider';
import { useTokens } from '@/theme/theme-provider';

/**
 * Add / edit person (DESIGN.md §8.8, PRD §9.1). Fields in spec order: name ·
 * date of birth (month + day required, year visibly optional) · relationship ·
 * phone · reminder override (collapsed). Pets are a person-type (FR-17); a
 * Feb-29 birthday reveals the per-person observation rule (FR-15). The reminder
 * override (Stage 5; FR-21/24) sets per-event lead times + channels on the
 * person's birthday event, falling back to the user's defaults when off. On save
 * the person appears immediately in the feed. Photo + notes arrive in Stage 6.
 */

// User-editable tag set (FR-9, §8.7): presets + a "Custom…" entry that reveals a
// free-text field, so the relationship list isn't a fixed enum.
const CUSTOM_TAG = '__custom__';
const RELATIONSHIP_PRESETS = ['Family', 'Friend', 'Colleague', 'Partner', 'Other'];
const RELATIONSHIP_OPTIONS: SelectOption[] = [
  { label: 'No tag', value: '' },
  ...RELATIONSHIP_PRESETS.map((t) => ({ label: t, value: t })),
  { label: 'Custom…', value: CUSTOM_TAG },
];
const PRESET_TAGS = new Set(RELATIONSHIP_PRESETS);

const CURRENT_YEAR = new Date().getFullYear();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = { name?: string; dob?: string; year?: string; email?: string; phone?: string };

/** A prefilled month/day param → the field's string value, or '' if out of range. */
function seedDatePart(raw: string | undefined, min: number, max: number): string {
  if (!raw) return '';
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? String(n) : '';
}

/** Short human date for a pending-event row, e.g. "Jun 12" or "Jun 12, 1990". */
function formatEventDate(date: { month: number; day: number; year?: number | null }): string {
  return `${monthAbbr(date.month)} ${date.day}${date.year != null ? `, ${date.year}` : ''}`;
}

/**
 * Everything typed into this form, parked while the Gmail consent flow runs so
 * an Android deep-link return that resets the navigation stack doesn't throw it
 * away. `openSheet`/`sheetDraft` reopen the auto-send popup exactly as it was.
 */
type PersonFormDraft = {
  name: string;
  type: PersonType;
  month: string;
  day: string;
  year: string;
  relationship: string;
  customTag: boolean;
  phone: string;
  email: string;
  photoUrl: string | null;
  feb29Rule: Feb29Rule;
  pendingEvents: CreatePersonEventInput[];
  autoSendOn: boolean;
  autoSendMessage: string;
  autoSendTime: string;
  autoSendTz: string;
  autoSmsOn: boolean;
  autoSmsChannel: SmsChannel;
  autoSmsTemplateId: string | null;
  autoSmsMessage: string;
  autoSmsTime: string;
  autoSmsTz: string;
  birthdayEventId: string | null;
  overrideOn: boolean;
  overrideLeadDays: number[];
  overrideChannels: ChannelPreferences;
  overrideTime: string;
  overrideSeeded: boolean;
  availableLists: { id: string; name: string }[];
  selectedLists: string[];
  preservedLists: string[];
  openSheet: 'email' | null;
  sheetDraft: AutoSendDraft | null;
};

/** Lists the caller may add people to - every list they own or belong to (FR-43/45). */
function writableLists(lists: SharedListView[]): { id: string; name: string }[] {
  return lists.map((l) => ({ id: l.id, name: l.name }));
}

/** Merge a (possibly partial) stored channel override onto the full default set. */
function fullChannels(
  partial: Partial<ChannelPreferences> | null | undefined,
  base: ChannelPreferences,
): ChannelPreferences {
  return {
    push: partial?.push ?? base.push,
    email: partial?.email ?? base.email,
    sms: partial?.sms ?? base.sms,
    inApp: partial?.inApp ?? base.inApp,
  };
}

export default function AddPersonScreen() {
  const router = useRouter();
  const toast = useToast();
  const t = useTokens();
  const { user } = useAuth();
  const { id, month: monthParam, day: dayParam, resume, gmail } = useLocalSearchParams<{
    id?: string;
    month?: string;
    day?: string;
    /** '1' → came back from Gmail consent; restore the parked draft. */
    resume?: string;
    /** 'error' → that consent round-trip failed; say so once we're back. */
    gmail?: string;
  }>();
  const isEdit = !!id;

  const defaultChannels = user?.channelPreferences ?? DEFAULT_CHANNELS;
  const defaultLeadDays = user?.defaultLeadDays ?? [0, 7];

  const [name, setName] = useState('');
  const [type, setType] = useState<PersonType>('human');
  // Prefill the date when added from the Calendar (tap a day → add a birthday on
  // it). Only when not editing - the edit hydrate below owns the fields for ?id=.
  const [month, setMonth] = useState(() => (!id ? seedDatePart(monthParam, 1, 12) : ''));
  const [day, setDay] = useState(() => (!id ? seedDatePart(dayParam, 1, 31) : ''));
  const [year, setYear] = useState('');
  const [relationship, setRelationship] = useState('');
  const [customTag, setCustomTag] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [feb29Rule, setFeb29Rule] = useState<Feb29Rule>('feb28');

  // Extra dates (anniversary/custom) added while creating the person; held
  // locally and saved atomically with them (add mode only - editing manages
  // events from the profile). The sheet reuses the profile's AddEventSheet.
  const [pendingEvents, setPendingEvents] = useState<CreatePersonEventInput[]>([]);
  const [eventSheetOpen, setEventSheetOpen] = useState(false);

  // Auto-send birthday email (Stage 14). Sends a greeting to `email` on the
  // birthday, from the user's connected Gmail. Configured in the AutoSendSheet
  // popup (template, message, Gmail permission); the toggle only flips ON once
  // that's confirmed. `gmailAvailable` = server-provisioned (undefined while
  // the config loads; when false the sheet shows a "not available" notice).
  const [autoSendOn, setAutoSendOn] = useState(false);
  const [autoSendMessage, setAutoSendMessage] = useState('');
  const [autoSendTime, setAutoSendTime] = useState('');
  const [autoSendTz, setAutoSendTz] = useState('');
  const [emailSheetOpen, setEmailSheetOpen] = useState(false);
  const [gmailAvailable, setGmailAvailable] = useState<boolean | undefined>(undefined);
  // Restored sheet values after a Gmail round-trip - they seed the sheet instead
  // of the form's fields, so a half-written greeting comes back untouched.
  const [emailSheetSeed, setEmailSheetSeed] = useState<AutoSendDraft | null>(null);

  // Auto-send birthday SMS (Stage 15). Texts a greeting to `phone` on the
  // birthday via one shared Twilio account - no per-user connect step, so it
  // just needs a phone. Same popup flow.
  const [autoSmsOn, setAutoSmsOn] = useState(false);
  const [autoSmsChannel, setAutoSmsChannel] = useState<SmsChannel>('sms');
  const [autoSmsTemplateId, setAutoSmsTemplateId] = useState<string | null>(null);
  const [autoSmsMessage, setAutoSmsMessage] = useState('');
  const [autoSmsTime, setAutoSmsTime] = useState('');
  const [autoSmsTz, setAutoSmsTz] = useState('');
  const [smsSheetOpen, setSmsSheetOpen] = useState(false);
  const [smsAutoSendAvailable, setSmsAutoSendAvailable] = useState<boolean | undefined>(undefined);
  const [whatsappAutoSendAvailable, setWhatsappAutoSendAvailable] = useState<boolean | undefined>(
    undefined,
  );

  // Per-event reminder override (applies to this person's birthday event).
  const [birthdayEventId, setBirthdayEventId] = useState<string | null>(null);
  const [overrideOn, setOverrideOn] = useState(false);
  const [overrideLeadDays, setOverrideLeadDays] = useState<number[]>(defaultLeadDays);
  const [overrideChannels, setOverrideChannels] = useState<ChannelPreferences>(defaultChannels);
  // "" => inherit the user's global default reminder time; "HH:mm" => a set time.
  const [overrideTime, setOverrideTime] = useState<string>('');
  // True once the override has been seeded (from an existing event or on enable)
  // so we don't re-seed over the user's tweaks.
  const [overrideSeeded, setOverrideSeeded] = useState(false);
  const [smsCap, setSmsCap] = useState<number | null>(null);

  // Shared lists this person belongs to (Stage 8; FR-43/44). `selected` are the
  // writable lists the user toggles; `preserved` are any memberships in lists the
  // user can't manage, kept on save so an edit never silently drops them.
  const [availableLists, setAvailableLists] = useState<{ id: string; name: string }[]>([]);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [preservedLists, setPreservedLists] = useState<string[]>([]);

  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrating, setHydrating] = useState(isEdit);

  // 'pending' → a parked draft is being read back, so the normal seeding (server
  // hydrate, list fetch) holds off and can't race it; 'restored' → the draft won
  // and that seeding must stay off; 'none' → nothing parked, seed as usual.
  const [resumeState, setResumeState] = useState<'pending' | 'restored' | 'none'>(
    resume === '1' ? 'pending' : 'none',
  );

  useEffect(() => {
    let active = true;
    configApi
      .get()
      .then((c) => {
        if (!active) return;
        setSmsCap(c.smsWhatsappMonthlyCap);
        setGmailAvailable(!!c.gmailAutoSendAvailable);
        setSmsAutoSendAvailable(!!c.smsAutoSendAvailable);
        setWhatsappAutoSendAvailable(!!c.whatsappAutoSendAvailable);
      })
      .catch(() => {
        // Treat a failed config fetch as "not available" rather than leaving
        // the sheets stuck on their checking state.
        if (!active) return;
        setGmailAvailable(false);
        setSmsAutoSendAvailable(false);
        setWhatsappAutoSendAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Coming back from Gmail consent: put the form back exactly as it was left and
  // reopen the auto-send sheet on top of it. Consuming the parked record here is
  // what keeps it from leaking into an unrelated visit later.
  useEffect(() => {
    if (resumeState !== 'pending') return;
    let active = true;
    (async () => {
      const parked = await takePendingReturn<PersonFormDraft>();
      if (!active) return;
      const d = parked?.draft;
      if (d) {
        setName(d.name);
        setType(d.type);
        setMonth(d.month);
        setDay(d.day);
        setYear(d.year);
        setRelationship(d.relationship);
        setCustomTag(d.customTag);
        setPhone(d.phone);
        setEmail(d.email);
        setPhotoUrl(d.photoUrl);
        setFeb29Rule(d.feb29Rule);
        setPendingEvents(d.pendingEvents);
        setAutoSendOn(d.autoSendOn);
        setAutoSendMessage(d.autoSendMessage);
        setAutoSendTime(d.autoSendTime);
        setAutoSendTz(d.autoSendTz);
        setAutoSmsOn(d.autoSmsOn);
        setAutoSmsChannel(d.autoSmsChannel);
        setAutoSmsTemplateId(d.autoSmsTemplateId);
        setAutoSmsMessage(d.autoSmsMessage);
        setAutoSmsTime(d.autoSmsTime);
        setAutoSmsTz(d.autoSmsTz);
        setBirthdayEventId(d.birthdayEventId);
        setOverrideOn(d.overrideOn);
        setOverrideLeadDays(d.overrideLeadDays);
        setOverrideChannels(d.overrideChannels);
        setOverrideTime(d.overrideTime);
        setOverrideSeeded(d.overrideSeeded);
        setAvailableLists(d.availableLists);
        setSelectedLists(d.selectedLists);
        setPreservedLists(d.preservedLists);
        if (d.openSheet === 'email') {
          setEmailSheetSeed(d.sheetDraft);
          setEmailSheetOpen(true);
        }
        setHydrating(false);
        // 'restored' keeps the server hydrate and list fetch off - the draft is
        // authoritative, including any edits made before leaving for Google.
        setResumeState('restored');
        if (gmail === 'error') toast.show("Couldn't connect Gmail. Please try again.");
        return;
      }
      // Nothing parked (expired, or storage failed) - seed the normal way.
      setResumeState('none');
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeState]);

  // The greeting templates personalize with the person's first name, so ask for
  // the name before opening the setup sheet — otherwise "Happy birthday, there!"
  // gets baked into the saved message.
  const openAutoSendSheet = (channel: 'email' | 'sms') => {
    if (!name.trim()) {
      toast.show('Add their name first — the greeting uses it.');
      return;
    }
    if (channel === 'email') setEmailSheetOpen(true);
    else setSmsSheetOpen(true);
  };

  // When adding (not editing), load the lists the user can place people into.
  useEffect(() => {
    if (isEdit) return; // the edit hydrate below loads lists alongside the person
    if (resumeState !== 'none') return; // a restore owns the fields
    let active = true;
    listsApi
      .list()
      .then(({ lists }) => active && setAvailableLists(writableLists(lists)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isEdit, resumeState]);

  const toggleList = (id: string) =>
    setSelectedLists((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  // Prefill when editing (person fields + the birthday event's override).
  useEffect(() => {
    if (!id) return;
    if (resumeState !== 'none') return; // a restore owns the fields
    let active = true;
    (async () => {
      try {
        const [{ person, events }, listsRes] = await Promise.all([
          peopleApi.get(id),
          listsApi.list().catch(() => ({ lists: [] as SharedListView[] })),
        ]);
        if (!active) return;
        setName(person.fullName);
        setType(person.type);
        setMonth(String(person.dob.month));
        setDay(String(person.dob.day));
        setYear(person.dob.year != null ? String(person.dob.year) : '');
        const tag = person.relationshipTag ?? '';
        setRelationship(tag);
        // A stored tag that isn't a preset is a custom one - show the text field.
        setCustomTag(!!tag && !PRESET_TAGS.has(tag));
        // Stored as E.164; PhoneField splits it back into country + number.
        setPhone(person.phone ?? '');
        setEmail(person.email ?? '');
        setAutoSendOn(person.autoBirthdayEmail?.enabled ?? false);
        setAutoSendMessage(person.autoBirthdayEmail?.message ?? '');
        setAutoSendTime(person.autoBirthdayEmail?.sendTime ?? '');
        setAutoSendTz(person.autoBirthdayEmail?.sendTimeZone ?? '');
        setAutoSmsOn(person.autoBirthdaySms?.enabled ?? false);
        setAutoSmsChannel(person.autoBirthdaySms?.channel ?? 'sms');
        setAutoSmsTemplateId(person.autoBirthdaySms?.templateId ?? null);
        setAutoSmsMessage(person.autoBirthdaySms?.message ?? '');
        setAutoSmsTime(person.autoBirthdaySms?.sendTime ?? '');
        setAutoSmsTz(person.autoBirthdaySms?.sendTimeZone ?? '');
        setPhotoUrl(person.photoUrl ?? null);
        setFeb29Rule(person.feb29Rule);

        // Seed list memberships: split the person's lists into ones the user can
        // toggle (writable) and ones to silently preserve on save.
        const writable = writableLists(listsRes.lists);
        const writableIds = new Set(writable.map((l) => l.id));
        setAvailableLists(writable);
        setSelectedLists(person.lists.filter((listId) => writableIds.has(listId)));
        setPreservedLists(person.lists.filter((listId) => !writableIds.has(listId)));

        const birthday = events.find((e) => e.type === 'birthday') ?? events[0];
        if (birthday) {
          setBirthdayEventId(birthday.id);
          const hasOverride =
            birthday.leadDaysOverride != null ||
            birthday.channelOverride != null ||
            birthday.reminderTimeOverride != null;
          setOverrideOn(hasOverride);
          if (hasOverride) setOverrideSeeded(true);
          if (birthday.leadDaysOverride != null) setOverrideLeadDays(birthday.leadDaysOverride);
          if (birthday.channelOverride != null)
            setOverrideChannels(fullChannels(birthday.channelOverride, defaultChannels));
          setOverrideTime(birthday.reminderTimeOverride ?? '');
        }
      } catch (e) {
        if (active)
          setSubmitError(
            e instanceof ApiError ? e.message : "Couldn't load this person. Try again.",
          );
      } finally {
        if (active) setHydrating(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, resumeState]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLeapDay = month === '2' && day === '29';

  const validate = (): { ok: false } | { ok: true; input: CreatePersonInput } => {
    const next: Errors = {};
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);

    if (!name.trim()) next.name = 'Add a name so you know who this is.';
    if (!month) next.dob = 'Pick a birth month.';
    else if (!day.trim() || Number.isNaN(d) || d < 1 || d > 31)
      next.dob = 'Enter a day from 1 to 31.';
    else if (d > MAX_DAY[m - 1]) next.dob = "That day doesn't exist in that month.";

    let parsedYear: number | null = null;
    if (year.trim()) {
      const y = parseInt(year, 10);
      if (Number.isNaN(y) || y < 1900 || y > CURRENT_YEAR)
        next.year = `Enter a year between 1900 and ${CURRENT_YEAR}.`;
      else parsedYear = y;
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) next.email = 'Enter a valid email address.';
    else if (autoSendOn && !trimmedEmail)
      next.email = 'Add an email so the birthday greeting has somewhere to go.';

    if (autoSmsOn && !phone.trim())
      next.phone = 'Add a phone so the birthday SMS has somewhere to go.';
    // A half-typed number would save fine and then be skipped at send time, so
    // catch it here while the country picker is still on screen.
    else if (phone.trim() && !isE164(phone))
      next.phone = 'That number looks incomplete — check the digits.';

    setErrors(next);
    if (Object.keys(next).length > 0) return { ok: false };

    const tag = relationship.trim();
    return {
      ok: true,
      input: {
        fullName: name.trim(),
        type,
        dob: { month: m, day: d, year: parsedYear },
        relationshipTag: tag ? tag : null,
        phone: phone.trim() ? phone.trim() : null,
        email: trimmedEmail ? trimmedEmail : null,
        autoBirthdayEmail: {
          enabled: autoSendOn,
          message: autoSendMessage.trim() ? autoSendMessage.trim() : null,
          sendTime: autoSendTime || null,
          sendTimeZone: autoSendTz || null,
        },
        autoBirthdaySms: {
          enabled: autoSmsOn,
          channel: autoSmsChannel,
          templateId: autoSmsTemplateId,
          message: autoSmsMessage.trim() ? autoSmsMessage.trim() : null,
          sendTime: autoSmsTime || null,
          sendTimeZone: autoSmsTz || null,
        },
        photoUrl: photoUrl ?? null,
        feb29Rule: isLeapDay ? feb29Rule : 'feb28',
      },
    };
  };

  // Pick a photo from the library and host it; store the returned URL (FR-10).
  const onPickPhoto = async () => {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const r = await pickAndUploadPhoto();
      if (r.status === 'uploaded') setPhotoUrl(r.result.url);
      else if (r.status === 'denied') toast.show('Photo access is off. Enable it to add a photo.');
      else if (r.status === 'error') toast.show(r.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  // Relationship select handles the "Custom…" sentinel by revealing a text field.
  const onChangeRelationship = (value: string) => {
    if (value === CUSTOM_TAG) {
      setCustomTag(true);
      setRelationship('');
    } else {
      setCustomTag(false);
      setRelationship(value);
    }
  };

  // Seed the override from the user's *current* global defaults when it's first
  // switched on (read live, so it's correct even if the user hydrated after
  // mount). An override loaded from an existing event is left as-is.
  const onToggleOverride = (on: boolean) => {
    if (on && !overrideSeeded) {
      setOverrideLeadDays(user?.defaultLeadDays ?? [0, 7]);
      setOverrideChannels(user?.channelPreferences ?? DEFAULT_CHANNELS);
      setOverrideSeeded(true);
    }
    setOverrideOn(on);
  };

  // Push the override onto the birthday event (or clear it → use defaults).
  const applyOverride = async (eventId: string) => {
    await eventsApi.update(
      eventId,
      overrideOn
        ? {
            leadDaysOverride: overrideLeadDays,
            channelOverride: overrideChannels,
            reminderTimeOverride: overrideTime || null,
          }
        : { leadDaysOverride: null, channelOverride: null, reminderTimeOverride: null },
    );
  };

  // Closing / finishing this screen. After a deep-link resume the stack can be
  // just this screen, so back() has nowhere to go - land somewhere sensible.
  const leave = () => {
    if (router.canGoBack()) router.back();
    else if (id) router.replace({ pathname: '/person/[id]', params: { id } });
    else router.replace('/');
  };

  // Park the whole form (plus the open sheet's own values) before the Gmail
  // consent flow takes the browser - and, on Android, often the nav stack too.
  const parkForGmail = (sheetDraft: AutoSendDraft) =>
    savePendingReturn<PersonFormDraft>({
      pathname: '/add-person',
      params: id ? { id } : {},
      draft: {
        name, type, month, day, year, relationship, customTag, phone, email,
        photoUrl, feb29Rule, pendingEvents,
        autoSendOn, autoSendMessage, autoSendTime, autoSendTz,
        autoSmsOn, autoSmsChannel, autoSmsTemplateId, autoSmsMessage, autoSmsTime, autoSmsTz,
        birthdayEventId, overrideOn, overrideLeadDays, overrideChannels, overrideTime,
        overrideSeeded, availableLists, selectedLists, preservedLists,
        openSheet: 'email',
        sheetDraft,
      },
    });

  const submit = async () => {
    setSubmitError(null);
    const result = validate();
    if (!result.ok) return;

    // Shared-list memberships: writable selections + any preserved memberships.
    const lists = [...preservedLists, ...selectedLists];

    setSaving(true);
    try {
      if (isEdit && id) {
        await peopleApi.update(id, { ...result.input, lists });
        if (birthdayEventId) await applyOverride(birthdayEventId);
        toast.show('Saved changes.');
      } else {
        const { events } = await peopleApi.create({
          ...result.input,
          lists,
          // Extra anniversary/custom dates created with the person (FR-16).
          events: pendingEvents.length > 0 ? pendingEvents : undefined,
        });
        // Only touch the new birthday event when an override was actually set.
        const birthday = events.find((e) => e.type === 'birthday') ?? events[0];
        if (overrideOn && birthday) await applyOverride(birthday.id);
        toast.show('Person added.');
      }
      leave();
    } catch (e) {
      setSubmitError(
        e instanceof ApiError ? e.message : "Couldn't save. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between pb-2 pt-3">
        <Text variant="title">{isEdit ? 'Edit person' : 'Add person'}</Text>
        <Pressable
          onPress={leave}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className={cn('rounded-full', focusRing)}>
          <Icon icon={X} size={24} />
        </Pressable>
      </View>

      {hydrating || resumeState === 'pending' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <>
        <FormScrollView contentContainerStyle={{ paddingBottom: 32, gap: 20 }}>
          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Emma Carter"
            error={errors.name}
            autoCapitalize="words"
            returnKeyType="next"
          />

          {/* Person vs pet (FR-17). Everything else in the form is shared —
              pet-specific rendering (paw icon, no age) lives on the feed and
              profile, keyed off this type. */}
          <View>
            <Label>Type</Label>
            <View className="flex-row gap-2">
              <Chip label="Person" selected={type === 'human'} onPress={() => setType('human')} />
              <Chip label="Pet" selected={type === 'pet'} onPress={() => setType('pet')} />
            </View>
          </View>

          <DatePartsField
            value={{ month, day, year }}
            onChange={(next) => {
              setMonth(next.month);
              setDay(next.day);
              setYear(next.year);
            }}
            error={errors.dob}
            yearError={errors.year}
            feb29Rule={feb29Rule}
            onFeb29RuleChange={(v) => setFeb29Rule(v as Feb29Rule)}
          />

          {/* Other dates - anniversaries / custom events created with the
              person (FR-16). Add mode only; editing manages these on the
              profile, which already supports it. */}
          {!isEdit ? (
            <View>
              <Label optional>Other dates</Label>
              <View className="gap-2">
                {pendingEvents.map((ev, i) => {
                  const meta = eventTypeMeta({ eventType: ev.type, customName: ev.customName ?? null });
                  return (
                    <View
                      key={`${ev.type}-${i}`}
                      className="flex-row items-center gap-3 rounded-md border border-border-subtle bg-surface px-3 py-2.5">
                      <Icon icon={meta.Icon} size={18} color={t[meta.tokenKey]} />
                      <View className="flex-1">
                        <Text variant="body">{meta.label}</Text>
                        <Text variant="caption" className="text-ink-muted">
                          {formatEventDate(ev.date)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setPendingEvents((cur) => cur.filter((_, j) => j !== i))}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${meta.label}`}
                        className={cn('rounded-full p-1', focusRing)}>
                        <Icon icon={X} size={18} color={t.inkMuted} />
                      </Pressable>
                    </View>
                  );
                })}
                <Pressable
                  onPress={() => setEventSheetOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Add event"
                  className={cn(
                    'flex-row items-center justify-center gap-2 rounded-md border border-dashed border-border-strong py-3',
                    focusRing,
                  )}>
                  <Icon icon={CalendarPlus} size={18} color={t.biro} />
                  <Text variant="button" className="text-biro">
                    Add event
                  </Text>
                </Pressable>
              </View>
              <Text variant="caption" className="mt-1.5 text-ink-muted">
                Anniversaries or custom dates. They appear on the calendar and remind you like
                birthdays.
              </Text>
            </View>
          ) : null}

          <View>
            <Select
              label="Relationship"
              value={customTag ? CUSTOM_TAG : relationship}
              options={RELATIONSHIP_OPTIONS}
              onChange={onChangeRelationship}
              placeholder="No tag"
            />
            {customTag ? (
              <View className="mt-2">
                <TextField
                  value={relationship}
                  onChangeText={setRelationship}
                  placeholder="e.g. Neighbor, Mentor"
                  autoCapitalize="words"
                  maxLength={40}
                  hint="Your own label, it joins the filter chips on the feed."
                />
              </View>
            ) : null}
          </View>

          <View>
            <Label optional>Photo</Label>
            <View className="flex-row items-center gap-4">
              <Pressable
                onPress={onPickPhoto}
                accessibilityRole="button"
                accessibilityLabel={photoUrl ? 'Change photo' : 'Add photo'}
                className={cn(
                  'h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-surface-sunken active:scale-95',
                  focusRing,
                )}>
                {photoBusy ? (
                  <ActivityIndicator color={t.biro} />
                ) : photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={{ width: 64, height: 64 }} contentFit="cover" />
                ) : (
                  <Icon icon={Camera} size={24} color={t.inkMuted} />
                )}
              </Pressable>
              <View className="flex-row gap-2">
                <Button variant="secondary" onPress={onPickPhoto} loading={photoBusy}>
                  {photoUrl ? 'Change' : 'Add photo'}
                </Button>
                {photoUrl ? (
                  <Button variant="ghost" onPress={() => setPhotoUrl(null)}>
                    Remove
                  </Button>
                ) : null}
              </View>
            </View>
          </View>

          <PhoneField
            label="Phone"
            optional
            value={phone}
            onChange={setPhone}
            error={errors.phone}
            hint="Used for the day-of greeting shortcut and auto-send SMS. Pick their country — the code is part of the number."
          />

          <TextField
            label="Email"
            optional
            value={email}
            onChangeText={setEmail}
            placeholder="emma@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
            hint="Where an auto-sent birthday greeting would go."
          />

          {/* Auto-send birthday email (Stage 14) — turning it on opens the
              setup sheet (template, message, Gmail permission); the toggle
              only flips ON once that's confirmed there. */}
          <View>
            <ToggleRow
              title="Auto-send birthday email"
              helper="Email a greeting on their birthday, sent from your Gmail as you."
              value={autoSendOn}
              onValueChange={(on) => (on ? openAutoSendSheet('email') : setAutoSendOn(false))}
            />
            {autoSendOn ? (
              <View className="mt-1 flex-row flex-wrap items-center gap-x-1">
                <Text variant="caption" className="text-ink-muted">
                  {`To ${email.trim() || 'their email'}${
                    user?.gmailEmail ? ` from ${user.gmailEmail}` : ''
                  }, every year.`}
                </Text>
                <Pressable
                  onPress={() => setEmailSheetOpen(true)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Edit the birthday email message"
                  className={cn('rounded-sm', focusRing)}>
                  <Text variant="caption" className="font-body-medium text-biro">
                    Edit message
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Text variant="caption" className="mt-1 text-ink-muted">
                {user?.gmailConnected
                  ? 'Off. Your Gmail is connected and ready.'
                  : "Off. You'll connect your Gmail when you turn this on."}
              </Text>
            )}
          </View>

          {/* Auto-send birthday SMS (Stage 15) — same sheet flow, no per-user
              account to connect (one shared Twilio number). */}
          <View>
            <ToggleRow
              title="Auto-send birthday text"
              helper="Send a greeting on their birthday by SMS or WhatsApp, signed with your name."
              value={autoSmsOn}
              onValueChange={(on) => (on ? openAutoSendSheet('sms') : setAutoSmsOn(false))}
            />
            {autoSmsOn ? (
              <View className="mt-1 flex-row flex-wrap items-center gap-x-1">
                <Text variant="caption" className="text-ink-muted">
                  {`By ${autoSmsChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to ${formatPhone(phone) || 'their phone'}, signed ${user?.name || 'you'}, every year.`}
                </Text>
                <Pressable
                  onPress={() => setSmsSheetOpen(true)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Edit the birthday SMS message"
                  className={cn('rounded-sm', focusRing)}>
                  <Text variant="caption" className="font-body-medium text-biro">
                    Edit message
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Text variant="caption" className="mt-1 text-ink-muted">
                Off. Sent from a shared number, signed with your name.
              </Text>
            )}
          </View>

          {/* Shared with - add to shared lists the user can edit (Stage 8). */}
          {availableLists.length > 0 ? (
            <View>
              <Label optional>Shared with</Label>
              <View className="flex-row flex-wrap gap-2">
                {availableLists.map((list) => (
                  <Chip
                    key={list.id}
                    label={list.name}
                    selected={selectedLists.includes(list.id)}
                    onPress={() => toggleList(list.id)}
                  />
                ))}
              </View>
              <Text variant="caption" className="mt-1.5 text-ink-muted">
                Everyone in a list sees this person and gets their own reminders.
              </Text>
            </View>
          ) : null}

          {/* Reminder override - collapsed by default (§8.4, FR-21/24). */}
          <View>
            <ToggleRow
              title="Reminder override"
              helper="Use custom lead times, channels and time of day just for this person."
              value={overrideOn}
              onValueChange={onToggleOverride}
            />
            {overrideOn ? (
              <View className="mt-1 gap-4 border-l-2 border-border-subtle pl-3">
                <View>
                  <Label>Remind me ahead of time</Label>
                  <LeadTimeChips value={overrideLeadDays} onChange={setOverrideLeadDays} />
                </View>
                <View>
                  <Label>Reminder time</Label>
                  <ReminderTimePicker
                    value={overrideTime}
                    onChange={setOverrideTime}
                    inheritLabel={defaultTimeInheritLabel(user?.defaultReminderTime)}
                  />
                </View>
                <View>
                  <Label>Notify me by</Label>
                  <ChannelToggles
                    value={overrideChannels}
                    onChange={setOverrideChannels}
                    smsCap={smsCap}
                    zeroMessage="You won't be reminded for this event."
                  />
                </View>
              </View>
            ) : (
              <Text variant="caption" className="mt-1 text-ink-muted">
                Uses your default reminders.
              </Text>
            )}
          </View>

          {submitError ? (
            <Text variant="caption" className="text-danger-fg">
              {submitError}
            </Text>
          ) : null}

          <Button fullWidth loading={saving} onPress={submit}>
            {isEdit ? 'Save changes' : 'Save person'}
          </Button>
        </FormScrollView>
        {!isEdit ? (
          <AddEventSheet
            visible={eventSheetOpen}
            onClose={() => setEventSheetOpen(false)}
            onAdd={(draft) => setPendingEvents((cur) => [...cur, draft])}
          />
        ) : null}

        {/* Auto-send setup sheets (draft mode: confirm updates form state; the
            person is saved on submit). Confirm also syncs the recipient back
            into the Email/Phone field above. */}
        <AutoSendSheet
          channel="email"
          visible={emailSheetOpen}
          onClose={() => {
            setEmailSheetOpen(false);
            setEmailSheetSeed(null);
          }}
          personName={name}
          available={gmailAvailable}
          initialRecipient={emailSheetSeed?.recipient ?? email}
          initialMessage={emailSheetSeed?.message ?? autoSendMessage}
          initialSendTime={emailSheetSeed?.sendTime ?? autoSendTime}
          initialSendTimeZone={emailSheetSeed?.sendTimeZone ?? autoSendTz}
          alreadyEnabled={autoSendOn}
          onBeforeConnect={parkForGmail}
          onConfirm={({ recipient, message, sendTime, sendTimeZone }) => {
            setEmail(recipient);
            setAutoSendMessage(message);
            setAutoSendTime(sendTime);
            setAutoSendTz(sendTimeZone);
            setAutoSendOn(true);
          }}
        />
        <AutoSendSheet
          channel="sms"
          visible={smsSheetOpen}
          onClose={() => setSmsSheetOpen(false)}
          personName={name}
          available={smsAutoSendAvailable}
          whatsappAvailable={whatsappAutoSendAvailable}
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
        </>
      )}
    </Screen>
  );
}
