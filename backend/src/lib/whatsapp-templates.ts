import { loadEnv } from './env';
import { logger } from './logger';
import { firstName } from './reminder-content';

/**
 * WhatsApp approved-template registry for auto-send birthday greetings (Stage 15).
 *
 * A business-initiated WhatsApp message (one sent outside an open 24-hour customer
 * session — which every birthday greeting is) can ONLY be an approved template, not
 * free-form text. So each greeting preset has a Meta-approved WhatsApp template
 * whose body mirrors the preset, with the recipient's first name and the sender's
 * name as the two variables `{{1}}` / `{{2}}`.
 *
 * `TEMPLATE_BODIES` is the source of truth the registration script submits to Meta
 * (see `scripts/register-whatsapp-templates.ts`) and must stay in sync with the SMS
 * presets in `app/src/lib/greeting-templates.ts` + `website/lib/greeting-templates.ts`
 * (the `{name}`→`{{1}}`, `{sender}`→`{{2}}` conversion) so the popup preview matches
 * what actually gets delivered. Once approved, the operator sets the resulting
 * Content SIDs in `TWILIO_WHATSAPP_TEMPLATES` (preset id → HX… SID) and the dispatch
 * resolves the person's chosen preset to its SID at send time.
 */

export const WHATSAPP_TEMPLATE_IDS = ['classic', 'heartfelt', 'funny', 'short', 'formal'] as const;
export type WhatsappTemplateId = (typeof WHATSAPP_TEMPLATE_IDS)[number];

/** Canonical WhatsApp template bodies (mirror the SMS presets; `{{1}}`=recipient
 * first name, `{{2}}`=sender name). Submitted for Meta approval as-is. */
export const WHATSAPP_TEMPLATE_BODIES: Record<WhatsappTemplateId, string> = {
  classic: 'Happy birthday, {{1}}! Hope you have a great day. - {{2}}',
  heartfelt:
    'Happy birthday, {{1}}! So glad to have you in my life. Wishing you your best year yet. - {{2}}',
  funny: 'Happy birthday, {{1}}! Another year wiser... allegedly. Have a great one! - {{2}}',
  short: 'Happy birthday, {{1}}! - {{2}}',
  formal: 'Dear {{1}}, wishing you a wonderful birthday and a great year ahead. - {{2}}',
};

export function isWhatsappTemplateId(value: string): value is WhatsappTemplateId {
  return (WHATSAPP_TEMPLATE_IDS as readonly string[]).includes(value);
}

/**
 * Parsed `TWILIO_WHATSAPP_TEMPLATES` (preset id → Content SID). Cached per raw
 * value. A malformed JSON blob logs once and degrades to "no templates" (the
 * dispatch then falls back to free-form bodies) rather than crashing the process.
 */
let cachedRaw: string | undefined;
let cachedMap: Record<string, string> = {};

function templateMap(): Record<string, string> {
  const raw = loadEnv().TWILIO_WHATSAPP_TEMPLATES;
  if (raw === cachedRaw) return cachedMap;
  cachedRaw = raw;
  cachedMap = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [id, sid] of Object.entries(parsed as Record<string, unknown>)) {
          if (isWhatsappTemplateId(id) && typeof sid === 'string' && sid.trim()) {
            cachedMap[id] = sid.trim();
          }
        }
      } else {
        logger.warn('TWILIO_WHATSAPP_TEMPLATES is not a JSON object; ignoring');
      }
    } catch {
      logger.warn('TWILIO_WHATSAPP_TEMPLATES is not valid JSON; ignoring');
    }
  }
  return cachedMap;
}

/** The approved Content SID for a preset, or undefined when none is configured. */
export function whatsappTemplateSidFor(templateId: string | null | undefined): string | undefined {
  if (!templateId || !isWhatsappTemplateId(templateId)) return undefined;
  return templateMap()[templateId];
}

/** True when at least one preset has an approved Content SID configured. */
export function whatsappTemplatesConfigured(): boolean {
  return Object.keys(templateMap()).length > 0;
}

/** The `{{1}}`/`{{2}}` values for a birthday template: recipient first name + sender. */
export function birthdayWhatsappVariables(
  recipientName: string,
  senderName: string,
): Record<string, string> {
  return { '1': firstName(recipientName), '2': senderName };
}
