import { z } from 'zod';

/**
 * Validated environment (TODO Stage 1). Parsed once and cached. Keys mirror
 * `backend/.env.example`. Throws a readable error on missing/invalid config so
 * the server fails fast at boot rather than deep inside a request.
 */

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4040),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // Comma-separated DNS server IPs (e.g. `1.1.1.1,8.8.8.8`). Optional escape
  // hatch: on some Windows setups Node's resolver (c-ares) can't enumerate the
  // system DNS servers and falls back to 127.0.0.1, which breaks the SRV/TXT
  // lookups that `mongodb+srv://` requires (querySrv ECONNREFUSED) even though
  // the OS resolves DNS fine. Setting this points Node at a working resolver.
  DNS_SERVERS: z.string().optional(),

  // Comma-separated origins are split in app.ts.
  APP_ORIGIN: z.string().default('http://localhost:8081'),
  WEBSITE_ORIGIN: z.string().default('http://localhost:3000'),

  // The backend's own publicly-reachable base URL. Used to build the calendar
  // subscribe link (`<API_PUBLIC_URL>/calendar/<token>.ics`) the app shows in
  // Stage 9; set it to the deployed API origin in production.
  API_PUBLIC_URL: z.string().default('http://localhost:4040'),

  // HS256 keys should carry >=256 bits of entropy; require >=32 chars and
  // generate with `openssl rand -base64 48` (see .env.example).
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 random characters (openssl rand -base64 48)'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 random characters (openssl rand -base64 48)'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // --- Reminder delivery [Stage 4] - all optional. When a key is absent the
  // matching channel degrades gracefully (logs + reports "skipped") so the
  // engine runs end-to-end in dev/QA without provisioning the external account.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Birthday Reminder <onboarding@resend.dev>'),
  EXPO_ACCESS_TOKEN: z.string().optional(),

  // --- Gmail auto-send greeting (send a birthday email AS the user, via their
  // own Gmail / OAuth `gmail.send`) - all optional. When any of the three are
  // absent the feature degrades gracefully: the connect endpoint reports "not
  // configured" and the greeting dispatch skips, so the app runs end-to-end in
  // dev/QA without provisioning the Google project.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Where Google redirects after consent; defaults to `<API_PUBLIC_URL>/integrations/gmail/callback`
  // (computed in lib/google-oauth.ts) so it stays in step with the deployed API.
  GOOGLE_OAUTH_REDIRECT_URL: z.string().optional(),
  // Redirect URI for "Sign in with Google" (identity login); defaults to
  // `<API_PUBLIC_URL>/auth/google/callback`. This is a SEPARATE URI from the
  // Gmail one above - both must be registered on the Google OAuth client. Reuses
  // the same GOOGLE_CLIENT_ID/SECRET; login needs no token encryption key.
  GOOGLE_LOGIN_REDIRECT_URL: z.string().optional(),
  // Redirect URI for the Google Calendar + Contacts bulk import (Stage 16);
  // defaults to `<API_PUBLIC_URL>/integrations/google-import/callback`. A THIRD
  // distinct URI (alongside the Gmail + login ones), all registered on the same
  // Google OAuth client. Reuses GOOGLE_CLIENT_ID/SECRET + GMAIL_TOKEN_ENC_KEY (the
  // import refresh token is stored encrypted for re-sync).
  GOOGLE_IMPORT_REDIRECT_URL: z.string().optional(),
  // Encrypts the stored Gmail + Google-import refresh tokens at rest (AES-256-GCM).
  // Generate with `openssl rand -base64 32` → decodes to exactly 32 bytes.
  GMAIL_TOKEN_ENC_KEY: z.string().optional(),

  // --- Twilio auto-send SMS greeting (text a birthday message to a friend AS the
  // user, from one shared Twilio account) [Stage 15] - all optional. When the
  // account isn't configured the feature is hidden (GET /config) and the dispatch
  // skips, so the app runs end-to-end in dev/QA without provisioning Twilio.
  // A sender is required: prefer TWILIO_MESSAGING_SERVICE_SID, else TWILIO_FROM_NUMBER.
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  // WhatsApp sender for auto-send birthday greetings on the WhatsApp channel. The
  // account SID + auth token above are shared; this is the WhatsApp-enabled sender
  // (a bare E.164 number - the `whatsapp:` prefix is added at send time - or a
  // Messaging Service SID). Separately optional so a server can provision SMS,
  // WhatsApp, both, or neither; when unset the WhatsApp channel is hidden
  // (GET /config `whatsappAutoSendAvailable`) and the dispatch skips it.
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  TWILIO_WHATSAPP_MESSAGING_SERVICE_SID: z.string().optional(),
  // Meta-approved WhatsApp templates for auto-send birthday greetings, one per
  // preset. A JSON object mapping preset id → Twilio Content SID, e.g.
  // {"classic":"HX…","heartfelt":"HX…"}. Business-initiated WhatsApp can only send
  // approved templates; a preset with a SID here sends as that template (else the
  // dispatch falls back to a free-form body, which only delivers in the sandbox or
  // an open 24h session). Generate with `npm run register:whatsapp-templates`.
  TWILIO_WHATSAPP_TEMPLATES: z.string().optional(),
  // Account-wide monthly budget cap for auto-send SMS; 0 = unlimited. At the cap,
  // further auto-texts skip until the next UTC month. Surfaced on /seoteam.
  TWILIO_MONTHLY_CAP: z.coerce.number().int().min(0).default(0),

  // --- Photo hosting - Cloudinary [Stage 6] - all optional (FR-10). When the
  // account isn't configured the upload endpoint degrades gracefully (echoes the
  // image back as a data URL) so add-photo works end-to-end in dev/QA without
  // provisioning Cloudinary; a real key swaps in hosted, CDN-served URLs.
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().default('birthday-reminder'),

  // --- SMS / WhatsApp fair-use [Stage 5] - the actual send is stubbed, but the
  // per-user monthly cap is real and business-configurable (FR-55/56). Read from
  // here, never hardcoded into UI copy; the app fetches it from GET /config.
  SMS_WHATSAPP_MONTHLY_CAP: z.coerce.number().int().min(0).default(20),

  // --- Rate limiting [Stage 12]. A strict limiter guards the credential
  // endpoints (brute-force / enumeration) and a lenient one caps overall flood.
  // Left unset, limiting is ON everywhere except NODE_ENV=test (so smokes aren't
  // throttled); set RATE_LIMIT_ENABLED=true to exercise it in a test.
  RATE_LIMIT_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v == null ? undefined : v === 'true')),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(15 * 60 * 1000),
  GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  GLOBAL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60 * 1000),
  // Number of trusted proxy hops in front of the app (Express `trust proxy`), so
  // req.ip is the real client for rate-limit keying. MUST match the deploy
  // topology: 0 = direct, 1 = one proxy (Render/Railway/Fly default). Defaults to
  // 1 in production, 0 elsewhere. Set wrong and the limiter either lumps everyone
  // under the proxy IP (0 too low) or trusts a spoofable XFF (too high).
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).optional(),

  // node-cron dispatch cadence (FR-22). Every 15 min by default.
  REMINDER_DISPATCH_CRON: z.string().default('*/15 * * * *'),
  // Set to 'false' to skip starting the in-process scheduler (e.g. when a host
  // scheduler drives dispatch instead). Defaults on.
  REMINDER_JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
