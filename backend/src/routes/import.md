# Bulk Birthday Import — Implementation Guide

How to add contact-based birthday import on top of the existing `import.ts` pipeline.
Scope: **methods and how to implement them.** (Facebook/Instagram are impossible — no API returns friends' birthdays — so they are not covered here.)

## The one rule that makes everything cheap

Every source below only has to produce **`ImportCandidate[]`**. The existing
`POST /import/preview` → `POST /import/commit` flow (dedupe, merge, birthday `Event`
creation, reminder regen) is reused unchanged. Never write a second commit path.

```ts
// existing shape — every importer maps to this
type ImportCandidate = {
  name: string;
  relationshipTag?: string;
  dob?: { month: number; day: number; year?: number };
  phone?: string;
  email?: string;      // add to DTO — schema already has Person.email
  photoUrl?: string;   // add to DTO — schema already has Person.photoUrl
};
```

Pipeline: `preview` normalizes + flags `ready`/`duplicate`/`invalid`; client sends each
row back with `resolution: 'add'|'merge'|'skip'`; `commit` writes people + birthday events.

---

## Method 1 — Device contacts (enhance what exists)

**Status:** already implemented in `app/src/lib/contacts.ts` (`importDeviceContacts()`),
read-only, birthday-field-only. On iOS this includes iCloud contacts; on Android it
includes Google-synced contacts. No OAuth, no backend work.

**Problem:** it silently skips every contact that has no birthday saved — which is most of them.

**Implementation — add a picker + inline birthday entry:**

1. Add a "Pick from contacts" path using `expo-contacts`:
   ```ts
   import * as Contacts from 'expo-contacts';

   const { status } = await Contacts.requestPermissionsAsync();
   if (status !== 'granted') return { status: 'denied' };

   const { data } = await Contacts.getContactsAsync({
     fields: [
       Contacts.Fields.FirstName,
       Contacts.Fields.LastName,
       Contacts.Fields.Birthday,
       Contacts.Fields.PhoneNumbers,
       Contacts.Fields.Emails,
       Contacts.Fields.Image,
     ],
   });
   ```
2. Render **all** contacts in a multi-select list (not just ones with birthdays).
   For selected contacts missing `contact.birthday`, show an inline date field so the
   user types it during selection.
3. Map selected → `ImportCandidate[]`:
   ```ts
   const candidates = selected.map((c) => ({
     name: c.name ?? [c.firstName, c.lastName].filter(Boolean).join(' '),
     dob: c.birthday
       ? { month: c.birthday.month + 1, day: c.birthday.day, year: c.birthday.year ?? undefined }
       : manualDob[c.id],            // captured inline in step 2
     phone: c.phoneNumbers?.[0]?.number,
     email: c.emails?.[0]?.email,
   })).filter((x) => x.dob);          // only rows with a date can import
   ```
   > `expo-contacts` months are **0-indexed** — add 1.
4. Feed `candidates` to the existing `importApi.preview({ candidates })`. Nothing else changes.

**Effort:** low. App only. Biggest UX gain because it captures birthdays the user never saved.

---

## Method 2 — Google Contacts (People API) — app + website

The highest-value method: only realistic import path for the **website**, and reuses the
Google OAuth you already have. `contacts.readonly` is a **sensitive** scope (standard brand
verification, **no CASA security assessment** — lighter than your existing `gmail.send`).
Works for the first 100 users with zero verification while the OAuth app is in "testing" mode.

### Step 1 — add the scope + a consent flow

In `backend/src/lib/google-oauth.ts`, add a scope constant next to the existing ones:

```ts
export const CONTACTS_SCOPE = 'https://www.googleapis.com/auth/contacts.readonly';
```

Register a new redirect URI on the **same** Google OAuth client (e.g.
`<API_PUBLIC_URL>/integrations/google-contacts/callback`), and mirror the Gmail
incremental-auth flow in `backend/src/routes/integrations.ts`:

- `GET /integrations/google-contacts/connect?platform=app|web` → returns `{ url }`
  (build consent URL with `CONTACTS_SCOPE`, `access_type=offline`, `prompt=consent`).
- `GET /integrations/google-contacts/callback` → exchange code for tokens. You do **not**
  need to persist a refresh token for a one-shot import; you can fetch immediately and
  discard. (If you want re-sync later, store it encrypted via `token-crypto.ts` like Gmail.)

### Step 2 — fetch contacts and map to candidates

New endpoint `POST /import/google` in `import.ts` (auth-gated, like the rest). Server-side
call to People API using the freshly-obtained access token:

```ts
// GET https://people.googleapis.com/v1/people/me/connections
//   ?personFields=names,birthdays,emailAddresses,phoneNumbers,photos
//   &pageSize=1000  (paginate via pageToken until absent)

const candidates = connections
  .filter((p) => p.birthdays?.length)               // only contacts with a birthday
  .map((p) => {
    const b = p.birthdays[0].date;                  // { year?, month, day }
    return {
      name: p.names?.[0]?.displayName,
      dob: { month: b.month, day: b.day, year: b.year ?? undefined }, // 1-indexed already
      email: p.emailAddresses?.[0]?.value,
      phone: p.phoneNumbers?.[0]?.value,
      photoUrl: p.photos?.[0]?.url,
    };
  })
  .filter((x) => x.name && x.dob.month && x.dob.day);
```

> People API `date.month` is **1-indexed** (unlike expo-contacts). Some birthdays have
> no `year` — keep `year` optional; the pipeline already supports year-unknown.

Return the candidates, then hand them to the existing `POST /import/preview`. Same
preview/commit UI on both app and website.

### Step 3 — verification (only before public launch)

- Testing mode: add users as test users in Google Cloud Console → works immediately, up to 100.
- Public: submit for sensitive-scope verification (justification + short demo video).
  No security assessment required for `contacts.readonly`.

**Effort:** medium. Reuses OAuth client, token-crypto, and the whole import pipeline.

---

## Method 3 — vCard (.vcf) upload — everywhere, cheap

Better than CSV for non-technical users: every phone/Google/Apple "export contacts"
produces a `.vcf`, and it contains `BDAY`. Add a parser next to `backend/src/lib/csv.ts`
(or client-side next to `app/src/lib/csv.ts` / `website/lib/csv.ts`).

**Fields to read per `VCARD` block:**

```
FN:Jane Doe                 → name
BDAY:1990-03-05             → dob { year:1990, month:3, day:5 }
BDAY:--0305                 → dob { month:3, day:5 }         (no year)
TEL:+15551234567            → phone
EMAIL:jane@example.com      → email
```

Parsing notes:
- Split the file on `BEGIN:VCARD` / `END:VCARD`.
- `BDAY` formats to handle: `YYYY-MM-DD`, `YYYYMMDD`, and year-less `--MMDD` / `--MM-DD`.
- Unfold folded lines (a line starting with a space/tab continues the previous line).
- Emit `ImportCandidate[]` → existing `preview`. No new endpoint needed if parsed client-side;
  otherwise add `POST /import/preview` support for a `vcard?: string` body alongside `csv?`.

**Effort:** low. Works on app + website + backend.

---

## Optional model tweaks (do once, benefits all three)

In `backend/src/models/Person.ts`:

1. **Carry `email` + `photoUrl` through the candidate/commit DTO.** Fields already exist on
   `Person`; import currently drops them. Google + vCard both provide them.
2. **Add optional `source` + `externalId`** (e.g. `'google' | 'device' | 'vcard'` and the
   Google `resourceName`). Enables clean **re-sync** later — match on stable external ID
   instead of name+DOB, and lets you show "imported from Google" provenance.

No changes needed to dedupe/merge logic — `dedupeKey(name, dob)` still applies.

---

## Priority

1. **Device-contacts picker** (Method 1) — biggest UX gain, no new infra, app-only.
2. **Google Contacts** (Method 2) — highest value; only real website path; ship to test users now.
3. **vCard** (Method 3) — cheap long-tail coverage for users with no Google / no saved birthdays.

Skip Facebook/Instagram (impossible). Defer Microsoft/Outlook (works via Graph API
`contact.birthday`, but niche for personal birthdays and needs a separate OAuth app).
