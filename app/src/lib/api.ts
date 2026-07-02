import { clearTokens, loadTokens, saveTokens, type Tokens } from './token-store';

/**
 * API client (techstack §3) - the only thing that talks to the backend; the app
 * never touches the database. Reads the base URL from env, attaches the access
 * token, and transparently refreshes once on a 401 before giving up. Endpoint
 * shapes match the Stage 1 auth contract (custom JWT: access + refresh).
 */

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4040';

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Lets the auth layer react to a hard 401 (refresh failed) by signing out.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Attach the access token + attempt refresh on 401. Default true. */
  auth?: boolean;
  signal?: AbortSignal;
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Single-flight refresh: the backend rotates refresh tokens single-use, so if
// several requests 401 at once each firing its own POST /auth/refresh, the first
// wins and the rest present a now-revoked token → spurious sign-out. Dedupe to
// one in-flight refresh and share its result among all waiters.
let refreshInFlight: Promise<Tokens | null> | null = null;

function refreshAccessToken(): Promise<Tokens | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefreshAccessToken(): Promise<Tokens | null> {
  const current = await loadTokens();
  if (!current) return null;
  // A network failure here throws (offline) and propagates out of apiFetch as a
  // friendly connection error WITHOUT clearing tokens - only a real server 401
  // on refresh signs the user out, below.
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  if (!res.ok) {
    await clearTokens();
    return null;
  }
  const data = (await res.json()) as Partial<Tokens>;
  if (!data.accessToken) {
    await clearTokens();
    return null;
  }
  const next: Tokens = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? current.refreshToken,
  };
  await saveTokens(next);
  return next;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options;

  const send = async (accessToken?: string): Promise<Response> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  };

  const tokens = auth ? await loadTokens() : null;
  let res = await send(tokens?.accessToken);

  // One transparent refresh-and-retry on 401.
  if (res.status === 401 && auth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await send(refreshed.accessToken);
    }
    if (res.status === 401) {
      await clearTokens();
      onUnauthorized?.();
    }
  }

  const text = await res.text();
  const data = text ? parseJson(text) : null;

  if (!res.ok) {
    const message =
      (data as { message?: string } | null)?.message ?? res.statusText ?? 'Request failed';
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

// --- Typed auth endpoints (Stage 1 contract) --------------------------------

/** Global notification channels (Stage 5; FR-23/24). */
export type ChannelPreferences = { push: boolean; email: boolean; sms: boolean; inApp: boolean };

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  timezone?: string | null;
  /** Notification + reminder defaults (Stage 5 settings). */
  channelPreferences?: ChannelPreferences;
  defaultLeadDays?: number[];
  defaultReminderTime?: string;
  /** Gmail send-as status for auto-send birthday emails (Stage 14). */
  gmailConnected?: boolean;
  gmailEmail?: string | null;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

/** Fields the settings screen can change on the current user (Stage 5). */
export type UpdateMeInput = {
  name?: string;
  phone?: string | null;
  timezone?: string;
  channelPreferences?: Partial<ChannelPreferences>;
  defaultLeadDays?: number[];
  defaultReminderTime?: string;
};

export const authApi = {
  signup: (input: { name: string; email: string; password: string; timezone?: string }) =>
    apiFetch<AuthResponse>('/auth/signup', { method: 'POST', body: input, auth: false }),

  login: (input: { email: string; password: string }) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: input, auth: false }),

  logout: (refreshToken: string) =>
    apiFetch<void>('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => {
      // Best-effort; local tokens are cleared regardless.
    }),

  me: () => apiFetch<AuthUser>('/me'),

  updateMe: (patch: UpdateMeInput) =>
    apiFetch<AuthUser>('/me', { method: 'PATCH', body: patch }),
};

// --- Gmail send-as integration (Stage 14) -----------------------------------

export const gmailApi = {
  /**
   * Get the Google consent URL to open. `platform: 'app'` makes the backend
   * callback return via the `circlethedate://gmail-connected` deep link.
   */
  connectUrl: () => apiFetch<{ url: string }>('/integrations/gmail/connect?platform=app'),

  /** Disconnect Gmail (revokes + clears the stored token). */
  disconnect: () => apiFetch<void>('/integrations/gmail', { method: 'DELETE' }),
};

// --- App config (Stage 5) ---------------------------------------------------

