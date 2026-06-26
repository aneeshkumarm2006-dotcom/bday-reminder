import { DateRing } from '@/components/date-ring';

import { renderWithTheme, screen } from '../../test-utils/render';

/**
 * ⭐ Ring component tests (TODO Stage 13; DESIGN.md §7). The ring always pairs
 * its state with an accessible label (color is never the only signal, §11), so
 * we assert the rendered number/month plus the state word in the a11y label.
 */
describe('DateRing', () => {
  it('renders the day number and month caption', () => {
    renderWithTheme(<DateRing day={22} month="Jun" />);
    expect(screen.getByText('22')).toBeTruthy();
    expect(screen.getByText('Jun')).toBeTruthy();
  });

  it('upcoming state has a plain "{day} {month}" label (no state word)', () => {
    renderWithTheme(<DateRing day={5} month="Mar" state="upcoming" />);
    expect(screen.getByLabelText('5 Mar')).toBeTruthy();
  });

  it('today state appends ", today" and renders the filled ring (not just the label)', () => {
    renderWithTheme(<DateRing day={22} month="Jun" state="today" />);
    expect(screen.getByLabelText('22 Jun, today')).toBeTruthy();
    // Render-derived: the filled fill-path only exists in the today state.
    expect(screen.getByTestId('date-ring-fill')).toBeTruthy();
  });

  it('done state appends ", done" and renders the done check (color-independent signal §11)', () => {
    renderWithTheme(<DateRing day={1} month="Jan" state="done" />);
    expect(screen.getByLabelText('1 Jan, done')).toBeTruthy();
    // The check disc carries a "Done" label so state isn't signalled by color alone.
    expect(screen.getAllByLabelText('Done').length).toBeGreaterThan(0);
  });

  it('upcoming state renders no fill and no done check', () => {
    renderWithTheme(<DateRing day={5} month="Mar" state="upcoming" />);
    expect(screen.queryByTestId('date-ring-fill')).toBeNull();
    expect(screen.queryByLabelText('Done')).toBeNull();
  });

  it('past state appends ", past" to the label', () => {
    renderWithTheme(<DateRing day={9} month="Sep" state="past" />);
    expect(screen.getByLabelText('9 Sep, past')).toBeTruthy();
  });

  it('honors an explicit accessibilityLabel override', () => {
    renderWithTheme(
      <DateRing day={22} month="Jun" state="today" accessibilityLabel="Sarah Bennett, 22 Jun" />,
    );
    expect(screen.getByLabelText('Sarah Bennett, 22 Jun')).toBeTruthy();
  });

  it('renders at every size without throwing', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { unmount } = renderWithTheme(<DateRing day={12} month="Dec" size={size} />);
      expect(screen.getByText('12')).toBeTruthy();
      unmount();
    }
  });
});
