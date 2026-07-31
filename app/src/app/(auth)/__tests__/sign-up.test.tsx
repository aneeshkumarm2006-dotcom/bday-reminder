import SignUpScreen from '@/app/(auth)/sign-up';

import { fireEvent, renderWithTheme, screen } from '../../../test-utils/render';

/**
 * Form validation (TODO Stage 13). The sign-up screen validates before calling
 * the API: name required, password ≥ 8 chars, and a real birthday, surfacing an
 * inline error that says the fix (DESIGN.md §10 voice). expo-router + the auth
 * provider are mocked so the screen renders in isolation and signUp is never
 * reached on bad input.
 * (jest.mock calls are hoisted above these imports by babel-plugin-jest-hoist.)
 */
const mockSignUp = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ signUp: mockSignUp }),
}));
// The Google sign-in button fetches /config on mount; stub it out so these
// validation tests stay network-free.
jest.mock('@/components/google-sign-in-button', () => ({
  GoogleSignInButton: () => null,
}));

describe('SignUpScreen validation', () => {
  beforeEach(() => mockSignUp.mockClear());

  /** Fill the birthday - a Select for the month, plain inputs for day + year. */
  const fillBirthday = (month: string, day: string, year?: string) => {
    fireEvent.press(screen.getByLabelText('Birthday month'));
    fireEvent.press(screen.getByRole('button', { name: month }));
    fireEvent.changeText(screen.getByLabelText('Birthday day'), day);
    if (year) fireEvent.changeText(screen.getByLabelText('Birthday year, optional'), year);
  };

  it('requires a name before submitting', () => {
    renderWithTheme(<SignUpScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'longenough');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Add your name so reminders can greet you.')).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('requires a password of at least 8 characters', () => {
    renderWithTheme(<SignUpScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Michael');
    fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'short');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Use a password of at least 8 characters.')).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('requires a birthday', () => {
    renderWithTheme(<SignUpScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Michael');
    fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'supersecret');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Add the month and day of your birthday.')).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('rejects a day that never happens in the chosen month', () => {
    renderWithTheme(<SignUpScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Michael');
    fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'supersecret');
    fillBirthday('February', '30');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText("That day doesn't exist in that month.")).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('calls signUp with trimmed values when the form is valid', () => {
    renderWithTheme(<SignUpScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Your name'), '  Michael Brooks  ');
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), '  michael@example.com  ');
    fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'supersecret');
    fillBirthday('March', '12', '1988');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(mockSignUp).toHaveBeenCalledWith({
      name: 'Michael Brooks',
      email: 'michael@example.com',
      password: 'supersecret',
      birthday: { month: 3, day: 12, year: 1988 },
    });
  });

  it('keeps the birth year optional', () => {
    renderWithTheme(<SignUpScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Michael');
    fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'supersecret');
    fillBirthday('July', '4');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ birthday: { month: 7, day: 4, year: null } }),
    );
  });
});