export type AppConfig = {
  smsWhatsappMonthlyCap: number;
  /** Whether Gmail auto-send is provisioned on the server (Stage 14). */
  gmailAutoSendAvailable?: boolean;
  /** Whether Twilio SMS auto-send is provisioned on the server (Stage 15). */
  smsAutoSendAvailable?: boolean;
};

export const configApi = {
  /** Business-configurable values the client shows but never hardcodes (FR-56). */
  get: () => apiFetch<AppConfig>('/config', { auth: false }),
};

// --- People & birthdays (Stage 3 contract) ----------------------------------

export type Feb29Rule = 'feb28' | 'feb29only' | 'mar1';
export type PersonType = 'human' | 'pet';
export type EventType = 'birthday' | 'anniversary' | 'custom';

/** Month + day always present; year optional/unknown (FR-14). */
export type DateParts = { month: number; day: number; year: number | null };

export type ChannelOverride = {
  push?: boolean;
  email?: boolean;
  sms?: boolean;
  inApp?: boolean;
};

/** Auto-send birthday greeting config for a person (Stage 14). */
export type AutoBirthdayEmail = { enabled: boolean; message: string | null };

/** Auto-send birthday SMS config for a person (Stage 15). */
export type AutoBirthdaySms = { enabled: boolean; message: string | null };

