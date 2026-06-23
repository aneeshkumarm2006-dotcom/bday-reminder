import type { ChannelPreferences } from '@/lib/api';
import { ChannelToggles, LeadTimeChips } from '@/components/reminder-prefs';

import { fireEvent, renderWithTheme, screen } from '../../test-utils/render';

/**
 * Settings logic (TODO Stage 13; §8.4/§8.5, FR-19/20/24/26/56). The reminder-pref
 * controls are pure + controlled, so we can assert the rules directly: the
 * fair-use note reads the cap from config (never hardcoded), the zero-channel
 * guard warns + offers "Turn on push", and lead-time chips toggle days.
 */
const ALL_OFF: ChannelPreferences = { push: false, email: false, sms: false, inApp: false };
const PUSH_ON: ChannelPreferences = { push: true, email: false, sms: false, inApp: true };

describe('ChannelToggles', () => {
  it('renders a row for every channel', () => {
    renderWithTheme(<ChannelToggles value={PUSH_ON} onChange={() => {}} smsCap={20} />);
    expect(screen.getByText('Push')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Text message (SMS)')).toBeTruthy();
    expect(screen.getByText('In-app')).toBeTruthy();
  });

  it('shows the fair-use note with the cap number from config when SMS is on (FR-56)', () => {
    const value: ChannelPreferences = { ...PUSH_ON, sms: true };
    renderWithTheme(<ChannelToggles value={value} onChange={() => {}} smsCap={20} />);
    expect(screen.getByText(/Up to 20 SMS reminders a month/)).toBeTruthy();
  });

  it('falls back to number-free copy while the cap is still loading (null)', () => {
    const value: ChannelPreferences = { ...PUSH_ON, sms: true };
    renderWithTheme(<ChannelToggles value={value} onChange={() => {}} smsCap={null} />);
    expect(screen.getByText(/SMS reminders are capped each month/)).toBeTruthy();
  });

  it('warns + offers "Turn on push" when all channels are off (FR-26)', () => {
    const onChange = jest.fn();
    renderWithTheme(<ChannelToggles value={ALL_OFF} onChange={onChange} smsCap={20} />);
    expect(screen.getByText("You won't be reminded for this event.")).toBeTruthy();
    fireEvent.press(screen.getByText('Turn on push'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ push: true }));
  });

  it('uses a custom zero-channel message when provided', () => {
    renderWithTheme(
      <ChannelToggles value={ALL_OFF} onChange={() => {}} smsCap={20} zeroMessage="Custom warning." />,
    );
    expect(screen.getByText('Custom warning.')).toBeTruthy();
  });

  it('toggling a channel switch calls onChange with the updated set', () => {
    const onChange = jest.fn();
    renderWithTheme(<ChannelToggles value={PUSH_ON} onChange={onChange} smsCap={20} />);
    fireEvent(screen.getByRole('switch', { name: 'Email' }), 'valueChange', true);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ email: true }));
  });
});

describe('LeadTimeChips', () => {
  it('renders the preset chips (FR-20)', () => {
    renderWithTheme(<LeadTimeChips value={[0]} onChange={() => {}} />);
    for (const label of ['On the day', '1 day', '3 days', '1 week', '2 weeks', 'Custom']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('adds a lead time when an unselected preset is tapped', () => {
    const onChange = jest.fn();
    renderWithTheme(<LeadTimeChips value={[0]} onChange={onChange} />);
    fireEvent.press(screen.getByRole('button', { name: '3 days' }));
    expect(onChange).toHaveBeenCalledWith([0, 3]);
  });

  it('removes a lead time when a selected preset is tapped', () => {
    const onChange = jest.fn();
    renderWithTheme(<LeadTimeChips value={[0, 7]} onChange={onChange} />);
    fireEvent.press(screen.getByRole('button', { name: '1 week' }));
    expect(onChange).toHaveBeenCalledWith([0]);
  });
});
