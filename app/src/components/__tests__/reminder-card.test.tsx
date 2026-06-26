import type { ReminderItem } from '@/lib/api';
import { ReminderCard } from '@/components/reminder-card';

import { fireEvent, renderWithTheme, screen } from '../../test-utils/render';

/**
 * ReminderCard - in-app feed item (TODO Stage 13; DESIGN.md §8.3). Asserts the
 * server-rendered copy is the primary line, "Send greeting" appears only when
 * day-of + a phone exists (canGreet, FR-28/30), Done rows are de-emphasized with
 * their actions hidden, the status pill matches, and the action callbacks fire.
 */
function reminder(overrides: Partial<ReminderItem> = {}): ReminderItem {
  return {
    id: 'r1',
    status: 'sent',
    leadDays: 0,
    channels: ['push', 'inApp'],
    occurrenceDate: '2026-06-22T00:00:00.000Z',
    scheduledFor: '2026-06-22T09:00:00.000Z',
    snoozeUntil: null,
    sentAt: '2026-06-22T09:00:00.000Z',
    daysRemaining: 0,
    ageTurning: 36,
    message: "It's Sarah Bennett's birthday today - turns 36.",
    canGreet: true,
    person: { id: 'p1', fullName: 'Sarah Bennett', type: 'human', relationshipTag: 'Friend', photoUrl: null, phone: '+1555' },
    event: { id: 'e1', type: 'birthday', customName: null },
    ...overrides,
  };
}

const noop = () => {};

describe('ReminderCard', () => {
  it('shows the server-rendered reminder copy and the three day-of actions', () => {
    renderWithTheme(
      <ReminderCard item={reminder()} onGreet={noop} onDone={noop} onSnooze={noop} />,
    );
    expect(screen.getByText("It's Sarah Bennett's birthday today - turns 36.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send greeting' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark as done' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Snooze' })).toBeTruthy();
  });

  it('hides "Send greeting" when canGreet is false (no phone / not day-of) (FR-30)', () => {
    renderWithTheme(
      <ReminderCard item={reminder({ canGreet: false })} onGreet={noop} onDone={noop} onSnooze={noop} />,
    );
    expect(screen.queryByRole('button', { name: 'Send greeting' })).toBeNull();
  });

  it('shows the Done pill and hides actions once done (FR-31/34)', () => {
    renderWithTheme(
      <ReminderCard item={reminder({ status: 'done' })} onGreet={noop} onDone={noop} onSnooze={noop} />,
    );
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark as done' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Snooze' })).toBeNull();
  });

  it('maps reminder status/days to the ring state (ringStateFor)', () => {
    // day-of (sent) → today → filled ring present
    const today = renderWithTheme(
      <ReminderCard item={reminder({ daysRemaining: 0 })} onGreet={noop} onDone={noop} onSnooze={noop} />,
    );
    expect(today.getByTestId('date-ring-fill')).toBeTruthy();
    today.unmount();

    // upcoming (days > 0) → no fill, no done check
    const upcoming = renderWithTheme(
      <ReminderCard item={reminder({ daysRemaining: 3 })} onGreet={noop} onDone={noop} onSnooze={noop} />,
    );
    expect(upcoming.queryByTestId('date-ring-fill')).toBeNull();
    expect(upcoming.queryByLabelText('Done')).toBeNull();
    upcoming.unmount();

    // done → done check rendered (state-derived, not color-only)
    const done = renderWithTheme(
      <ReminderCard item={reminder({ status: 'done' })} onGreet={noop} onDone={noop} onSnooze={noop} />,
    );
    expect(done.getAllByLabelText('Done').length).toBeGreaterThan(0);
  });

  it('shows the Snoozed pill when snoozed', () => {
    renderWithTheme(
      <ReminderCard item={reminder({ status: 'snoozed' })} onGreet={noop} onDone={noop} onSnooze={noop} />,
    );
    expect(screen.getByText('Snoozed')).toBeTruthy();
  });

  it('fires the action callbacks on press', () => {
    const onGreet = jest.fn();
    const onDone = jest.fn();
    const onSnooze = jest.fn();
    renderWithTheme(
      <ReminderCard item={reminder()} onGreet={onGreet} onDone={onDone} onSnooze={onSnooze} />,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Send greeting' }));
    fireEvent.press(screen.getByRole('button', { name: 'Mark as done' }));
    fireEvent.press(screen.getByRole('button', { name: 'Snooze' }));
    expect(onGreet).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onSnooze).toHaveBeenCalledTimes(1);
  });
});
