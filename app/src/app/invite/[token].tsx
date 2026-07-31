import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Cake, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import {
  DatePartsField,
  EMPTY_DATE_PARTS,
  MAX_DAY,
  fromDateParts,
  toDateParts,
  type DatePartsStrings,
} from '@/components/date-parts-field';
import { ListCatchUp } from '@/components/list-catch-up';
import { Button, Screen, Text, ToggleRow } from '@/components/ui';
import { ApiError, invitesApi, type InvitePreview, type SharedListView } from '@/lib/api';
import { cn, focusRing } from '@/lib/cn';
import { monthAbbr } from '@/lib/dates';
import { useAuth } from '@/providers/auth-provider';
import { useTokens } from '@/theme/theme-provider';

/**
 * Invite acceptance (DESIGN.md §8.9; FR-42). Reached from an invite link
 * (`/invite/<token>`) or by pasting a code on the Lists screen. Membership is
 * never automatic - the user sees who invited them and to what, then explicitly
 * accepts before gaining access.
 *
 * Three steps rather than one button, because joining is an exchange: you get
 * everyone's birthdays, and yours goes in so they get reminded about you too.
 * The middle step is where you agree to your half (or decline it), and the last
 * is where you decide how much of their half you actually want.
 */
type Step = 'preview' | 'birthday' | 'catchup';

export default function InviteScreen() {
  const router = useRouter();
  const t = useTokens();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user, refreshUser } = useAuth();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const [step, setStep] = useState<Step>('preview');
  const [shareBirthday, setShareBirthday] = useState(true);
  const [editingDate, setEditingDate] = useState(false);
  const [birthday, setBirthday] = useState<DatePartsStrings>(EMPTY_DATE_PARTS);
  const [dateError, setDateError] = useState<string | undefined>(undefined);
  const [joined, setJoined] = useState<SharedListView | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const res = await invitesApi.preview(token);
        if (!active) return;
        setPreview(res.invite);
        setBirthday(fromDateParts(res.invite.yourBirthday));
      } catch (e) {
        if (active)
          setError(
            e instanceof ApiError ? e.message : "That invite link didn't work. Ask for a new one.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const storedBirthday = preview?.yourBirthday ?? user?.birthday ?? null;
  const knowsBirthday = !!storedBirthday && !editingDate;

  const accept = async (share: boolean) => {
    if (!token || accepting) return;

    // Only send a date when we're actually collecting one - the server never
    // overwrites a birthday it already has.
    let dob: { month: number; day: number; year: number | null } | undefined;
    if (share && !knowsBirthday) {
      const parsed = toDateParts(birthday);
      if (!parsed) return setDateError('Add the month and day of your birthday.');
      if (parsed.day > MAX_DAY[parsed.month - 1]) {
        return setDateError("That day doesn't exist in that month.");
      }
      dob = parsed;
    }
    setDateError(undefined);
    setAccepting(true);
    try {
      const res = await invitesApi.accept(token, {
        shareBirthday: share,
        ...(dob ? { birthday: dob } : {}),
      });
      await refreshUser();
      setAccepting(false);
      // Nothing to catch up on in an empty list - go straight to it.
      if (res.peopleCount > 0) {
        setJoined(res.list);
        setStep('catchup');
      } else {
        router.replace(`/list/${res.list.id}`);
      }
    } catch (e) {
      setAccepting(false);
      setError(e instanceof ApiError ? e.message : "Couldn't accept the invite. Try again.");
    }
  };

  // The catch-up needs the full height; the other two steps are a centered card.
  if (step === 'catchup' && joined) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
        <ListCatchUp
          listId={joined.id}
          listName={joined.name}
          onDone={() => router.replace(`/list/${joined.id}`)}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      <View className="flex-1 items-center justify-center px-6">
        {loading ? (
          <ActivityIndicator color={t.biro} />
        ) : error ? (
          <View className="items-center gap-4">
            <Text variant="heading" className="text-center">
              {error}
            </Text>
            <Button variant="secondary" onPress={() => router.replace('/lists')}>
              Go to Lists
            </Button>
          </View>
        ) : preview ? (
          <View className="w-full max-w-[360px] items-center">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-surface-sunken">
              {step === 'birthday' ? (
                <Cake color={t.inkMuted} size={24} strokeWidth={1.75} />
              ) : (
                <Users color={t.inkMuted} size={24} strokeWidth={1.75} />
              )}
            </View>

            {step === 'preview' ? (
              <>
                <Text variant="heading" className="text-center">
                  {preview.inviterName} invited you to “{preview.listName}”
                </Text>
                <Text variant="body" className="mt-2 text-center text-ink-secondary">
                  {preview.peopleCount === 0
                    ? 'You’ll see everyone in this list and can add and edit them, with your own reminder settings.'
                    : `${preview.peopleCount} ${preview.peopleCount === 1 ? 'birthday is' : 'birthdays are'} waiting inside. You’ll get your own reminders for the ones you keep.`}
                </Text>

                <View className="mt-6 w-full gap-2">
                  {preview.alreadyMember ? (
                    <>
                      <Text variant="caption" className="text-center text-ink-muted">
                        You’re already in this list.
                      </Text>
                      <Button fullWidth loading={accepting} onPress={() => accept(true)}>
                        Open list
                      </Button>
                    </>
                  ) : (
                    <Button fullWidth onPress={() => setStep('birthday')}>
                      Continue
                    </Button>
                  )}
                  <Button variant="ghost" fullWidth onPress={() => router.replace('/lists')}>
                    Not now
                  </Button>
                </View>
              </>
            ) : (
              <>
                <Text variant="heading" className="text-center">
                  Share your birthday with “{preview.listName}”?
                </Text>

                <View className="mt-5 w-full gap-3">
                  {knowsBirthday ? (
                    <>
                      <ToggleRow
                        title="Share my birthday"
                        helper={`We’ll add ${monthAbbr(storedBirthday!.month)} ${storedBirthday!.day} to this list so everyone gets a reminder.`}
                        value={shareBirthday}
                        onValueChange={setShareBirthday}
                      />
                      {shareBirthday ? (
                        <Pressable
                          onPress={() => setEditingDate(true)}
                          hitSlop={8}
                          accessibilityRole="button"
                          className={cn('self-start rounded-sm', focusRing)}>
                          <Text variant="caption" className="text-biro">
                            Use a different date
                          </Text>
                        </Pressable>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Text variant="body" className="text-center text-ink-secondary">
                        Add your birthday and this list will celebrate you too.
                      </Text>
                      <DatePartsField
                        label="Your birthday"
                        value={birthday}
                        onChange={setBirthday}
                        error={dateError}
                        hint="The year is optional."
                        a11y={{
                          month: 'Your birthday month',
                          day: 'Your birthday day',
                          year: 'Your birth year, optional',
                        }}
                      />
                    </>
                  )}

                  <Text variant="caption" className="text-center text-ink-muted">
                    Only the people in this list see it. You can remove it any time.
                  </Text>
                </View>

                <View className="mt-6 w-full gap-2">
                  <Button fullWidth loading={accepting} onPress={() => accept(shareBirthday)}>
                    {`Join ${preview.listName}`}
                  </Button>
                  {!knowsBirthday ? (
                    <Button variant="ghost" fullWidth onPress={() => accept(false)}>
                      Join without sharing
                    </Button>
                  ) : (
                    <Button variant="ghost" fullWidth onPress={() => setStep('preview')}>
                      Back
                    </Button>
                  )}
                </View>
              </>
            )}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
