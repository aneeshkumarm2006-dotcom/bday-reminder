import { Schema, model, models, type Model, type Types } from 'mongoose';

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

export interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  timezone: string;
  channelPreferences: ChannelPreferences;
  /** Default lead times as "days before" (e.g. [0, 7] = on the day + 1 week). */
  defaultLeadDays: number[];
  /** Local time-of-day reminders fire, "HH:mm" (FR-22). */
  defaultReminderTime: string;
  /** Expo push tokens registered across this user's devices (Stage 4). */
  pushTokens: string[];
  /** When the user finished first-run onboarding; unset until they do (Stage 7, FR-2/3). */
  onboardedAt?: Date;
  /** Subscribable calendar feed settings (Stage 9, FR-38/39/40). */
  calendarSync: CalendarSync;
  createdAt: Date;
  updatedAt: Date;
}

const channelPreferencesSchema = new Schema<ChannelPreferences>(
  {
    push: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    inApp: { type: Boolean, default: true },
  },
  { _id: false },
);

const calendarSyncSchema = new Schema<CalendarSync>(
  {
    enabled: { type: Boolean, default: false },
    // No `index` here — the unique+sparse index is declared on the parent schema
    // so multiple users can sit token-less (sparse) until they enable sync.
    token: { type: String },
    includePersonal: { type: Boolean, default: true },
    lists: { type: [{ type: Schema.Types.ObjectId, ref: 'SharedList' }], default: () => [] },
  },
  { _id: false },
);

const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true },
    // `unique` creates the index the TODO asks for; don't double-declare it.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Never returned by default — login re-selects it explicitly.
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    timezone: { type: String, default: 'UTC' },
    channelPreferences: { type: channelPreferencesSchema, default: () => ({}) },
    defaultLeadDays: { type: [Number], default: () => [0, 7] },
    defaultReminderTime: { type: String, default: '09:00' },
    pushTokens: { type: [String], default: () => [] },
    onboardedAt: { type: Date },
    calendarSync: { type: calendarSyncSchema, default: () => ({}) },
  },
  { timestamps: true },
);

// The feed token must be globally unique, but most users never enable sync, so
// the index is sparse — token-less users aren't indexed and don't collide.
userSchema.index({ 'calendarSync.token': 1 }, { unique: true, sparse: true });

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) || model<UserDoc>('User', userSchema);
