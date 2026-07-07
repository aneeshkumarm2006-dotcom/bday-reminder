import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchCalendarSpecialDates, type CalendarSpecialDate } from '../../src/lib/google-calendar';
import { fetchContacts, type NormalizedContact } from '../../src/lib/google-contacts';
import { mergeGoogleSources } from '../../src/lib/google-import';
import { annotateCandidates, MAX_IMPORT_ROWS, type RawCandidate } from '../../src/lib/import';

/** Build a NormalizedContact with sensible defaults for merge tests. */
function contact(partial: Partial<NormalizedContact> & { resourceName: string; name: string }): NormalizedContact {
  return {
    email: null,
    phone: null,
    photoUrl: null,
    birthday: null,
    events: [],
    ...partial,
  };
}

describe('mergeGoogleSources: Contacts + Calendar → candidates', () => {
  it('collapses a calendar event onto its linked contact; Contacts wins on identity/year', () => {
    const contacts = [
      contact({
        resourceName: 'people/c1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+15551234567',
        birthday: { month: 5, day: 1, year: 1990 },
      }),
    ];
    const cal: CalendarSpecialDate[] = [
      // Duplicate birthday from the calendar - contact already has it, so ignored.
      { resourceName: 'people/c1', type: 'birthday', month: 5, day: 1, customName: null, summary: 'Jane Doe' },
      // An anniversary the contact lacks - unioned in.
      { resourceName: 'people/c1', type: 'anniversary', month: 6, day: 2, customName: null, summary: "Jane's anniversary" },
    ];

    const { candidates, truncated } = mergeGoogleSources(contacts, cal);
    expect(truncated).toBe(false);
    expect(candidates).toHaveLength(1);
    const [c] = candidates;
    expect(c.name).toBe('Jane Doe');
    expect(c.email).toBe('jane@example.com');
    expect(c.dob).toEqual({ month: 5, day: 1, year: 1990 }); // year preserved from Contacts
    expect(c.events).toEqual([{ type: 'anniversary', customName: null, date: { month: 6, day: 2, year: null } }]);
  });

  it('fills a contact’s missing birthday from a linked calendar birthday (year unknown)', () => {
    const contacts = [contact({ resourceName: 'people/c3', name: 'Meg' })];
    const cal: CalendarSpecialDate[] = [
      { resourceName: 'people/c3', type: 'birthday', month: 8, day: 8, customName: null, summary: 'Meg' },
    ];
    const { candidates } = mergeGoogleSources(contacts, cal);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].dob).toEqual({ month: 8, day: 8, year: null });
  });

  it('makes a standalone candidate from a calendar-only birthday, recovering the name', () => {
    const cal: CalendarSpecialDate[] = [
      { resourceName: null, type: 'birthday', month: 7, day: 4, customName: null, summary: "Bob's birthday" },
    ];
    const { candidates } = mergeGoogleSources([], cal);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].name).toBe('Bob');
    expect(candidates[0].dob).toEqual({ month: 7, day: 4, year: null });
  });

  it('drops a calendar-only event whose name can’t be recovered (import only what we can)', () => {
    const cal: CalendarSpecialDate[] = [
      { resourceName: null, type: 'birthday', month: 1, day: 1, customName: null, summary: 'Birthday' },
    ];
    expect(mergeGoogleSources([], cal).candidates).toHaveLength(0);
  });

  it('drops an anniversary-only contact (Person requires a birthday)', () => {
    const contacts = [
      contact({
        resourceName: 'people/c2',
        name: 'No Bday',
        events: [{ type: 'anniversary', customName: null, date: { month: 2, day: 2, year: null } }],
      }),
    ];
    expect(mergeGoogleSources(contacts, []).candidates).toHaveLength(0);
  });

  it('does not duplicate an event the contact already has', () => {
    const contacts = [
      contact({
        resourceName: 'people/c4',
        name: 'Al',
        birthday: { month: 4, day: 4, year: null },
        events: [{ type: 'anniversary', customName: null, date: { month: 6, day: 2, year: null } }],
      }),
    ];
    const cal: CalendarSpecialDate[] = [
      { resourceName: 'people/c4', type: 'anniversary', month: 6, day: 2, customName: null, summary: 'Al anniversary' },
    ];
    const { candidates } = mergeGoogleSources(contacts, cal);
    expect(candidates[0].events).toHaveLength(1);
  });

  it('caps the merged list at MAX_IMPORT_ROWS and flags truncation', () => {
    const contacts = Array.from({ length: MAX_IMPORT_ROWS + 5 }, (_, i) =>
      contact({ resourceName: `people/c${i}`, name: `Person ${i}`, birthday: { month: 1, day: 1, year: null } }),
    );
    const { candidates, truncated } = mergeGoogleSources(contacts, []);
    expect(candidates).toHaveLength(MAX_IMPORT_ROWS);
    expect(truncated).toBe(true);
  });
});

