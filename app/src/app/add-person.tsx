import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import {
  ChannelToggles,
  DEFAULT_CHANNELS,
  LeadTimeChips,
} from '@/components/reminder-prefs';
import {
  Button,
  Chip,
  Icon,
  Input,
  Label,
  Screen,
  Select,
  Text,
  TextField,
  ToggleRow,
  useToast,
  type SelectOption,
} from '@/components/ui';
import {
  ApiError,
  configApi,
  eventsApi,
  listsApi,
  peopleApi,
  type ChannelPreferences,
  type CreatePersonInput,
  type Feb29Rule,
  type PersonType,
  type SharedListView,
} from '@/lib/api';
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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_OPTIONS: SelectOption[] = MONTHS.map((label, i) => ({ label, value: String(i + 1) }));
const MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

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

const FEB29_OPTIONS: SelectOption[] = [
  { label: 'Feb 28 in common years', value: 'feb28' },
  { label: 'Mar 1 in common years', value: 'mar1' },
  { label: 'Only in leap years', value: 'feb29only' },
];

const CURRENT_YEAR = new Date().getFullYear();

type Errors = { name?: string; dob?: string; year?: string };

/** Lists the caller may add people to — those they own or can edit (FR-43/45). */
function writableLists(lists: SharedListView[]): { id: string; name: string }[] {
  return lists
    .filter((l) => l.permission === 'owner' || l.permission === 'edit')
    .map((l) => ({ id: l.id, name: l.name }));
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
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const defaultChannels = user?.channelPreferences ?? DEFAULT_CHANNELS;
  const defaultLeadDays = user?.defaultLeadDays ?? [0, 7];

  const [name, setName] = useState('');
  const [type, setType] = useState<PersonType>('human');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [relationship, setRelationship] = useState('');
  const [customTag, setCustomTag] = useState(false);
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [feb29Rule, setFeb29Rule] = useState<Feb29Rule>('feb28');

  // Per-event reminder override (applies to this person's birthday event).
  const [birthdayEventId, setBirthdayEventId] = useState<string | null>(null);
  const [overrideOn, setOverrideOn] = useState(false);
  const [overrideLeadDays, setOverrideLeadDays] = useState<number[]>(defaultLeadDays);
  const [overrideChannels, setOverrideChannels] = useState<ChannelPreferences>(defaultChannels);
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

  useEffect(() => {
    let active = true;
    configApi
      .get()
      .then((c) => active && setSmsCap(c.smsWhatsappMonthlyCap))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // When adding (not editing), load the lists the user can place people into.
  useEffect(() => {
    if (isEdit) return; // the edit hydrate below loads lists alongside the person
    let active = true;
    listsApi
      .list()
      .then(({ lists }) => active && setAvailableLists(writableLists(lists)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isEdit]);

  const toggleList = (id: string) =>
    setSelectedLists((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  // Prefill when editing (person fields + the birthday event's override).
  useEffect(() => {
    if (!id) return;
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
        // A stored tag that isn't a preset is a custom one — show the text field.
        setCustomTag(!!tag && !PRESET_TAGS.has(tag));
        setPhone(person.phone ?? '');
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
            birthday.leadDaysOverride != null || birthday.channelOverride != null;
          setOverrideOn(hasOverride);
          if (hasOverride) setOverrideSeeded(true);
          if (birthday.leadDaysOverride != null) setOverrideLeadDays(birthday.leadDaysOverride);
          if (birthday.channelOverride != null)
            setOverrideChannels(fullChannels(birthday.channelOverride, defaultChannels));
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
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        ? { leadDaysOverride: overrideLeadDays, channelOverride: overrideChannels }
        : { leadDaysOverride: null, channelOverride: null },
    );
  };

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
        const { events } = await peopleApi.create({ ...result.input, lists });
        // Only touch the new birthday event when an override was actually set.
        const birthday = events.find((e) => e.type === 'birthday') ?? events[0];
        if (overrideOn && birthday) await applyOverride(birthday.id);
        toast.show('Person added.');
      }
      router.back();
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
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <Icon icon={X} size={24} />
        </Pressable>
      </View>

      {hydrating ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 32, gap: 20 }}>
            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Priya Sharma"
              error={errors.name}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <View>
              <Label>Type</Label>
              <View className="flex-row gap-2">
                <Chip label="Person" selected={type === 'human'} onPress={() => setType('human')} />
                <Chip label="Pet" selected={type === 'pet'} onPress={() => setType('pet')} />
              </View>
            </View>

            <View>
              <Label>Date of birth</Label>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Select
                    value={month || undefined}
                    options={MONTH_OPTIONS}
                    onChange={setMonth}
                    placeholder="Month"
                  />
                </View>
                <View className="w-[72px]">
                  <Input
                    value={day}
                    onChangeText={setDay}
                    placeholder="Day"
                    keyboardType="number-pad"
                    maxLength={2}
                    error={!!errors.dob}
                    accessibilityLabel="Day of birth"
                  />
                </View>
                <View className="w-[92px]">
                  <Input
                    value={year}
                    onChangeText={setYear}
                    placeholder="Year"
                    keyboardType="number-pad"
                    maxLength={4}
                    error={!!errors.year}
                    accessibilityLabel="Year of birth (optional)"
                  />
                </View>
              </View>
              {errors.dob ? (
                <Text variant="caption" className="mt-1.5 text-danger-fg">
                  {errors.dob}
                </Text>
              ) : errors.year ? (
                <Text variant="caption" className="mt-1.5 text-danger-fg">
                  {errors.year}
                </Text>
              ) : (
                <Text variant="caption" className="mt-1.5 text-ink-muted">
                  {"Year is optional — leave it blank if you don't know it."}
                </Text>
              )}
            </View>

            {isLeapDay ? (
              <Select
                label="Observe this birthday"
                value={feb29Rule}
                options={FEB29_OPTIONS}
                onChange={(v) => setFeb29Rule(v as Feb29Rule)}
              />
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
                    placeholder="e.g. Neighbour, Mentor"
                    autoCapitalize="words"
                    maxLength={40}
                    hint="Your own label — it joins the filter chips on the feed."
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
                  className="h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-surface-sunken active:scale-95">
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

            <TextField
              label="Phone"
              optional
              value={phone}
              onChangeText={setPhone}
              placeholder="For the day-of greeting"
              keyboardType="phone-pad"
              hint="Used only to open your own SMS with a prefilled greeting."
            />

            {/* Shared with — add to shared lists the user can edit (Stage 8). */}
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

            {/* Reminder override — collapsed by default (§8.4, FR-21/24). */}
            <View>
              <ToggleRow
                title="Reminder override"
                helper="Use custom lead times and channels just for this person."
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
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
