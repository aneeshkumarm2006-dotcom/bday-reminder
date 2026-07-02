import type { EventDoc } from '../models/Event';
import type { InviteDoc } from '../models/Invite';
import type { NoteDoc } from '../models/Note';
import type { PersonDoc } from '../models/Person';
import type { ReminderDoc, ReminderStatus } from '../models/Reminder';
import type { SharedListDoc } from '../models/SharedList';
import type { UserDoc } from '../models/User';
import { ageTurning, daysUntil } from './dates';
import { loadEnv } from './env';
import { reminderMessage } from './reminder-content';

/**
 * Public user shape returned by the API. Never includes `passwordHash` (which
 * is `select: false` anyway). Matches the app's `AuthUser` plus the preference
 * fields the settings screens use.
 */
export function serializeUser(user: UserDoc) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    timezone: user.timezone,
    channelPreferences: user.channelPreferences,
    defaultLeadDays: user.defaultLeadDays,
    defaultReminderTime: user.defaultReminderTime,
    // Gmail send-as status for auto-send birthday emails (Stage 14). The token is
    // never exposed; the client only needs to know whether it's connected + which
    // address, to gate the auto-send toggle and show the Settings card.
    gmailConnected: !!user.gmailIntegration?.email,
    gmailEmail: user.gmailIntegration?.email ?? null,
  };
}

/**
 * Calendar-sync settings for the app (Stage 9; FR-38/39/40). The subscribe URLs
 * are exposed only while sync is enabled and a token exists. `lists` and
 * `availableLists` are intersected with the lists the caller can currently
 * access, so a left/removed list silently drops out (FR-46). `accessibleLists`
 * is every list the caller owns or belongs to (the choices for per-list opt-in).
 */
