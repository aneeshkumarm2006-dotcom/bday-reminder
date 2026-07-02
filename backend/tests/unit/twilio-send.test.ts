import { afterEach, describe, expect, it, vi } from 'vitest';

import { sendTwilioSms, twilioConfigured } from '../../src/lib/twilio-send';

/**
 * Stage 15: the Twilio auto-send SMS client. These cover the config gate, the
 * request shape (Basic auth, form-encoded, Messaging Service sender), and that a
 * permanent 4xx fails fast without retrying. Twilio env is injected via
 * vitest.config.ts (a Messaging Service SID, no From number).
 */
describe('twilio-send', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports configured when account, token, and a sender are set', () => {
    expect(twilioConfigured()).toBe(true);
  });

  it('posts a form-encoded message with the Messaging Service sender and returns sent on 201', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 201 }));

    const result = await sendTwilioSms('+15551230001', 'Happy birthday!');
    expect(result.outcome).toBe('sent');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/Messages.json');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Basic /);
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');

    const body = new URLSearchParams((init as RequestInit).body as string);
    expect(body.get('To')).toBe('+15551230001');
    expect(body.get('Body')).toBe('Happy birthday!');
    expect(body.get('MessagingServiceSid')).toBe('MGtest0000000000000000000000000000');
    expect(body.get('From')).toBeNull();
  });

  it('returns failed on a permanent 4xx without retrying', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('invalid To', { status: 400 }));

    const result = await sendTwilioSms('+15551230001', 'hi');
    expect(result.outcome).toBe('failed');
    expect(fetchMock).toHaveBeenCalledTimes(1); // 4xx is permanent - no retry
  });

  it('skips without calling Twilio when there is no recipient', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const result = await sendTwilioSms('', 'hi');
    expect(result.outcome).toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
