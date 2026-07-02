import { expect, test } from '@playwright/test';

/**
 * E2E happy path (TODO Stage 13): sign up → add a person
 * with a birthday TODAY → see them in the feed → trigger the day-of reminder via
 * the dev endpoint → see it in the Reminders feed → mark it done.
 *
 * Runs against the static web export + the in-memory backend booted by
 * playwright.config.ts. A unique email per run keeps it isolated even when the
 * dev backend is reused locally.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4040';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

test('sign up, add a person, receive and complete a reminder', async ({ page, request }) => {
  const stamp = Date.now();
  const email = `e2e.${stamp}@example.com`;
  const password = 'e2epassword123';

  // The new user is created with the default timezone UTC, and the server
  // resolves "today" in UTC - so compute today's calendar parts in UTC too,
  // otherwise off-UTC machines near the day boundary would add a non-today date.
  const now = new Date();
  const todayMonthName = MONTHS[now.getUTCMonth()];
  const todayDay = String(now.getUTCDate());

  // --- Sign up -------------------------------------------------------------
  await page.goto('/sign-up');
  await page.getByPlaceholder('Your name').fill('E2E Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  // --- Add a person with a birthday today (onboarding removed - land on feed) --
  await page.getByRole('button', { name: 'Add person' }).first().click();
  // The add-person form is the unique signal we've arrived (the modal renders
  // over the feed, so "Add person" text alone is ambiguous).
  await expect(page.getByPlaceholder('Emma Carter')).toBeVisible();

  await page.getByPlaceholder('Emma Carter').fill('Sarah Bennett');
  // Month is a Select: open it, choose this month.
  await page.getByRole('button', { name: 'Month' }).click();
  await page.getByRole('button', { name: todayMonthName, exact: true }).click();
  await page.getByLabel('Day of birth').fill(todayDay);
  await page.getByLabel('Year of birth (optional)').fill('1990');
  await page.getByRole('button', { name: 'Save person' }).click();

  // --- Person appears in the Upcoming feed ---------------------------------
  await expect(page.getByText('Sarah Bennett')).toBeVisible();

  // --- Trigger the day-of reminder on demand (the QA test trigger) ---------
  const res = await request.post(`${API_URL}/dev/reminders/run`, { data: { email } });
  expect(res.ok()).toBeTruthy();
  const summary = await res.json();
  // `forwarded` is scoped to THIS user's email; `sent` is the global dispatch
  // total (could be non-zero from another user when the backend is reused).
  expect(summary.forwarded).toBeGreaterThan(0);

  // --- Reminder shows in the in-app feed with day-of copy ------------------
  await page.goto('/reminders');
  const reminderLine = page.getByText(/It's Sarah Bennett's birthday today/);
  await expect(reminderLine).toBeVisible();

  // --- Mark it done; the Done pill appears and actions disappear -----------
  await page.getByRole('button', { name: 'Mark as done' }).first().click();
  await expect(page.getByText('Done').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark as done' })).toHaveCount(0);
});
