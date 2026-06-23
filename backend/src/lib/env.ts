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

  // --- Reminder delivery [Stage 4] — all optional. When a key is absent the
  // matching channel degrades gracefully (logs + reports "skipped") so the
  // engine runs end-to-end in dev/QA without provisioning the external account.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Birthday Reminder <onboarding@resend.dev>'),
  EXPO_ACCESS_TOKEN: z.string().optional(),

  // --- Photo hosting — Cloudinary [Stage 6] — all optional (FR-10). When the
  // account isn't configured the upload endpoint degrades gracefully (echoes the
  // image back as a data URL) so add-photo works end-to-end in dev/QA without
  // provisioning Cloudinary; a real key swaps in hosted, CDN-served URLs.
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().default('birthday-reminder'),

  // --- SMS / WhatsApp fair-use [Stage 5] — the actual send is stubbed, but the
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
