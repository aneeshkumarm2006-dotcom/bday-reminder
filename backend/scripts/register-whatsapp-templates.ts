/* eslint-disable no-console */
/**
 * Register the auto-send birthday WhatsApp templates with Twilio + submit them for
 * Meta approval (Stage 15). Business-initiated WhatsApp messages can only be an
 * approved template, so before the WhatsApp rail delivers in production each greeting
 * preset needs a template created via Twilio's Content API and approved by Meta.
 *
 * What it does, per preset in `WHATSAPP_TEMPLATE_BODIES`:
 *   1. Creates a `twilio/text` Content resource (body with {{1}}/{{2}} variables).
 *   2. Submits it for WhatsApp approval (category MARKETING).
 * Then prints a ready-to-paste `TWILIO_WHATSAPP_TEMPLATES` JSON (preset id → HX SID).
 * Approval is asynchronous — check status in the Twilio Console (Content Template
 * Builder) or via the Content API before relying on it. Until a preset is approved
 * AND its SID is in the env, the dispatch falls back to a free-form body for it
 * (sandbox/session only).
 *
 * Usage:
 *   npm run register:whatsapp-templates            # create + submit for approval
 *   npm run register:whatsapp-templates -- --dry-run   # just print the bodies
 *
 * Requires TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN in the environment.
 */
import 'dotenv/config';

import {
  WHATSAPP_TEMPLATE_BODIES,
  WHATSAPP_TEMPLATE_IDS,
  type WhatsappTemplateId,
} from '../src/lib/whatsapp-templates';

const CONTENT_URL = 'https://content.twilio.com/v1/Content';
const dryRun = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  console.log('Auto-send birthday WhatsApp templates\n');

  if (dryRun) {
    console.log('DRY RUN — templates that WOULD be submitted (variables {{1}}=name, {{2}}=sender):\n');
    for (const id of WHATSAPP_TEMPLATE_IDS) {
      console.log(`  ${id.padEnd(10)} ${WHATSAPP_TEMPLATE_BODIES[id]}`);
    }
    console.log('\nRe-run without --dry-run to create them in Twilio.');
    return;
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.error(
      'Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN. Set them (e.g. in backend/.env) and retry,\n' +
        'or run with --dry-run to preview the template bodies.',
    );
    process.exitCode = 1;
    return;
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Basic ${auth}`,
  };

  const result: Partial<Record<WhatsappTemplateId, string>> = {};

  for (const id of WHATSAPP_TEMPLATE_IDS) {
    const body = WHATSAPP_TEMPLATE_BODIES[id];
    const friendlyName = `birthday_${id}`;
    try {
      // 1) Create the Content resource. `variables` are sample values Twilio shows
      //    in previews; they don't constrain what we send at runtime.
      const createRes = await fetch(CONTENT_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          friendly_name: friendlyName,
          language: 'en',
          variables: { '1': 'Emma', '2': 'Alex' },
          types: { 'twilio/text': { body } },
        }),
      });
      if (!createRes.ok) {
        console.error(`  ${id}: create failed (${createRes.status}) ${await createRes.text()}`);
        continue;
      }
      const created = (await createRes.json()) as { sid?: string };
      const contentSid = created.sid;
      if (!contentSid) {
        console.error(`  ${id}: create returned no SID`);
        continue;
      }

      // 2) Submit for WhatsApp approval (birthday greeting → MARKETING category).
      const approveRes = await fetch(`${CONTENT_URL}/${contentSid}/ApprovalRequests/whatsapp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: friendlyName, category: 'MARKETING' }),
      });
      if (!approveRes.ok) {
        console.error(
          `  ${id}: ${contentSid} created, but approval submit failed (${approveRes.status}) ${await approveRes.text()}`,
        );
      } else {
        console.log(`  ${id}: ${contentSid} created + submitted for approval`);
      }
      result[id] = contentSid;
    } catch (err) {
      console.error(`  ${id}: error ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const configured = Object.keys(result).length;
  if (configured > 0) {
    console.log(`\nSet this in your backend environment (${configured}/${WHATSAPP_TEMPLATE_IDS.length}):\n`);
    console.log(`TWILIO_WHATSAPP_TEMPLATES=${JSON.stringify(result)}`);
    console.log(
      '\nApproval is asynchronous — a preset only delivers as a template once Meta approves it.\n' +
        'Check status in the Twilio Console (Content Template Builder).',
    );
  } else {
    console.error('\nNo templates were created. See the errors above.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
