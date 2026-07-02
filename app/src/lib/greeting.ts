import { Platform } from 'react-native';

import type { ReminderItem } from '@/lib/api';

/**
 * Day-of greeting (FR-28/30), matching the website's template exactly. On the
 * web build the primary action opens WhatsApp click-to-chat (`greetingUrl` -
 * a browser has no Messages composer, same workaround as the website); on
 * native it opens the Messages composer directly (`smsGreetingUrl`). A Copy
 * action covers "send it somewhere else". The user always reviews and sends
 * it themselves.
 */
export function greetingText(item: ReminderItem): string {
  const firstName = item.person.fullName.trim().split(/\s+/)[0] || item.person.fullName;
  return `Happy birthday, ${firstName}! 🎉`;
}

/**
 * WhatsApp click-to-chat link (web build), or the Messages composer when
 * there's no phone. Don't open this on native: an https link always resolves
 * to *some* handler (the browser), so non-WhatsApp users would land on a
 * wa.me install page instead of their Messages app.
 */
export function greetingUrl(item: ReminderItem): string {
  const digits = (item.person.phone ?? '').replace(/[^\d]/g, '');
  if (digits) return `https://wa.me/${digits}?text=${encodeURIComponent(greetingText(item))}`;
  return smsGreetingUrl(item);
}

/** Native Messages composer with the same prefilled template. */
export function smsGreetingUrl(item: ReminderItem): string {
  // iOS uses `&` before the body param; Android uses `?`.
  const separator = Platform.OS === 'ios' ? '&' : '?';
  return `sms:${item.person.phone ?? ''}${separator}body=${encodeURIComponent(greetingText(item))}`;
}
