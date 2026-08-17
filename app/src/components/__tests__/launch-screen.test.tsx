import { act } from '@testing-library/react-native';

import { LaunchScreen } from '@/components/launch-screen';
import { monthAbbr } from '@/lib/dates';

import { renderWithTheme, screen } from '../../test-utils/render';

/**
 * Launch screen (DESIGN.md §7). Two things matter and neither is the animation
 * itself: it circles *today's* date, and it does not leave until the session has
 * resolved - which is what stops the login screen flashing past on a slow start.
 *
 * The reanimated mock reports reduced motion, so the runway is the short one and
 * the fade's completion callback fires synchronously.
 */
describe('LaunchScreen', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const today = new Date();

  it("circles today's date, not a frozen one", () => {
    renderWithTheme(<LaunchScreen ready onFinished={() => {}} />);
    expect(screen.getByText(String(today.getDate()))).toBeTruthy();
    expect(screen.getByText(monthAbbr(today.getMonth() + 1))).toBeTruthy();
  });

  it('announces itself once, as a whole', () => {
    renderWithTheme(<LaunchScreen ready onFinished={() => {}} />);
    expect(screen.getByLabelText('Circle the date, loading')).toBeTruthy();
  });

  it('signals the native splash to drop as soon as it has painted', () => {
    const onPainted = jest.fn();
    renderWithTheme(<LaunchScreen ready onPainted={onPainted} onFinished={() => {}} />);
    act(() => {
      screen.getByLabelText('Circle the date, loading').props.onLayout?.();
    });
    expect(onPainted).toHaveBeenCalled();
  });

  it('stays put while the session is still resolving, however long the wait', () => {
    const onFinished = jest.fn();
    renderWithTheme(<LaunchScreen ready={false} onFinished={onFinished} />);
    act(() => jest.advanceTimersByTime(10_000));
    expect(onFinished).not.toHaveBeenCalled();
  });

  it('leaves once the runway is done and the session has resolved', () => {
    const onFinished = jest.fn();
    const { rerender } = renderWithTheme(
      <LaunchScreen ready={false} onFinished={onFinished} />,
    );
    act(() => jest.advanceTimersByTime(10_000));
    expect(onFinished).not.toHaveBeenCalled();

    // The session lands - only now may it go.
    act(() => {
      rerender(<LaunchScreen ready onFinished={onFinished} />);
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('waits out the ring before leaving, even when the session is already there', () => {
    const onFinished = jest.fn();
    renderWithTheme(<LaunchScreen ready onFinished={onFinished} />);
    expect(onFinished).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1_500));
    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
