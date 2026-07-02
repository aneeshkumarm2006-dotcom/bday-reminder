/**
 * Auto-send birthday email rendering (Stage 14+). The user still writes/picks a
 * plain-text greeting (the message stored on the person); at send time we wrap it
 * in a designed, email-client-safe HTML "card" so the friend receives something
 * that looks handmade, not a raw line of text. A plain-text alternative is kept
 * for clients that don't render HTML (multipart/alternative in gmail-send.ts).
 *
 * Every mail carries a small "Sent with Circle the date" footer at the very end
 * so the recipient knows how it was sent - present in both the HTML and text
 * parts. The message content itself stays exactly what the user typed.
 *
 * HTML is built for the lowest common denominator of email clients: table layout,
 * inline styles only, no external CSS/fonts/images, web-safe font stack, and a
 * solid `bgcolor` fallback behind the header gradient (Outlook ignores gradients
 * and border-radius, so it degrades to a clean solid band).
 */

/** Marketing site shown in the footer. Kept stable here so the link is correct in
 * every deploy regardless of CORS/origin env (WEBSITE_ORIGIN is a localhost default). */
const SITE_NAME = 'Circle the date';
const SITE_URL = 'https://circlethedate.app';

// Brand palette (mirrors channels/email.ts + the marketing site tokens).
const INK = '#232020';
const MUTED = '#8B847C';
const CREAM = '#FBF8F4';
const HAIRLINE = '#EFE9E1';
const LINK = '#3A53D6';
// Festive header gradient with a solid fallback for gradient-less clients.
const HEADER_SOLID = '#6D5EF6';
const HEADER_GRADIENT = 'linear-gradient(135deg, #5B6EF5 0%, #8B5CF6 55%, #EC4899 100%)';

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escape, then turn the user's line breaks into <br> so the card keeps their layout. */
function messageToHtml(message: string): string {
  return escapeHtml(message.trim()).replace(/\r?\n/g, '<br />');
}

/** One-line inbox preview text pulled from the message (no markup, capped). */
function preheader(message: string): string {
  const flat = message.trim().replace(/\s+/g, ' ');
  return flat.length > 110 ? `${flat.slice(0, 107)}…` : flat;
}

/** The plain-text alternative: the greeting exactly as written, then the footer. */
export function birthdayEmailText(message: string): string {
  return `${message.trim()}\n\n— — —\nSent with ${SITE_NAME} · ${SITE_URL}`;
}

/**
 * Render the full HTML birthday card around the user's greeting `message`.
 * Self-contained document (some clients strip <style>, so everything is inline).
 */
export function renderBirthdayEmailHtml(message: string): string {
  const body = messageToHtml(message);
  const preview = escapeHtml(preheader(message));

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "https://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="https://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<title>Happy Birthday</title>
</head>
<body style="margin:0; padding:0; width:100%; background-color:${CREAM};">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; height:0; width:0;">${preview}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CREAM}" style="background-color:${CREAM};">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" width="512" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:512px; background-color:#FFFFFF; border-radius:20px; overflow:hidden; box-shadow:0 8px 30px rgba(35,32,32,0.08);">
<!-- Header band -->
<tr>
<td align="center" bgcolor="${HEADER_SOLID}" style="background-color:${HEADER_SOLID}; background-image:${HEADER_GRADIENT}; padding:44px 24px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" width="76" height="76" valign="middle" bgcolor="#FFFFFF" style="width:76px; height:76px; background-color:#FFFFFF; border-radius:50%; font-size:38px; line-height:76px; text-align:center;">🎂</td>
</tr>
</table>
<div style="margin:20px 0 0; font-family:${FONT_STACK}; font-size:22px; font-weight:700; letter-spacing:0.2px; color:#FFFFFF;">Happy Birthday!</div>
<div style="margin:8px 0 0; font-size:20px; letter-spacing:6px; line-height:1;">🎉&nbsp;🎈&nbsp;🎁</div>
</td>
</tr>
<!-- Greeting message -->
<tr>
<td align="center" style="padding:36px 36px 8px; font-family:${FONT_STACK}; font-size:18px; line-height:1.65; color:${INK};">
${body}
</td>
</tr>
<!-- Footer -->
<tr>
<td style="padding:28px 36px 34px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="border-top:1px solid ${HAIRLINE}; font-size:0; line-height:0;">&nbsp;</td></tr>
</table>
<p style="margin:18px 0 0; font-family:${FONT_STACK}; font-size:13px; line-height:1.5; color:${MUTED}; text-align:center;">
Sent with <a href="${SITE_URL}" style="color:${LINK}; text-decoration:none; font-weight:600;">${SITE_NAME}</a><br />
<span style="color:${MUTED};">the app that remembers the dates that matter.</span>
</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}
