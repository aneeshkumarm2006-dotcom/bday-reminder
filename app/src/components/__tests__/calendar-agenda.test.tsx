import { CalendarAgenda } from '@/components/calendar-agenda';
import type { CalendarEvent } from '@/lib/api';

import { fireEvent, renderWithTheme, screen } from '../../test-utils/render';

/**
 * The agenda (list) view: the displayed month's events in date order, the
 * empty-state copy, Feb-29 placement (shared with the grid), and row taps.
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

const today = { year: 2026, month: 6, day: 15 };

function setup(props: Partial<React.ComponentProps<typeof CalendarAgenda>> = {}) {
  const onSelectPerson = jest.fn();
  renderWithTheme(
    <CalendarAgenda
      year={2026}
      month={6}
      events={[ev()]}
      today={today}
      onSelectPerson={onSelectPerson}
      {...props}
    />,
  );
  return { onSelectPerson };
}

describe('CalendarAgenda', () => {
  it('lists the month’s events with their type label', () => {
    setup({
      events: [ev({ fullName: 'Sarah Bennett', eventType: 'birthday' })],
    });
    expect(screen.getByText('Sarah Bennett')).toBeTruthy();
    expect(screen.getByText('Birthday')).toBeTruthy();
  });

  it('shows an empty state when no events fall in the month', () => {
    setup({ events: [ev({ month: 9, day: 3 })] }); // September event, June shown
    expect(screen.getByText('No events in June.')).toBeTruthy();
  });

  it('places a Feb-29 / mar1 event in March when the year is not a leap year', () => {
    setup({
      month: 3,
      events: [ev({ fullName: 'Leap Person', month: 2, day: 29, feb29Rule: 'mar1' })],
    });
    expect(screen.getByText('Leap Person')).toBeTruthy();
  });

  it('opens the person on row tap', () => {
    const { onSelectPerson } = setup({ events: [ev({ personId: 'p9' })] });
    fireEvent.press(screen.getByLabelText('Sarah Bennett, Birthday, Jun 22'));
    expect(onSelectPerson).toHaveBeenCalledWith('p9');
  });
});
