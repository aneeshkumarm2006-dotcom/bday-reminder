import type { UpcomingItem } from '@/lib/api';
import { PersonCard } from '@/components/person-card';

import { fireEvent, renderWithTheme, screen } from '../../test-utils/render';

/**
 * PersonCard — the feed hero (TODO Stage 13; DESIGN.md §8.1). Asserts the date
 * leads (ring labelled with the name), age shows only with a year (FR-14), the
 * event label distinguishes non-birthday rows, pets get the paw, and the
 * countdown copy + tap target are correct.
 */
function item(overrides: Partial<UpcomingItem> = {}): UpcomingItem {
  return {
    personId: 'p1',
    eventId: 'e1',
    fullName: 'Aisha Khan',
    type: 'human',
    relationshipTag: 'Friend',
    photoUrl: null,
    phone: null,
    eventType: 'birthday',
    customName: null,
    occurrenceDate: '2026-06-25T00:00:00.000Z',
    daysRemaining: 3,
    ageTurning: 36,
    group: 'This week',
    ...overrides,
  };
}

describe('PersonCard', () => {
  it('shows the name, the age (turns N) when a year is known, and the countdown', () => {
    renderWithTheme(<PersonCard item={item()} />);
    expect(screen.getByText('Aisha Khan')).toBeTruthy();
    expect(screen.getByText(/turns 36/)).toBeTruthy();
    expect(screen.getByText('in 3 days')).toBeTruthy();
    // The ring (the date) leads, labelled with the person's name + date.
    expect(screen.getByLabelText(/Aisha Khan, 25 Jun/)).toBeTruthy();
  });

  it('omits the age entirely when no birth year is known (FR-14)', () => {
    renderWithTheme(<PersonCard item={item({ ageTurning: null })} />);
    expect(screen.queryByText(/turns/)).toBeNull();
  });

  it('renders "Today" on the day of the event', () => {
    renderWithTheme(<PersonCard item={item({ daysRemaining: 0 })} />);
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('labels a non-birthday event (anniversary) in the subtitle', () => {
    renderWithTheme(
      <PersonCard item={item({ eventType: 'anniversary', ageTurning: null })} />,
    );
    expect(screen.getByText(/Anniversary/)).toBeTruthy();
  });

  it('shows the paw indicator for a pet', () => {
    // relationshipTag null so the only "Pet" label is the paw icon itself.
    renderWithTheme(<PersonCard item={item({ type: 'pet', relationshipTag: null, ageTurning: null })} />);
    // The paw icon (wrapper + svg) carries the "Pet" label; at least one present.
    expect(screen.getAllByLabelText('Pet').length).toBeGreaterThan(0);
  });

  it('calls onPress when tapped (FR-50 profile deep-link target)', () => {
    const onPress = jest.fn();
    renderWithTheme(<PersonCard item={item()} onPress={onPress} />);
    fireEvent.press(screen.getByText('Aisha Khan'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