export type Person = {
  id: string;
  fullName: string;
  type: PersonType;
  relationshipTag: string | null;
  photoUrl: string | null;
  dob: DateParts;
  feb29Rule: Feb29Rule;
  phone: string | null;
  /** The friend's email + auto-send birthday greeting config (Stage 14). */
  email: string | null;
  autoBirthdayEmail: AutoBirthdayEmail;
  /** Auto-send birthday SMS config, texted to `phone` (Stage 15). */
  autoBirthdaySms: AutoBirthdaySms;
  lists: string[];
  /** Who last edited this entry, for the "Last edited by …" line (FR-45). */
  lastEditedBy?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type EventItem = {
  id: string;
  person: string;
  type: EventType;
  customName: string | null;
  date: DateParts;
  leadDaysOverride: number[] | null;
  channelOverride: ChannelOverride | null;
  reminderTimeOverride: string | null;
};

export type PersonWithEvents = { person: Person; events: EventItem[] };

/** Soonest occurrence attached to each person in the list endpoint. */
export type NextOccurrence = {
  eventId: string;
  occurrenceDate: string;
  daysRemaining: number;
  ageTurning: number | null;
};
export type PersonListItem = Person & { next: NextOccurrence | null };

export type UpcomingGroup = 'This week' | 'This month' | 'Later';

export type UpcomingItem = {
  personId: string;
  eventId: string;
  fullName: string;
  type: PersonType;
  relationshipTag: string | null;
  photoUrl: string | null;
  phone: string | null;
  eventType: EventType;
  customName: string | null;
  occurrenceDate: string;
  daysRemaining: number;
  ageTurning: number | null;
  group: UpcomingGroup;
};

export type UpcomingResponse = { today: string; tags: string[]; items: UpcomingItem[] };

/**
 * An extra event ("other date" like an anniversary) created together with the
 * person, so it's added in the same step as adding them (FR-16). Birthday is
 * auto-created from the DOB, so only these two types are accepted here.
 */
export type CreatePersonEventInput = {
  type: 'anniversary' | 'custom';
  customName?: string | null;
  date: { month: number; day: number; year?: number | null };
  reminderTimeOverride?: string | null;
};

export type CreatePersonInput = {
  fullName: string;
  dob: { month: number; day: number; year?: number | null };
  type?: PersonType;
  relationshipTag?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  feb29Rule?: Feb29Rule;
  /** The friend's email + auto-send birthday greeting (Stage 14). */
  email?: string | null;
  autoBirthdayEmail?: { enabled: boolean; message?: string | null } | null;
  /** Auto-send birthday SMS config, texted to `phone` (Stage 15). */
  autoBirthdaySms?: { enabled: boolean; message?: string | null } | null;
  /** Shared lists to add this person to (Stage 8; caller must own or belong to them). */
  lists?: string[];
  /** Extra anniversary/custom dates to create alongside the person (FR-16). */
  events?: CreatePersonEventInput[];
};
export type UpdatePersonInput = Partial<CreatePersonInput>;

function queryString(params: Record<string, string | undefined>): string {
  const pairs = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (pairs.length === 0) return '';
  return '?' + pairs.map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&');
}

export const peopleApi = {
  /** The computed Upcoming feed - grouped + sorted server-side (DESIGN.md §8.2). */
  upcoming: () => apiFetch<UpcomingResponse>('/upcoming'),

  list: (params: { tag?: string; sort?: 'next' | 'name' } = {}) =>
    apiFetch<{ people: PersonListItem[] }>(`/people${queryString(params)}`),

  get: (id: string) => apiFetch<PersonWithEvents>(`/people/${id}`),

  create: (input: CreatePersonInput) =>
    apiFetch<PersonWithEvents>('/people', { method: 'POST', body: input }),

  update: (id: string, patch: UpdatePersonInput) =>
    apiFetch<PersonWithEvents>(`/people/${id}`, { method: 'PATCH', body: patch }),

  remove: (id: string) => apiFetch<void>(`/people/${id}`, { method: 'DELETE' }),
};

// --- Events: anniversary/custom + per-event overrides (Stage 5/6 contract) --

/** Set (object) or clear (null → use the user default) an event's overrides. */
export type EventOverrideInput = {
  leadDaysOverride?: number[] | null;
  channelOverride?: ChannelOverride | null;
  reminderTimeOverride?: string | null;
};

/** Create an Anniversary/Custom event on a person (FR-16). Birthday is auto. */
export type CreateEventInput = EventOverrideInput & {
  person: string;
  type: 'anniversary' | 'custom';
  customName?: string | null;
  date: { month: number; day: number; year?: number | null };
};

/** Edit an event's name/date and/or its overrides. */
export type UpdateEventInput = EventOverrideInput & {
  customName?: string | null;
  date?: { month: number; day: number; year?: number | null };
};

export const eventsApi = {
  create: (input: CreateEventInput) =>
    apiFetch<{ event: EventItem }>('/events', { method: 'POST', body: input }),

  update: (id: string, patch: UpdateEventInput) =>
    apiFetch<{ event: EventItem }>(`/events/${id}`, { method: 'PATCH', body: patch }),

  /** Remove an Anniversary/Custom event; cascades its reminders (FR-16, §10). */
  remove: (id: string) => apiFetch<void>(`/events/${id}`, { method: 'DELETE' }),
};

// --- Gift notes (Stage 6 contract; FR-35/36/37) -----------------------------

/** One timestamped gift-note entry; part of a running per-person list (FR-36). */
export type Note = {
  id: string;
  person: string;
  author: string;
  text: string;
  createdAt: string;
};

export const notesApi = {
  /** A person's notes, newest first. */
  list: (personId: string) => apiFetch<{ notes: Note[] }>(`/people/${personId}/notes`),

  create: (personId: string, text: string) =>
    apiFetch<{ note: Note }>(`/people/${personId}/notes`, { method: 'POST', body: { text } }),

  remove: (personId: string, noteId: string) =>
    apiFetch<void>(`/people/${personId}/notes/${noteId}`, { method: 'DELETE' }),
};

// --- Photo uploads (Stage 6 contract; FR-10) --------------------------------

/** `hosted` is false when Cloudinary isn't configured (data-URL fallback). */
export type UploadResult = { url: string; hosted: boolean };

export const uploadsApi = {
  /** Upload a base64 image data URI; returns the URL to store on the person. */
  photo: (image: string) =>
    apiFetch<UploadResult>('/uploads/photo', { method: 'POST', body: { image } }),
};

// --- Bulk import: contacts + duplicates (Stage 7 contract; FR-6/11) --

/** A structured import row (device contacts produce these directly). */
export type ImportCandidate = {
  name: string;
  relationshipTag?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  /** Month + day required to be importable; year optional (FR-14). */
  dob?: { month: number; day: number; year?: number | null } | null;
};

/** One preview row, annotated by the server (ready / invalid / possible duplicate). */
export type ImportPreviewRow = {
  id: string;
  name: string;
  relationshipTag: string | null;
  phone: string | null;
  photoUrl: string | null;
  dob: DateParts | null;
  status: 'ready' | 'duplicate' | 'invalid';
  /** Why a row is invalid, phrased as the fix (§10 voice). */
  error: string | null;
  /** Set when this looks like an existing person or an earlier row in the batch. */
  duplicate: { kind: 'existing' | 'batch'; personId: string | null; fullName: string } | null;
};

export type ImportSummary = { total: number; ready: number; duplicates: number; invalid: number };

export type ImportPreviewResponse = { rows: ImportPreviewRow[]; summary: ImportSummary };

/** How the user chose to resolve a row: keep both / merge / skip (FR-11). */
export type ImportResolution = 'add' | 'merge' | 'skip';

export type ImportCommitItem = {
  name: string;
  relationshipTag?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  dob: { month: number; day: number; year?: number | null };
  resolution: ImportResolution;
  /** Required when resolution is `merge`. */
  mergeTargetId?: string | null;
};

export type ImportCommitResponse = {
  summary: { added: number; merged: number; skipped: number; total: number };
};

export const importApi = {
  /** Preview contact rows - validates + flags duplicates, creates nothing. */
  preview: (input: { candidates: ImportCandidate[] }) =>
    apiFetch<ImportPreviewResponse>('/import/preview', { method: 'POST', body: input }),

  /** Commit the user's resolved rows; returns the import summary (FR-11). */
  commit: (items: ImportCommitItem[]) =>
    apiFetch<ImportCommitResponse>('/import/commit', { method: 'POST', body: { items } }),
};

// --- Reminders (Stage 4 contract) -------------------------------------------

export type ChannelKey = 'push' | 'email' | 'sms' | 'inApp';

/** Effective status of a collapsed occurrence in the feed (DESIGN.md §8.3). */
export type ReminderStatus = 'pending' | 'sent' | 'snoozed' | 'done';

export type SnoozePreset = 'in1h' | 'in4h' | 'tomorrow';

export type ReminderPerson = {
  id: string;
  fullName: string;
  type: PersonType;
  relationshipTag: string | null;
  photoUrl: string | null;
  phone: string | null;
};

export type ReminderEvent = { id: string; type: EventType; customName: string | null };

export type ReminderItem = {
  id: string;
  status: ReminderStatus;
  leadDays: number;
  channels: ChannelKey[];
  occurrenceDate: string;
  scheduledFor: string | null;
  snoozeUntil: string | null;
  sentAt: string | null;
  daysRemaining: number;
  ageTurning: number | null;
  /** The server-rendered §11 reminder line - single source of truth for copy. */
  message: string;
  /** Day-of + a phone number on file → show "Send greeting" (FR-28/30). */
  canGreet: boolean;
  person: ReminderPerson;
  event: ReminderEvent;
};

export type RemindersResponse = { today: string; items: ReminderItem[] };

export const remindersApi = {
  /** The persistent in-app reminder feed (FR-27). */
  list: () => apiFetch<RemindersResponse>('/reminders'),

  /** Stop further reminders for this occurrence; the row persists (FR-31/32). */
  markDone: (id: string) =>
    apiFetch<{ reminder: ReminderItem }>(`/reminders/${id}/done`, { method: 'POST' }),

  /** Snooze the occurrence; it reappears after the delay (FR-33). */
  snooze: (id: string, preset: SnoozePreset) =>
    apiFetch<{ reminder: ReminderItem; snoozeUntil: string }>(`/reminders/${id}/snooze`, {
      method: 'POST',
      body: { preset },
    }),

  registerPushToken: (token: string) =>
    apiFetch<{ pushTokens: string[] }>('/me/push-tokens', { method: 'POST', body: { token } }),

  unregisterPushToken: (token: string) =>
    apiFetch<{ pushTokens: string[] }>('/me/push-tokens', { method: 'DELETE', body: { token } }),
};

// --- Shared / family lists (Stage 8 contract; FR-41-47) ---------------------

export type ListMember = {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
};

/** A pending invite, shown to the list owner until it's accepted (FR-42). */
export type PendingInvite = {
  id: string;
  list: string;
  invitedEmailOrPhone: string;
  status: 'pending' | 'accepted';
  createdAt: string;
};

export type SharedListView = {
  id: string;
  name: string;
  /** Whether the viewer owns or is a member of the list. */
  role: 'owner' | 'member';
  owner: { id: string; name: string } | null;
  /** Owner first (badged), then accepted members. */
  members: ListMember[];
  memberCount: number;
  peopleCount: number;
  /** Owner-only; empty for members. */
  pendingInvites: PendingInvite[];
  createdAt: string;
};

/** The invite create response - carries the secret token + a shareable link. */
export type CreatedInvite = PendingInvite & { token: string; acceptUrl: string };

export type InvitePreview = {
  id: string;
  listName: string;
  inviterName: string;
  status: 'pending' | 'accepted';
  alreadyMember: boolean;
};

export type InviteEmailOutcome = 'sent' | 'skipped' | 'failed';

export const listsApi = {
  /** Every list the user owns or belongs to (FR-44). */
  list: () => apiFetch<{ lists: SharedListView[] }>('/lists'),

  get: (id: string) => apiFetch<{ list: SharedListView }>(`/lists/${id}`),

  create: (name: string) =>
    apiFetch<{ list: SharedListView }>('/lists', { method: 'POST', body: { name } }),

  rename: (id: string, name: string) =>
    apiFetch<{ list: SharedListView }>(`/lists/${id}`, { method: 'PATCH', body: { name } }),

  /** Delete the list - people detach, every member loses access (FR-47). */
  remove: (id: string) => apiFetch<void>(`/lists/${id}`, { method: 'DELETE' }),

  /** Invite by email / phone / link; the invitee must accept (FR-41/42). */
  invite: (id: string, input: { invitedEmailOrPhone?: string }) =>
    apiFetch<{ invite: CreatedInvite; emailOutcome: InviteEmailOutcome }>(`/lists/${id}/invite`, {
      method: 'POST',
      body: input,
    }),

  revokeInvite: (id: string, inviteId: string) =>
    apiFetch<void>(`/lists/${id}/invites/${inviteId}`, { method: 'DELETE' }),

  /** Owner removes a member; their reminders for the list stop (FR-46). */
  removeMember: (id: string, memberId: string) =>
    apiFetch<{ list: SharedListView }>(`/lists/${id}/members/${memberId}`, { method: 'DELETE' }),

  /** Leave a list you're a member of; your reminders for it stop (FR-46). */
  leave: (id: string) => apiFetch<void>(`/lists/${id}/leave`, { method: 'POST' }),
};

export const invitesApi = {
  /** Preview an invite before accepting (list + inviter). */
  preview: (token: string) => apiFetch<{ invite: InvitePreview }>(`/invites/${token}`),

  /** Explicitly accept an invite and join the list (FR-42). */
  accept: (token: string) =>
    apiFetch<{ list: SharedListView }>(`/invites/${token}/accept`, { method: 'POST' }),
};

// --- Calendar sync (Stage 9 contract; FR-38/39/40) --------------------------

/** A list the user can choose to include in their calendar feed. */
export type CalendarListRef = { id: string; name: string };

export type CalendarSyncSettings = {
  /** Opt-in master switch - the feed only serves while this is on (FR-40). */
  enabled: boolean;
  /** Include people the user owns ("My birthdays"). */
  includePersonal: boolean;
  /** Shared lists the user chose to sync (intersected with current access). */
  lists: string[];
  /** The subscribe URLs - present only while enabled. */
  feedUrl: string | null;
  webcalUrl: string | null;
  /** Every list the user owns or belongs to (the per-list opt-in choices). */
  availableLists: CalendarListRef[];
};

export type UpdateCalendarSyncInput = {
  enabled?: boolean;
  includePersonal?: boolean;
  lists?: string[];
};

export const calendarApi = {
  /** Current calendar-sync settings + subscribe link (FR-38/40). */
  get: () => apiFetch<CalendarSyncSettings>('/me/calendar'),

  /** Opt in/out and choose what to include; returns the updated settings. */
  update: (patch: UpdateCalendarSyncInput) =>
    apiFetch<CalendarSyncSettings>('/me/calendar', { method: 'PATCH', body: patch }),

  /** Issue a new feed token, revoking the old subscribe link. */
  rotate: () => apiFetch<CalendarSyncSettings>('/me/calendar/rotate', { method: 'POST' }),
};

// --- In-app month calendar (raw month/day per event) ------------------------

/**
 * One event placed on the calendar grid by its RAW recurring month/day - the
 * grid pages to any month, so it needs the stored date (not a resolved next
 * occurrence). `feb29Rule` lets the grid observe a Feb-29 event in non-leap
 * years (FR-15). Distinct from `calendarApi` (ICS sync settings, Stage 9).
 */
export type CalendarEvent = {
  personId: string;
  eventId: string;
  fullName: string;
  type: PersonType;
  relationshipTag: string | null;
  photoUrl: string | null;
  eventType: EventType;
  customName: string | null;
  month: number;
  day: number;
  year: number | null;
  feb29Rule: Feb29Rule;
};

export type CalendarEventsResponse = { today: string; events: CalendarEvent[] };

export const calendarEventsApi = {
  /** Every accessible event with its raw month/day for the month-grid calendar. */
  list: () => apiFetch<CalendarEventsResponse>('/calendar/events'),
};
