import { CalendarNav } from '@/components/calendar-nav';

import { fireEvent, renderWithTheme, screen } from '../../test-utils/render';

/**
 * The shared calendar controls bar: the month title (which opens the picker),
 * the prev/next arrows, the Today jump, and the Month/List view toggle.
 */
function setup(props: Partial<React.ComponentProps<typeof CalendarNav>> = {}) {
  const handlers = {
    onModeChange: jest.fn(),
    onPrev: jest.fn(),
    onNext: jest.fn(),
    onToday: jest.fn(),
    onOpenPicker: jest.fn(),
  };
  renderWithTheme(
    <CalendarNav year={2026} month={6} mode="month" {...handlers} {...props} />,
  );
  return handlers;
}

describe('CalendarNav', () => {
  it('renders the month label', () => {
    setup();
    expect(screen.getByText('June 2026')).toBeTruthy();
  });

  it('paginates via the prev / next buttons', () => {
    const { onPrev, onNext } = setup();
    fireEvent.press(screen.getByLabelText('Previous month'));
    fireEvent.press(screen.getByLabelText('Next month'));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('opens the month picker from the title', () => {
    const { onOpenPicker } = setup();
    fireEvent.press(screen.getByLabelText('June 2026, change month'));
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });

  it('jumps to today', () => {
    const { onToday } = setup();
    fireEvent.press(screen.getByLabelText('Jump to today'));
    expect(onToday).toHaveBeenCalledTimes(1);
  });

  it('switches to the list view', () => {
    const { onModeChange } = setup();
    fireEvent.press(screen.getByLabelText('List view'));
    expect(onModeChange).toHaveBeenCalledWith('list');
  });
});
