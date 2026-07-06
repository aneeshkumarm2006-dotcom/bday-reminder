# Analytics Hub — setup & operations

A private, self-configuring analytics dashboard at **`/analyticshub`** (inside this
Next.js site, so `https://<your-domain>/analyticshub`). It shows an Overview plus
one deep-dive page per source — **Analytics (GA4)**, **Search Console**, **Meta
Ads**, **Google Ads**, and **Users** (your app's signups) — reading everything
through one serverless function. All provider credentials are entered through the
dashboard's own Settings page; none live in code.

- **Login:** shares the existing `/seoteam` password (one login for both
  dashboards). No separate account.
- **Storage:** the shared MongoDB cluster — a `analyticshub_config` collection is
  created automatically on first write. No migration to run, and (unlike Postgres)
  no table grants to configure.
- **Not indexed:** `noindex` metadata + `robots.txt` disallow + an `X-Robots-Tag`
  header.

---

## 1. One-time: the shared Google OAuth app (optional but recommended)

Lets you connect GA4 + Search Console with "Sign in with Google" instead of a
service-account key. Do this **once, ever** (all deployments share it):

1. Create/choose a Google Cloud project.
2. Enable these APIs: **Google Analytics Data API**, **Google Analytics Admin
   API**, **Search Console API**.
3. OAuth consent screen: **External**; add yourself as a test user (or publish).
4. Create an **OAuth client ID** → type **Web application**.
5. Under *Authorized redirect URIs* add, for **each** deployment:
   `https://<domain>/analyticshub/api/oauth/google/callback`
   and for local dev: `http://localhost:3000/analyticshub/api/oauth/google/callback`
6. Copy the **Client ID** and **Client secret** → the two `GOOGLE_OAUTH_*` env vars.

If you skip this, the Google card still works via the **service-account** path
(paste a key JSON) — see §5.

## 2. Per-project environment variables

Add to the deployment's environment (and `website/.env.local` for dev). **Env vars
only bake into deployments created *after* they're saved — redeploy after adding
any.**

| Var | Required | Notes |
| --- | --- | --- |
| `ANALYTICSHUB_SECRET_KEY` | **yes** | `openssl rand -base64 32` — paste the raw 44-char output, no quotes. Encrypts stored credentials. **Changing it orphans everything stored.** |
| `GOOGLE_OAUTH_CLIENT_ID` | optional | From §1. Absent → service-account path only. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | optional | From §1. |

**Reused from the existing dashboard (already set):** `SESSION_SECRET` (≥32 chars,
signs the session cookie), `SEO_DASHBOARD_PASSWORD` (the login), `MONGODB_URI`.

## 3. First run

1. Deploy with the env vars above, then open `https://<domain>/analyticshub`.
2. Log in with the `/seoteam` password.
3. The **setup wizard** appears: confirm the project name/colors → connect the
   sources you use (all skippable) → Overview. You can revisit everything in
   **Settings** later.

Users (signups) works immediately with no credentials — it reads your app's
`users` collection directly.

## 4. Connecting Google (GA4 + Search Console)

- **Option A — Sign in with Google** (needs §1): click *Sign in with Google*, grant
  read-only Analytics + Search Console, then pick a **GA4 property** and a **Search
  Console site** from the dropdowns. Each is validated with a 1-row probe before
  saving.
- **Option B — Service account:** in Settings' Google card, *Use a service-account
  key instead*, paste the full key JSON, and enter the GA4 property ID
  (`properties/123456789`) + the Search Console site URL. Grant the service account
  **Viewer** on the GA4 property and add it as a user on the Search Console
  property first.

## 5. Meta Ads (optional)

1. Create a long-lived access token with the **`ads_read`** permission (a system
   user token in Meta Business Settings is the durable option).
2. Settings → Meta Ads → paste the token → **Validate token** → choose the **ad
   account** → **Save**.
3. A revoked/expired token later flips Meta to "Reconnect needed" everywhere.

## 6. Google Ads (optional — the most involved)

You need, from the Google Ads API:
- a **developer token** (from your Google Ads manager account, API Center),
- an **OAuth client ID + secret** (a Google Cloud OAuth client),
- a **refresh token** for that client (with the `adwords` scope),
- the **customer ID** (10 digits, no dashes),
- optionally a **login customer ID** (your MCC) if accessing via a manager account.

Settings → Google Ads → fill the fields → **Validate & connect** (a 1-row
`searchStream` probe runs before anything is stored).

## 7. Error messages (what `/status` reports, and the fix)

The dashboard surfaces configuration problems plainly:

| Message | Fix |
| --- | --- |
| `ANALYTICSHUB_SECRET_KEY is not set…` | Generate one (`openssl rand -base64 32`) and redeploy. |
| `ANALYTICSHUB_SECRET_KEY must decode to 32 bytes (got N)…` | It's truncated/not base64 — regenerate. |
| `MONGODB_URI is not set…` | Reuse the backend cluster's URI. |
| `Database connection failed: …` | The verbatim driver error (bad host/credentials/IP allowlist). |
| `Google sign-in is unavailable (GOOGLE_OAUTH_* not set)…` | Add the OAuth vars, or use a service-account key. |
| A source card shows the **provider's own error** | Fix the credential it names; nothing is stored unless it validates. |

## 8. Local development

Just `cd website && npm run dev` — Next runs the catch-all API and the proxy
natively (no separate dev harness). Cookies are non-Secure in dev so http
localhost authenticates. Point the Google OAuth redirect URI at
`http://localhost:3000/...` (see §1).

## 9. Verifying

- `npm run typecheck` · `npm run lint` · `npm run build` (the hub adds exactly one
  serverless function: `/analyticshub/api/[...path]`).
- `npm run test` — unit tests (crypto round-trip/tamper, dates, chart scale, the
  validated color palette, and the URL-dispatch first-run flow).
- `npm run e2e` — Playwright screenshots of every state (run
  `npx playwright install chromium` once first).

## Go-live checklist

- [ ] `ANALYTICSHUB_SECRET_KEY` set (kept stable forever after).
- [ ] `GOOGLE_OAUTH_*` set and the callback URI registered (if using OAuth).
- [ ] `SESSION_SECRET`, `SEO_DASHBOARD_PASSWORD`, `MONGODB_URI` present.
- [ ] Redeployed **after** saving env vars.
- [ ] Logged in, completed the wizard, connected the sources you use.
