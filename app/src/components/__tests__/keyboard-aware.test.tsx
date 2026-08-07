import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

  /**
   * Every screen that types has to sit in one of those two containers. The
   * invite screen shipped in a plain `View`, so its birthday field stayed under
   * the keyboard - a source check catches that, where a render test wouldn't
   * (the screen renders perfectly well; it just doesn't move).
   */
  it.each([
    '(auth)/login.tsx',
    '(auth)/sign-up.tsx',
    '(tabs)/lists.tsx',
    '(tabs)/settings.tsx',
    'add-person.tsx',
    'import.tsx',
    'invite/[token].tsx',
    'list/[id].tsx',
    'person/[id].tsx',
    'welcome-birthday.tsx',
  ])('%s keeps its inputs in a keyboard-aware container', (file) => {
    const source = readFileSync(join(__dirname, '../../app', file), 'utf8');
    expect(source).toMatch(/FormScrollView|<Sheet/);
  });
});
