import {
  defaultGreeting,
  fillTemplate,
  firstName,
  matchTemplateId,
  SMS_MAX,
  templatesFor,
} from '../greeting-templates';

describe('greeting templates', () => {
  const opts = { name: 'Emma Carter', sender: 'Aneesh' };

  test('firstName takes the first word, falling back to "there"', () => {
    expect(firstName('Emma Carter')).toBe('Emma');
    expect(firstName('  Emma  ')).toBe('Emma');
    expect(firstName('')).toBe('there');
    expect(firstName('   ')).toBe('there');
  });

  test('fillTemplate substitutes {name} and {sender}', () => {
    expect(fillTemplate('Hi {name}, from {sender}', opts)).toBe('Hi Emma, from Aneesh');
    expect(fillTemplate('Hi {name}', { name: 'Emma Carter' })).toBe('Hi Emma');
    expect(fillTemplate('- {sender}', { name: 'X', sender: '' })).toBe('- me');
    expect(fillTemplate('- {sender}', { name: 'X' })).toBe('- me');
  });

  test('every preset round-trips through matchTemplateId', () => {
    for (const channel of ['email', 'sms'] as const) {
      for (const tpl of templatesFor(channel)) {
        const filled = fillTemplate(tpl.text, opts);
        expect(matchTemplateId(filled, channel, opts)).toBe(tpl.id);
      }
    }
  });

  test('edited text matches no preset ("Write your own")', () => {
    const edited = defaultGreeting('email', opts) + ' PS: see you soon!';
    expect(matchTemplateId(edited, 'email', opts)).toBeNull();
    expect(matchTemplateId('', 'sms', opts)).toBeNull();
  });

  // The classic preset must stay byte-identical to the legacy client defaults
  // and the server defaults in backend/src/lib/reminder-content.ts, so people
  // saved before the template picker reopen with "Classic" highlighted.
  test('classic equals the legacy/server default greetings', () => {
    expect(defaultGreeting('email', opts)).toBe(
      'Happy birthday, Emma! Hope you have a wonderful day. 🎉',
    );
    expect(defaultGreeting('sms', opts)).toBe(
      'Happy birthday, Emma! Hope you have a great day. - Aneesh',
    );
  });

  test('filled SMS presets fit one GSM-7 segment even with long names', () => {
    const long = { name: 'Maximilian-Alexandrovich Jr', sender: 'Anastasia Konstantinovna' };
    for (const tpl of templatesFor('sms')) {
      expect(fillTemplate(tpl.text, long).length).toBeLessThanOrEqual(SMS_MAX);
    }
  });
});
