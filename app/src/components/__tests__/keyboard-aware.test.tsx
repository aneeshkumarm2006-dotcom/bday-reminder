import { FormScrollView, Sheet, TextField } from '@/components/ui';

import { renderWithTheme, screen } from '../../test-utils/render';

/**
 * Keyboard handling wiring (react-native-keyboard-controller): every form
 * scrolls its focused field clear of the keyboard, and sheets lift as a whole.
 * These guard the plumbing — that both containers still render their fields —
 * since a broken import here silently loses the whole form.
 */
describe('keyboard-aware containers', () => {
  it('FormScrollView renders its fields', () => {
    renderWithTheme(
      <FormScrollView>
        <TextField label="Name" value="Emma" onChangeText={() => {}} />
      </FormScrollView>,
    );

    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByDisplayValue('Emma')).toBeTruthy();
  });

  it('Sheet renders its fields above the keyboard', () => {
    renderWithTheme(
      <Sheet visible onClose={() => {}} title="Auto-send birthday email">
        <TextField label="Their email" value="emma@example.com" onChangeText={() => {}} />
      </Sheet>,
    );

    expect(screen.getByText('Auto-send birthday email')).toBeTruthy();
    expect(screen.getByDisplayValue('emma@example.com')).toBeTruthy();
  });
});
