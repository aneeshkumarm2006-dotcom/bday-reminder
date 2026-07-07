import { Schema, model, models, type Model, type Types } from 'mongoose';

import { DEFAULT_TIMEZONE } from '../lib/region';

/**
 * User (PRD §7.1). Email + password is the primary login. `phone` is stored now
 * but phone OTP login is DEFERRED until SMS go-live. Notification prefs and
 * reminder defaults live here and seed every new event (applied in Stages 4-5).
 */

export interface ChannelPreferences {
  push: boolean;
  email: boolean;
  sms: boolean;
  inApp: boolean;
}

/**
 * Per-user calendar-sync settings (Stage 9; FR-38/39/40). Opt-in: `enabled`
 * gates the feed; `token` is the secret in the subscribe URL (rotatable to
 * revoke). `includePersonal` includes the user's own people; `lists` are the
 * shared lists they chose to sync (per-list opt-in for multi-list members).
 */
export interface CalendarSync {
  enabled: boolean;
  /** Secret feed token; set on first enable, regenerated on rotate. */
  token?: string;
  includePersonal: boolean;
  lists: Types.ObjectId[];
}

/**
 * Gmail send-as integration (Stage 14). Present once the user connects their
 * Google account so the app can auto-send birthday greetings AS them via
 * `gmail.send`. `refreshTokenEnc` is the AES-256-GCM-encrypted OAuth refresh
 * token (never returned by default); `email` is the connected Gmail address.
 * Absent/unset means "not connected".
 */
export interface GmailIntegration {
  email: string;
  refreshTokenEnc: string;
  scope?: string;
  connectedAt: Date;
}

/**
 * Google Calendar + Contacts import connection (Stage 16). Present once the user
 * grants the just-in-time `calendar.readonly` + `contacts.readonly` scopes to bulk-
 * import birthdays/anniversaries. Same encrypted-refresh-token shape as
 * {@link GmailIntegration} (kept as a SEPARATE subdoc so disconnecting import never
 * touches Gmail send-as); persisted so the user can re-sync later without re-granting.
 * Absent/unset means "not connected".
 */
export interface GoogleImportIntegration {
  email: string;
  refreshTokenEnc: string;
  scope?: string;
  connectedAt: Date;
}

export interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  /**
   * bcrypt hash of the password. Optional: accounts created via "Sign in with
   * Google" have no password until they set one, so this is unset for them.
   */
  passwordHash?: string;
  /**
   * Google account id (`sub`) once the user has signed in with Google. Links a
   * Google identity to this account; unset for password-only accounts.
   */
  googleId?: string;
  phone?: string;
  timezone: string;
  channelPreferences: ChannelPreferences;
  /** Default lead times as "days before" (e.g. [0, 7] = on the day + 1 week). */
  defaultLeadDays: number[];
  /** Local time-of-day reminders fire, "HH:mm" (FR-22). */
  defaultReminderTime: string;
  /** Expo push tokens registered across this user's devices (Stage 4). */
  pushTokens: string[];
  /** Subscribable calendar feed settings (Stage 9, FR-38/39/40). */
  calendarSync: CalendarSync;
  /** Connected Gmail for send-as birthday greetings (Stage 14); unset until connected. */
  gmailIntegration?: GmailIntegration;
  /** Connected Google Calendar + Contacts for bulk import (Stage 16); unset until connected. */
  googleImport?: GoogleImportIntegration;
  createdAt: Date;
  updatedAt: Date;
}

const channelPreferencesSchema = new Schema<ChannelPreferences>(
  {
    push: { type: Boolean, default: true },
    // Off by default - users opt into email/SMS later from Settings (no onboarding step).
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
    inApp: { type: Boolean, default: true },
  },
  { _id: false },
);

const calendarSyncSchema = new Schema<CalendarSync>(
  {
    enabled: { type: Boolean, default: false },
    // No `index` here - the unique+sparse index is declared on the parent schema
    // so multiple users can sit token-less (sparse) until they enable sync.
    token: { type: String },
    includePersonal: { type: Boolean, default: true },
    lists: { type: [{ type: Schema.Types.ObjectId, ref: 'SharedList' }], default: () => [] },
  },
  { _id: false },
);

const gmailIntegrationSchema = new Schema<GmailIntegration>(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    // The encrypted refresh token is a credential - never serialize it by default.
    refreshTokenEnc: { type: String, required: true, select: false },
    scope: { type: String },
    connectedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const googleImportSchema = new Schema<GoogleImportIntegration>(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    // The encrypted refresh token is a credential - never serialize it by default.
    refreshTokenEnc: { type: String, required: true, select: false },
    scope: { type: String },
    connectedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true },
    // `unique` creates the index the TODO asks for; don't double-declare it.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Never returned by default - login re-selects it explicitly. Not required:
    // Google-created accounts have no password (see googleId below).
    passwordHash: { type: String, select: false },
    // Google `sub`; sparse+unique so only Google-linked accounts are indexed and
    // no two accounts can claim the same Google identity.
    googleId: { type: String },
    phone: { type: String, trim: true },
    // US/CA-first soft default; the app overwrites it with the detected device
    // zone on signup and whenever it drifts (FR-52).
    timezone: { type: String, default: DEFAULT_TIMEZONE },
    channelPreferences: { type: channelPreferencesSchema, default: () => ({}) },
    defaultLeadDays: { type: [Number], default: () => [0, 7] },
    defaultReminderTime: { type: String, default: '09:00' },
    pushTokens: { type: [String], default: () => [] },
    calendarSync: { type: calendarSyncSchema, default: () => ({}) },
    gmailIntegration: { type: gmailIntegrationSchema, default: undefined },
    googleImport: { type: googleImportSchema, default: undefined },
  },
  { timestamps: true },
);

// The feed token must be globally unique, but most users never enable sync, so
// the index is sparse - token-less users aren't indexed and don't collide.
userSchema.index({ 'calendarSync.token': 1 }, { unique: true, sparse: true });

// One account per Google identity; sparse so password-only accounts (no googleId)
// don't collide on `null`.
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) || model<UserDoc>('User', userSchema);