describe('annotateCandidates: shared duplicate/validity annotation', () => {
  const cand = (partial: Partial<RawCandidate> & { name: string }): RawCandidate => ({
    relationshipTag: null,
    phone: null,
    photoUrl: null,
    dob: { month: 1, day: 1, year: null },
    email: null,
    events: [],
    rawDob: null,
    ...partial,
  });

  it('flags a match against an existing person as a duplicate/existing', () => {
    const { rows } = annotateCandidates(
      [cand({ name: 'Sam', dob: { month: 3, day: 3, year: 1990 } })],
      [{ id: 'p1', fullName: 'Sam', dob: { month: 3, day: 3, year: 1990 } }],
    );
    expect(rows[0].status).toBe('duplicate');
    expect(rows[0].duplicate).toMatchObject({ kind: 'existing', personId: 'p1' });
  });

  it('flags a repeat within the same batch as duplicate/batch', () => {
    const { rows } = annotateCandidates(
      [cand({ name: 'Sam', dob: { month: 3, day: 3, year: 1990 } }), cand({ name: 'Sam', dob: { month: 3, day: 3, year: 1990 } })],
      [],
    );
    expect(rows[0].status).toBe('ready');
    expect(rows[1].status).toBe('duplicate');
    expect(rows[1].duplicate?.kind).toBe('batch');
  });

  it('marks nameless / dateless rows invalid and passes email + events through', () => {
    const { rows, summary } = annotateCandidates(
      [
        cand({ name: '' }),
        cand({ name: 'NoDate', dob: null }),
        cand({
          name: 'Rich',
          dob: { month: 5, day: 5, year: null },
          email: 'rich@example.com',
          events: [{ type: 'anniversary', customName: null, date: { month: 6, day: 6, year: null } }],
        }),
      ],
      [],
    );
    expect(rows[0].status).toBe('invalid');
    expect(rows[1].status).toBe('invalid');
    expect(rows[2].status).toBe('ready');
    expect(rows[2].email).toBe('rich@example.com');
    expect(rows[2].events).toHaveLength(1);
    expect(summary).toEqual({ total: 3, ready: 1, duplicates: 0, invalid: 2 });
  });
});

// --- Fetch mappers (mocked network) -----------------------------------------

function mockFetchOnce(payload: unknown, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchContacts: People API → NormalizedContact', () => {
  it('extracts name, structured birthday, anniversary event, email, phone; skips default photo', async () => {
    mockFetchOnce({
      connections: [
        {
          resourceName: 'people/c1',
          names: [{ displayName: 'Jane Doe', metadata: { primary: true } }],
          birthdays: [{ date: { year: 1990, month: 5, day: 1 }, metadata: { primary: true } }],
          events: [{ date: { month: 6, day: 2 }, type: 'anniversary', formattedType: 'Anniversary' }],
          emailAddresses: [{ value: 'Jane@Example.com', metadata: { primary: true } }],
          phoneNumbers: [{ value: '+1 555 123 4567' }],
          photos: [{ url: 'https://x/default.png', default: true }],
        },
      ],
    });

    const [c] = await fetchContacts('fake-token');
    expect(c.name).toBe('Jane Doe');
    expect(c.birthday).toEqual({ month: 5, day: 1, year: 1990 });
    expect(c.email).toBe('jane@example.com'); // lowercased
    expect(c.phone).toBe('+1 555 123 4567');
    expect(c.photoUrl).toBeNull(); // default silhouette skipped
    expect(c.events).toEqual([{ type: 'anniversary', customName: null, date: { month: 6, day: 2, year: null } }]);
  });

  it('parses a free-text birthday and skips a nameless contact', async () => {
    mockFetchOnce({
      connections: [
        { resourceName: 'people/c2', names: [], birthdays: [{ text: 'June 5' }] }, // no name → skipped
        { resourceName: 'people/c3', names: [{ displayName: 'Kim' }], birthdays: [{ text: 'June 5' }] },
      ],
    });
    const out = await fetchContacts('fake-token');
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Kim');
    expect(out[0].birthday).toEqual({ month: 6, day: 5, year: null });
  });

  it('treats a 403 as a soft skip (returns empty, does not throw)', async () => {
    mockFetchOnce({ error: 'insufficient scope' }, 403);
    await expect(fetchContacts('fake-token')).resolves.toEqual([]);
  });
});

describe('fetchCalendarSpecialDates: Calendar API → CalendarSpecialDate', () => {
  it('maps birthday + anniversary events, links the contact, and skips the user’s own', async () => {
    mockFetchOnce({
      items: [
        {
          summary: 'Jane Doe',
          eventType: 'birthday',
          start: { date: '2026-05-01' },
          birthdayProperties: { type: 'birthday', contact: 'people/c1' },
        },
        {
          summary: 'Wedding',
          eventType: 'birthday',
          start: { date: '2026-06-02' },
          birthdayProperties: { type: 'anniversary', contact: 'people/c1' },
        },
        {
          summary: 'My birthday',
          eventType: 'birthday',
          start: { date: '2026-01-01' },
          birthdayProperties: { type: 'self' }, // the user themself → skipped
        },
      ],
    });

    const out = await fetchCalendarSpecialDates('fake-token');
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ type: 'birthday', month: 5, day: 1, resourceName: 'people/c1' });
    expect(out[1]).toMatchObject({ type: 'anniversary', month: 6, day: 2, resourceName: 'people/c1' });
  });

  it('treats a 403 as a soft skip (returns empty, does not throw)', async () => {
    mockFetchOnce({ error: 'insufficient scope' }, 403);
    await expect(fetchCalendarSpecialDates('fake-token')).resolves.toEqual([]);
  });
});
