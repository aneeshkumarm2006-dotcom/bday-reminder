/* eslint-disable no-console */
/**
 * QA seed data (TODO Stage 13: "Seed/test data + a way to trigger a reminder on
 * demand for QA"). Drives the REAL HTTP API of a running backend so it reuses
 * all the create + reminder-generation logic (no duplicated model code): signs
 * up a demo user, adds a spread of people (one with a birthday TODAY so a
 * reminder fires, a pet, an anniversary, and some upcoming), then triggers the
 * dev reminder run so the in-app feed is populated.
 *
 * Point it at any running dev backend:
 *   1) terminal A:  npm run dev:memory      (ephemeral in-memory Mongo on :4040)
 *   2) terminal B:  npm run seed            (defaults to http://localhost:4040)
 * Override with SEED_BASE_URL.
 */

const BASE = process.env.SEED_BASE_URL ?? 'http://localhost:4040';
const DEMO = {
  name: 'Demo Tester',
  email: 'demo@circlethedate.app',
  password: 'demopassword123',
  timezone: 'UTC',
};

// Compute occurrence dates in UTC so they line up with the demo user's UTC
// timezone — otherwise an off-UTC host could seed a "today" birthday that the
// server doesn't treat as today, leaving the feed empty.
const today = new Date();
const offsetDay = (days: number): { month: number; day: number } => {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days));
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};

async function req(path: string, method: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: json };
}

async function main(): Promise<void> {
  // Health check first so the failure is friendly when nothing is running.
  const health = await req('/health', 'GET').catch(() => ({ status: 0, body: null }));
  if (health.status !== 200) {
    throw new Error(`No backend at ${BASE}. Start one with \`npm run dev:memory\` first.`);
  }

  // Sign up (or log in if the demo user already exists).
  let token: string;
  const signup = await req('/auth/signup', 'POST', DEMO);
  if (signup.status === 201) {
    token = signup.body.accessToken;
    console.log(`Created demo user ${DEMO.email}`);
  } else {
    const login = await req('/auth/login', 'POST', { email: DEMO.email, password: DEMO.password });
    if (login.status !== 200) {
      throw new Error(`Could not sign up or log in the demo user (${signup.status}/${login.status}).`);
    }
    token = login.body.accessToken;
    console.log(`Logged in existing demo user ${DEMO.email}`);
  }

  // Only seed people if the account is empty (idempotent re-runs).
  const existing = await req('/people', 'GET', undefined, token);
  const existingCount = Array.isArray(existing.body?.people) ? existing.body.people.length : 0;
  if (existingCount > 0) {
    console.log(`Demo user already has ${existingCount} people — skipping people seed.`);
  } else {
    const people = [
      { fullName: 'Aisha Khan', dob: { ...offsetDay(0), year: 1990 }, relationshipTag: 'Friend', phone: '+15555550100' },
      { fullName: 'Ravi Patel', dob: { ...offsetDay(3), year: 1996 }, relationshipTag: 'Family' },
      { fullName: 'Mochi', dob: offsetDay(0), type: 'pet', relationshipTag: 'Pet' },
      { fullName: 'Priya Sharma', dob: offsetDay(12), relationshipTag: 'Colleague' },
      { fullName: 'Grandma Hopper', dob: { ...offsetDay(40), year: 1948 }, relationshipTag: 'Family' },
    ];
    for (const p of people) {
      const res = await req('/people', 'POST', p, token);
      if (res.status === 201) console.log(`  + ${p.fullName}`);
      else console.warn(`  ! ${p.fullName} → ${res.status} ${JSON.stringify(res.body)}`);
    }

    // Add an anniversary to one person so non-birthday events are represented.
    const list = await req('/people', 'GET', undefined, token);
    const ravi = list.body?.people?.find((x: any) => x.fullName === 'Ravi Patel');
    if (ravi) {
      await req('/events', 'POST', {
        person: ravi.id,
        type: 'anniversary',
        date: offsetDay(5),
      }, token);
      console.log('  + Anniversary for Ravi Patel');
    }
  }

  // Trigger the due reminders so the in-app feed has content immediately.
  const run = await req('/dev/reminders/run', 'POST', { email: DEMO.email }, token);
  console.log(`Triggered reminders/run → ${JSON.stringify(run.body)}`);

  console.log('\n✅ Seed complete.');
  console.log(`   Log in as:  ${DEMO.email} / ${DEMO.password}`);
  console.log(`   Backend:    ${BASE}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n❌ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
