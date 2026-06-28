import { CalendarGrid, eventDayInMonth } from '@/components/calendar-grid';
import type { CalendarEvent } from '@/lib/api';

import { fireEvent, renderWithTheme, screen } from '../../test-utils/render';

/**
 * Calendar month grid. The placement logic (`eventDayInMonth`) carries all the
 * Feb-29 leap-year subtlety, so it's unit-tested directly; the component tests
 * cover the per-day event dots (via the a11y label) and day selection. Month
 * navigation now lives in <CalendarNav>, tested separately.
 */
function ev(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    personId: 'p1',
    eventId: 'e1',
    fullName: 'Sarah Bennett',
    type: 'human',
    relationshipTag: null,
    photoUrl: null,
    eventType: 'birthday',
    customName: null,
    month: 6,
    day: 22,
    year: 1990,
    feb29Rule: 'feb28',
    ...overrides,
  };
}

describe('eventDayInMonth', () => {
  it('places a normal event on its own day in its own month', () => {
    expect(eventDayInMonth(ev({ month: 6, day: 22 }), 2026, 6)).toBe(22);
  });

  it('returns null for a different month', () => {
    expect(eventDayInMonth(ev({ month: 6, day: 22 }), 2026, 7)).toBeNull();
  });

  it('observes a Feb-29 / feb28 birthday on Feb 28 in a non-leap year', () => {
    expect(eventDayInMonth(ev({ month: 2, day: 29, feb29Rule: 'feb28' }), 2026, 2)).toBe(28);
  });

  it('keeps a Feb-29 birthday on Feb 29 in a leap year regardless of rule', () => {
    expect(eventDayInMonth(ev({ month: 2, day: 29, feb29Rule: 'mar1' }), 2028, 2)).toBe(29);
  });

  it('hides a Feb-29 / feb29only birthday in a non-leap February', () => {
    expect(eventDayInMonth(ev({ month: 2, day: 29, feb29Rule: 'feb29only' }), 2026, 2)).toBeNull();
  });

  it('spills a Feb-29 / mar1 birthday to Mar 1 in a non-leap year (and not Feb)', () => {
    expect(eventDayInMonth(ev({ month: 2, day: 29, feb29Rule: 'mar1' }), 2026, 2)).toBeNull();
    expect(eventDayInMonth(ev({ month: 2, day: 29, feb29Rule: 'mar1' }), 2026, 3)).toBe(1);
  });

  it('does not spill mar1 in a leap year (March is untouched)', () => {
    expect(eventDayInMonth(ev({ month: 2, day: 29, feb29Rule: 'mar1' }), 2028, 3)).toBeNull();
  });
});

describe('CalendarGrid', () => {
  const today = { year: 2026, month: 6, day: 15 };

  function setup(props: Partial<React.ComponentProps<typeof CalendarGrid>> = {}) {
    const onSelectDay = jest.fn();
    renderWithTheme(
      <CalendarGrid
        year={2026}
        month={6}
        events={[ev({ day: 22 })]}
        today={today}
        selectedDay={null}
        onSelectDay={onSelectDay}
        {...props}
      />,
    );
    return { onSelectDay };
  }

  it('counts events on a day in its accessibility label (and omits the count on empty days)', () => {
    setup();
    expect(screen.getByLabelText('Jun 22, 1 event')).toBeTruthy();
    expect(screen.getByLabelText('Jun 23')).toBeTruthy();
  });

  it('counts multiple events on the same day (the dots collapse, the label does not)', () => {
    setup({
      events: [
        ev({ eventId: 'a', day: 22 }),
        ev({ eventId: 'b', day: 22, eventType: 'anniversary' }),
        ev({ eventId: 'c', day: 22, eventType: 'custom', customName: 'Move day' }),
        ev({ eventId: 'd', day: 22 }),
      ],
    });
    expect(screen.getByLabelText('Jun 22, 4 events')).toBeTruthy();
  });

  it('calls onSelectDay with the tapped day', () => {
    const { onSelectDay } = setup();
    fireEvent.press(screen.getByLabelText('Jun 22, 1 event'));
    expect(onSelectDay).toHaveBeenCalledWith(22);
  });
});
