import { Check, ChevronDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon, Input, Label, Sheet, Text } from '@/components/ui';
import { COUNTRIES, countryByCode, dialCodeFor } from '@/lib/countries';
import { cn, focusRing } from '@/lib/cn';
import { defaultCountryCode, formatNational, splitPhone, toE164 } from '@/lib/phone';
import { useAuth } from '@/providers/auth-provider';
import { useTokens } from '@/theme/theme-provider';

/**
 * Phone field with a country-code picker (DESIGN.md §8.8). Twilio is provisioned
 * beyond the US/CA now, so a typed number can no longer be assumed to be +1: the
 * country and the national number are two controls but one value, and the parent
 * still holds a single E.164 string to hand straight to the API.
 *
 * The picker opens on the account's own country (from the timezone the app
 * reports from the device) unless the current value already says otherwise - an
 * existing "+4477…" edits as United Kingdom. The country list is searchable
 * rather than a plain Select: 200 rows is too many to scroll.
 */

function CountrySheet({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onSelect: (code: string) => void;
}) {
  const tokens = useTokens();
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().startsWith(q) ||
        c.dial.startsWith(q.replace(/^\+/, '')),
    );
  }, [query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title="Country code">
      <View className="mb-2">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search country or code"
          accessibilityLabel="Search countries"
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>
      {/* flexShrink lets the list give up height when the keyboard lifts the
          sheet, so the search field never gets pushed off the top. */}
      <ScrollView style={{ maxHeight: 360, flexShrink: 1 }} keyboardShouldPersistTaps="handled">
        {matches.map((c) => {
          const isSelected = c.code === value;
          return (
            <Pressable
              key={c.code}
              onPress={() => {
                onSelect(c.code);
                close();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              className={cn(
                'min-h-[48px] flex-row items-center gap-3 border-b border-border-subtle',
                focusRing,
              )}>
              <Text
                variant="body"
                className={cn('flex-1', isSelected ? 'text-ink' : 'text-ink-secondary')}>
                {c.name}
              </Text>
              <Text variant="body" className="text-ink-muted">
                +{c.dial}
              </Text>
              {isSelected ? <Icon icon={Check} size={18} color={tokens.biro} /> : null}
            </Pressable>
          );
        })}
        {matches.length === 0 ? (
          <Text variant="caption" className="py-4 text-ink-muted">
            No country matches that.
          </Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

export function PhoneField({
  label = 'Phone',
  optional,
  hint,
  error,
  value,
  onChange,
}: {
  label?: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  /** Stored E.164 string ('' when empty) - the only value the parent tracks. */
  value: string;
  onChange: (next: string) => void;
}) {
  const { user } = useAuth();
  const tokens = useTokens();
  const [open, setOpen] = useState(false);

  const fallback = defaultCountryCode(user?.timezone);
  // The picked country has to outlive an empty number field: clearing the digits
  // empties `value`, which would otherwise snap the picker back to the default.
  const [picked, setPicked] = useState<string | null>(null);
  const parsed = splitPhone(value, picked ?? fallback);
  // `value` wins whenever it carries a country code - a parent that re-seeds the
  // field (the auto-send sheet reopening on another number) must not keep the
  // last pick. It survives a same-dial parse, though, so choosing Canada isn't
  // immediately snapped back to the US that "+1" resolves to.
  const country =
    picked && dialCodeFor(picked) === dialCodeFor(parsed.country) ? picked : parsed.country;
  const dial = dialCodeFor(country);
  const selected = countryByCode(country);

  return (
    <View>
      {label ? <Label optional={optional}>{label}</Label> : null}
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Country code"
          accessibilityValue={{ text: selected ? `${selected.name} +${selected.dial}` : dial }}
          className={cn(
            'min-h-[44px] flex-row items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3',
            focusRing,
          )}>
          <Text variant="body" className="text-ink">
            +{dial}
          </Text>
          <Text variant="caption" className="text-ink-muted">
            {country}
          </Text>
          <Icon icon={ChevronDown} size={18} color={tokens.inkMuted} />
        </Pressable>
        <Input
          error={!!error}
          className="flex-1"
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder={dial === '1' ? '(555) 123-4567' : 'Phone number'}
          accessibilityLabel={label}
          value={formatNational(dial, parsed.national)}
          onChangeText={(next) => onChange(toE164(dial, next))}
        />
      </View>
      {error ? (
        <Text variant="caption" className="mt-1.5 text-danger-fg">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" className="mt-1.5 text-ink-muted">
          {hint}
        </Text>
      ) : null}

      <CountrySheet
        visible={open}
        value={country}
        onClose={() => setOpen(false)}
        onSelect={(code) => {
          setPicked(code);
          onChange(toE164(dialCodeFor(code), parsed.national));
        }}
      />
    </View>
  );
}
