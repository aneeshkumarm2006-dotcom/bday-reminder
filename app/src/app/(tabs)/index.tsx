import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarPlus, PawPrint, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { CalendarAgenda } from '@/components/calendar-agenda';
import { CalendarGrid, CalendarLegend, eventDayInMonth } from '@/components/calendar-grid';
import { CalendarMonthPicker } from '@/components/calendar-month-picker';
import { CalendarNav, type CalendarMode } from '@/components/calendar-nav';
import { Button, Card, Icon, Screen, Text } from '@/components/ui';
import {
  ApiError,
  calendarEventsApi,
  type CalendarEventsResponse,
} from '@/lib/api';
import { cn, focusRing } from '@/lib/cn';
import { monthAbbr } from '@/lib/dates';
import { eventTypeMeta } from '@/lib/event-style';
import { useTokens } from '@/theme/theme-provider';

/**
 * Calendar (the repurposed first tab). A month-grid (or list) view of every
 * event - birthdays, anniversaries, custom - on its date, colored by type, where
 * tapping a day shows who's on it and lets you add a birthday on that date
 * (prefilled). A Month/List toggle, a "Today" jump and a month/year picker make
 * it quick to move around. The Upcoming feed moved into Reminders; this tab is
 * the browse-and-add surface.
 *
 * Data is `GET /calendar/events` - raw month/day per event - so the grid can page
 * to any month. "Today" comes from the server (timezone-anchored), never the
 * device clock, to match how reminders are scheduled.
 */

/** Parse a UTC-midnight ISO date into calendar y/m/d (read in UTC). */
function ymd(iso: string): { year: number; month: number; day: number } {
  const d = new Date(iso);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Shift a {year, month} by whole months, rolling the year over. */
function shiftMonth(c: { year: number; month: number }, delta: number): { year: number; month: number } {
  const zero = c.month - 1 + delta;
  return { year: c.year + Math.floor(zero / 12), month: ((zero % 12) + 12) % 12 + 1 };
}

export default function CalendarScreen() {
  const router = useRouter();
  const t = useTokens();

  const [data, setData] = useState<CalendarEventsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayed, setDisplayed] = useState<{ year: number; month: number } | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [mode, setMode] = useState<CalendarMode>('month');
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const next = await calendarEventsApi.list();
      setData(next);
      // First load only: anchor to today's month and preselect today, so the day
      // list below the grid shows today's events straight away.
      const today = ymd(next.today);
      setDisplayed((cur) => cur ?? { year: today.year, month: today.month });
      setSelectedDay((cur) => cur ?? today.day);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Couldn't load your calendar. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on focus so a just-added person shows on the grid immediately.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const goMonth = (delta: number) => {
    setDisplayed((c) => (c ? shiftMonth(c, delta) : c));
    setSelectedDay(null); // a new month: clear the selection until the user taps.
  };

  if (loading && !data) {
    return (
      <Screen>
        <CalendarHeader onAdd={() => router.push('/add-person')} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.biro} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <CalendarHeader onAdd={() => router.push('/add-person')} />
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="body" className="text-center text-ink-secondary">
            {error}
          </Text>
          <Button variant="secondary" onPress={() => void load()}>
            Try again
          </Button>
        </View>
      </Screen>
    );
  }

  const today = data ? ymd(data.today) : { year: 0, month: 0, day: 0 };
  const view = displayed ?? { year: today.year, month: today.month };
  const events = data?.events ?? [];

  const goToday = () => {
    setDisplayed({ year: today.year, month: today.month });
    setSelectedDay(today.day);
  };

  const pickMonth = (next: { year: number; month: number }) => {
    setDisplayed(next);
    setSelectedDay(null);
    setPickerOpen(false);
  };

  const dayEvents =
    selectedDay != null
      ? events.filter((ev) => eventDayInMonth(ev, view.year, view.month) === selectedDay)
      : [];

  const addOnDate = () => {
    if (selectedDay == null) return;
    router.push({
      pathname: '/add-person',
      params: { month: String(view.month), day: String(selectedDay) },
    });
  };

  return (
    <Screen>
      <CalendarHeader onAdd={() => router.push('/add-person')} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24, gap: 8 }}>
        <CalendarNav
          year={view.year}
          month={view.month}
          mode={mode}
          onModeChange={setMode}
          onPrev={() => goMonth(-1)}
          onNext={() => goMonth(1)}
          onToday={goToday}
          onOpenPicker={() => setPickerOpen(true)}
        />

        {mode === 'list' ? (
          <CalendarAgenda
            year={view.year}
            month={view.month}
            events={events}
            today={today}
            onSelectPerson={(personId) => router.push(`/person/${personId}`)}
          />
        ) : (
          <>
            <CalendarGrid
              year={view.year}
              month={view.month}
              events={events}
              today={today}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
            <CalendarLegend />

            {selectedDay != null ? (
              <View className="mt-2 gap-3">
                <Text variant="heading">{`${monthAbbr(view.month)} ${selectedDay}`}</Text>

                {dayEvents.length === 0 ? (
                  <Text variant="body" className="text-ink-secondary">
                    No one on this day yet.
                  </Text>
                ) : (
                  <View className="gap-2">
                    {dayEvents.map((ev) => (
                      <Card key={ev.eventId} onPress={() => router.push(`/person/${ev.personId}`)}>
                        <View className="flex-row items-center gap-2">
                          {ev.type === 'pet' ? (
                            <Icon icon={PawPrint} size={16} color={t.inkMuted} label="Pet" />
                          ) : null}
                          <View className="flex-1">
                            <Text variant="cardName" numberOfLines={1}>
                              {ev.fullName}
                            </Text>
                            <Text variant="caption" numberOfLines={1} className="mt-0.5">
                              {[eventTypeMeta(ev).label, ev.relationshipTag ?? undefined]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    ))}
                  </View>
                )}

                <Button variant="secondary" leftIcon={CalendarPlus} fullWidth onPress={addOnDate}>
                  {`Add birthday on ${monthAbbr(view.month)} ${selectedDay}`}
                </Button>
              </View>
            ) : (
              <Text variant="caption" className="mt-2 text-center text-ink-muted">
                Tap a day to see who&apos;s on it or add a birthday.
              </Text>
            )}
          </>
        )}
      </ScrollView>

      <CalendarMonthPicker
        visible={pickerOpen}
        year={view.year}
        month={view.month}
        onClose={() => setPickerOpen(false)}
        onPick={pickMonth}
      />
    </Screen>
  );
}

function CalendarHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <View className="flex-row items-center justify-between pb-2 pt-3">
      <Text variant="title">Calendar</Text>
      <Pressable
        onPress={onAdd}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Add person"
        className={cn('h-9 w-9 items-center justify-center rounded-full active:scale-95', focusRing)}>
        <Icon icon={Plus} size={24} />
      </Pressable>
    </View>
  );
}
