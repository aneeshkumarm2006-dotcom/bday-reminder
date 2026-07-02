import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../lib/async-handler';
import { startSession, rotateRefreshToken, revokeRefreshToken } from '../lib/auth-tokens';
import { conflict, unauthorized } from '../lib/http-error';
import { hashPassword, verifyPassword } from '../lib/password';
import { DEFAULT_TIMEZONE } from '../lib/region';
import { serializeUser } from '../lib/serialize';
import { validateBody } from '../middleware/validate';
import { User } from '../models/User';

/**
 * Auth routes - custom JWT (TODO Stage 1, FR-1). Email + password is the primary
 * login. Phone is captured as a profile field elsewhere; **phone OTP login is
 * deferred** until the SMS provider is live.
 */

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Add your name so reminders can greet you.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use a password of at least 8 characters.'),
  // Auto-detected on the client; falls back to the US/CA-first default if absent.
  timezone: z.string().trim().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

const refreshSchema = z.object({ refreshToken: z.string().min(1, 'Missing refresh token.') });

export const authRouter = Router();

authRouter.post(
  '/signup',
  validateBody(signupSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, timezone } = req.body as z.infer<typeof signupSchema>;

    const existing = await User.findOne({ email });
    if (existing) {
      throw conflict('That email is already registered. Try logging in instead.');
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({ name, email, passwordHash, timezone: timezone || DEFAULT_TIMEZONE });

    const tokens = await startSession(user._id.toString());
    res.status(201).json({ user: serializeUser(user), ...tokens });
  }),
);

authRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    // passwordHash is select:false, so re-select it for verification.
    const user = await User.findOne({ email }).select('+passwordHash');
    // A Google-created account has no password yet: point them at the Google
    // button rather than failing with a generic "incorrect" message.
    if (user && !user.passwordHash && user.googleId) {
      throw unauthorized('This account uses Google sign-in. Tap “Continue with Google”.');
    }
    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw unauthorized('Email or password is incorrect.');
    }

    const tokens = await startSession(user._id.toString());
    res.json({ user: serializeUser(user), ...tokens });
  }),
);

authRouter.post(
  '/refresh',
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
    const tokens = await rotateRefreshToken(refreshToken);
    res.json(tokens);
  }),
);

authRouter.post(
  '/logout',
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
    await revokeRefreshToken(refreshToken);
    res.status(204).end();
  }),
);
