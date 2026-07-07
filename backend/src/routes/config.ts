import { Router } from 'express';

import {
  gmailOAuthConfigured,
  googleImportConfigured,
  googleLoginConfigured,
} from '../lib/google-oauth';
import { smsMonthlyCap } from '../lib/sms-usage';
import { twilioConfigured } from '../lib/twilio-send';

/**
 * Public app config (TODO Stage 5; FR-56). Exposes business-configurable values
 * the client must show but should never hardcode - the SMS/WhatsApp monthly
 * fair-use cap and whether Gmail / SMS auto-send are provisioned on this server
 * (so the app/website hide those features when they aren't). No secrets here, so
 * no auth required.
 */

export const configRouter = Router();

configRouter.get('/', (_req, res) => {
  res.json({
    smsWhatsappMonthlyCap: smsMonthlyCap(),
    gmailAutoSendAvailable: gmailOAuthConfigured(),
    smsAutoSendAvailable: twilioConfigured(),
    // Whether "Sign in with Google" is provisioned (so the login page can hide
    // the button when it isn't).
    googleAuthAvailable: googleLoginConfigured(),
    // Whether Google Calendar + Contacts bulk import is provisioned (Stage 16), so
    // the app/website hide the "Import from Google" option when it isn't.
    googleImportAvailable: googleImportConfigured(),
  });
});
