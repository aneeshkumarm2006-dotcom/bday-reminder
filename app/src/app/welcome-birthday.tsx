import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  DatePartsField,
  EMPTY_DATE_PARTS,
  MAX_DAY,
  toDateParts,
  type DatePartsStrings,
} from '@/components/date-parts-field';
import { Button, FormScrollView, Screen, Text, useToast } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';

/**
 * The last step of signing up with Google.
 *
 * The app's own signup form asks for a birthday inline; the Google flow never
 * shows a form, so this is where those accounts fill in the one thing we're
 * missing. A plain screen rather than a modal on purpose - a sheet you can
 * swipe away would skip the step with nothing recorded.
 */
export default function WelcomeBirthdayScreen() {
  const router = useRouter();
  const toast = useToast();
  const { updateProfile, dismissBirthdayPrompt } = useAuth();
  const [birthday, setBirthday] = useState<DatePartsStrings>(EMPTY_DATE_PARTS);
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const dob = toDateParts(birthday);
    if (!dob) return setError('Add the month and day of your birthday.');
    if (dob.day > MAX_DAY[dob.month - 1]) {
      return setError("That day doesn't exist in that month.");
    }
    setError(undefined);
    setSaving(true);
    try {
      await updateProfile({ birthday: dob });
      dismissBirthdayPrompt();
      toast.show('Birthday saved.');
      router.replace('/(tabs)');
    } catch {
      setSaving(false);
      toast.show("Couldn't save that. Check your connection and try again.");
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <FormScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View className="gap-8 py-8">
          <View className="gap-2">
            <Text variant="title">One more thing 🎂</Text>
            <Text variant="body" className="text-ink-secondary">
              Add your birthday so the people you share lists with can celebrate you too. You can
              change or remove it any time in Settings.
            </Text>
          </View>

          <View className="gap-4">
            <DatePartsField
              label="Your birthday"
              value={birthday}
              onChange={setBirthday}
              error={error}
              hint="The year is optional — leave it blank if you'd rather not say."
              a11y={{
                month: 'Your birthday month',
                day: 'Your birthday day',
                year: 'Your birth year, optional',
              }}
            />
            <Button fullWidth loading={saving} onPress={save}>
              Save birthday
            </Button>
          </View>
        </View>
      </FormScrollView>
    </Screen>
  );
}
