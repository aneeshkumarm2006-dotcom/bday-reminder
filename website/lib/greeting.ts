import type { ReminderItem } from "@/lib/api";

/**
 * Day-of greeting (FR-28/30). The native app opens the Messages app via an
 * `sms:` URL; the browser has no Messages app, so on web we open WhatsApp's
 * click-to-chat (works on desktop + mobile) with the same editable template,
 * and offer a Copy fallback. The user always reviews and sends it themselves.
 */
export function greetingText(item: ReminderItem): string {
  const firstName = item.person.fullName.trim().split(/\s+/)[0] || item.person.fullName;
  return `Happy birthday, ${firstName}! 🎉`;
}

/** WhatsApp click-to-chat link, or a bare sms: link when there's no phone. */
export function greetingUrl(item: ReminderItem): string {
  const text = encodeURIComponent(greetingText(item));
  const digits = (item.person.phone ?? "").replace(/[^\d]/g, "");
  if (digits) return `https://wa.me/${digits}?text=${text}`;
  return `sms:?body=${text}`;
}
