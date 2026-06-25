import { Router } from 'express';

import { smsMonthlyCap } from '../lib/sms-usage';

/**
 * Public app config (TODO Stage 5; FR-56). Exposes business-configurable values
 * the client must show but should never hardcode - currently the SMS/WhatsApp
 * monthly fair-use cap, read into the settings screen's cap note. No secrets
 * here, so no auth required.
 */

export const configRouter = Router();

configRouter.get('/', (_req, res) => {
  res.json({ smsWhatsappMonthlyCap: smsMonthlyCap() });
});