export function serializeCalendarSync(user: UserDoc, accessibleLists: SharedListDoc[]) {
  const cs = user.calendarSync;
  const accessibleIds = new Set(accessibleLists.map((l) => l._id.toString()));
  const lists = (cs?.lists ?? []).map((id) => id.toString()).filter((id) => accessibleIds.has(id));

  const base = loadEnv().API_PUBLIC_URL.replace(/\/+$/, '');
  const live = !!cs?.enabled && !!cs?.token;
  const feedUrl = live ? `${base}/calendar/${cs!.token}.ics` : null;
  const webcalUrl = feedUrl ? feedUrl.replace(/^https?:\/\//, 'webcal://') : null;

  return {
    enabled: !!cs?.enabled,
    includePersonal: cs?.includePersonal ?? true,
    lists,
    feedUrl,
    webcalUrl,
    availableLists: accessibleLists.map((l) => ({ id: l._id.toString(), name: l.name })),
  };
}

/** Attribution attached to a Person on read (Stage 8). */
export interface PersonExtras {
  /** Who last edited this entry, for the "Last edited by …" line (FR-45). */
  lastEditedBy?: { id: string; name: string } | null;
}

/** Public Person shape (TODO Stage 3). `dob.year` stays optional (FR-14). */
export function serializePerson(person: PersonDoc, extras: PersonExtras = {}) {
  return {
    id: person._id.toString(),
    fullName: person.fullName,
    type: person.type,
    relationshipTag: person.relationshipTag ?? null,
    photoUrl: person.photoUrl ?? null,
    dob: { month: person.dob.month, day: person.dob.day, year: person.dob.year ?? null },
    feb29Rule: person.feb29Rule,
    phone: person.phone ?? null,
    // The friend's email + auto-send birthday greeting config (Stage 14). Only the
    // client-relevant bits (enabled + editable message) are exposed - the internal
    // lastSentYear guard stays server-side.
    email: person.email ?? null,
    autoBirthdayEmail: person.autoBirthdayEmail
      ? {
          enabled: person.autoBirthdayEmail.enabled,
          message: person.autoBirthdayEmail.message ?? null,
          sendTime: person.autoBirthdayEmail.sendTime ?? null,
        }
      : { enabled: false, message: null, sendTime: null },
    // The friend's auto-send birthday SMS config (Stage 15). Same shape; the
    // internal lastSentYear guard stays server-side.
    autoBirthdaySms: person.autoBirthdaySms
      ? {
          enabled: person.autoBirthdaySms.enabled,
          message: person.autoBirthdaySms.message ?? null,
          sendTime: person.autoBirthdaySms.sendTime ?? null,
        }
      : { enabled: false, message: null, sendTime: null },
    lists: person.lists.map((id) => id.toString()),
    // Shared-list attribution (Stage 8); omitted on personal-only contexts that don't pass it.
    ...(extras.lastEditedBy !== undefined ? { lastEditedBy: extras.lastEditedBy } : {}),
    createdAt: person.createdAt.toISOString(),
    updatedAt: person.updatedAt.toISOString(),
  };
}

/**
 * Public Invite shape (TODO Stage 8; FR-41/42). The `token` is included only on
 * the create response (so the owner can copy the link); list/detail responses
 * use `serializeInvite` without it.
 */
export function serializeInvite(invite: InviteDoc) {
  return {
    id: invite._id.toString(),
    list: invite.list.toString(),
    invitedEmailOrPhone: invite.invitedEmailOrPhone,
    status: invite.status,
    createdAt: invite.createdAt.toISOString(),
  };
}

/**
 * Public Note shape (TODO Stage 6; FR-35/36/37). One timestamped gift-note
 * entry; `createdAt` drives the relative-date label the profile renders.
 */
export function serializeNote(note: NoteDoc) {
  return {
    id: note._id.toString(),
    person: note.person.toString(),
    author: note.author.toString(),
    text: note.text,
    createdAt: note.createdAt.toISOString(),
  };
}

/** Public Event shape (TODO Stage 3). Overrides surface in Stages 4-6. */
export function serializeEvent(event: EventDoc) {
  return {
    id: event._id.toString(),
    person: event.person.toString(),
    type: event.type,
    customName: event.customName ?? null,
    date: { month: event.date.month, day: event.date.day, year: event.date.year ?? null },
    leadDaysOverride: event.leadDaysOverride ?? null,
    channelOverride: event.channelOverride ?? null,
    reminderTimeOverride: event.reminderTimeOverride ?? null,
  };
}

/**
 * Public Reminder shape for the in-app feed + action responses (TODO Stage 4).
 * The §11 reminder line is computed here so the feed, push, and email all read
 * identically. `status` is passed in explicitly because the feed collapses an
 * occurrence's lead-time instances into one row with an *effective* status
 * (done if acted, snoozed if snoozed, else delivered). `daysRemaining`/age are
 * recomputed against the viewer's "today" so the copy stays current (FR-53).
 */
export function serializeReminder(
  reminder: ReminderDoc,
  event: EventDoc,
  person: PersonDoc,
  today: Date,
  status: ReminderStatus,
) {
  const days = daysUntil(reminder.occurrenceDate, today);
  const age = event.type === 'birthday' ? ageTurning(reminder.occurrenceDate, event.date.year) : null;
  return {
    id: reminder._id.toString(),
    status,
    leadDays: reminder.leadDays,
    channels: reminder.channels,
    occurrenceDate: reminder.occurrenceDate.toISOString(),
    scheduledFor: reminder.scheduledFor ? reminder.scheduledFor.toISOString() : null,
    snoozeUntil: reminder.snoozeUntil ? reminder.snoozeUntil.toISOString() : null,
    sentAt: reminder.sentAt ? reminder.sentAt.toISOString() : null,
    daysRemaining: days,
    ageTurning: age,
    message: reminderMessage({
      name: person.fullName,
      eventType: event.type,
      customName: event.customName ?? null,
      daysRemaining: days,
      ageTurning: age,
    }),
    // Day-of quick-greeting only when a phone number exists (FR-28/30).
    canGreet: days === 0 && !!person.phone,
    person: {
      id: person._id.toString(),
      fullName: person.fullName,
      type: person.type,
      relationshipTag: person.relationshipTag ?? null,
      photoUrl: person.photoUrl ?? null,
      phone: person.phone ?? null,
    },
    event: { id: event._id.toString(), type: event.type, customName: event.customName ?? null },
  };
}
