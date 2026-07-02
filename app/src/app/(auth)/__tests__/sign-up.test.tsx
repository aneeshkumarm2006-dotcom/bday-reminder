import SignUpScreen from '@/app/(auth)/sign-up';

import { fireEvent, renderWithTheme, screen } from '../../../test-utils/render';

/**
 * Form validation (TODO Stage 13). The sign-up screen validates before calling
 * the API: name required + password ≥ 8 chars, surfacing an inline error that
 * says the fix (DESIGN.md §10 voice). expo-router + the auth provider are mocked
 * so the screen renders in isolation and signUp is never reached on bad input.
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

  it('calls signUp with trimmed values when the form is valid', () => {
    renderWithTheme(<SignUpScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Your name'), '  Michael Brooks  ');
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), '  michael@example.com  ');
    fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'supersecret');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(mockSignUp).toHaveBeenCalledWith({
      name: 'Michael Brooks',
      email: 'michael@example.com',
      password: 'supersecret',
    });
  });
});
