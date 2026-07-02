import cron from 'node-cron';

import { loadEnv } from '../lib/env';
import { logger } from '../lib/logger';
import {
  dispatchBirthdayGreetings,
  dispatchBirthdaySms,
  dispatchDue,
  generateForAllUsers,
} from './reminder-engine';

/**
 * Scheduled jobs (TODO Stage 4; FR-22/51-53). The ⭐ dispatcher runs frequently
 * (default every 15 min) and fires reminders that are due now in each
 * recipient's local timezone; a lighter "ensure" pass generates/rotates
 * instances a few times a day so new events and next-year occurrences get
 * scheduled even without an explicit edit. Both are idempotent.
 *
 * Kicked off from `server.ts` after the DB connects. Tests/smoke import the
 * engine directly with an injected clock and never start the scheduler.
 */

let started = false;

export function startReminderJobs(): void {
  if (started) return;
  const env = loadEnv();
  if (!env.REMINDER_JOBS_ENABLED) {
    logger.info('reminder jobs disabled (REMINDER_JOBS_ENABLED=false)');
    return;
  }
  started = true;

  cron.schedule(env.REMINDER_DISPATCH_CRON, () => void tickDispatch());
  // Ensure/rotate at five past, every six hours.
  cron.schedule('5 */6 * * *', () => void tickEnsure());

  logger.info(`reminder jobs scheduled (dispatch '${env.REMINDER_DISPATCH_CRON}', ensure every 6h)`);

  // Run once on boot so a fresh process doesn't wait for the first tick.
  void tickEnsure().then(tickDispatch);
}

async function tickDispatch(): Promise<void> {
  try {
    const summary = await dispatchDue(new Date());
    if (summary.sent > 0 || summary.promoted > 0) {
      logger.info(`dispatch: promoted ${summary.promoted}, sent ${summary.sent}`);
    }
  } catch (err) {
    logger.error('dispatch tick failed', err instanceof Error ? err.message : err);
  }
  // Auto-send birthday greetings (Stage 14) - independent of the reminder feed,
  // best-effort, and never allowed to break the reminder dispatch above.
  try {
    await dispatchBirthdayGreetings(new Date());
  } catch (err) {
    logger.error('greeting tick failed', err instanceof Error ? err.message : err);
  }
  // Auto-send birthday SMS (Stage 15) - likewise independent and best-effort, in
  // its own guard so a Twilio failure never breaks reminders or email greetings.
  try {
    await dispatchBirthdaySms(new Date());
  } catch (err) {
    logger.error('sms greeting tick failed', err instanceof Error ? err.message : err);
  }
}

async function tickEnsure(): Promise<void> {
  try {
    const created = await generateForAllUsers(new Date());
    if (created > 0) logger.info(`ensure: generated ${created} reminder(s)`);
  } catch (err) {
    logger.error('ensure tick failed', err instanceof Error ? err.message : err);
  }
}
