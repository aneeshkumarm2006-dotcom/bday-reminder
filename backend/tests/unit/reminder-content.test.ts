import { describe, expect, it } from 'vitest';

import {
  greetingTemplate,
  reminderHeadline,
  reminderMessage,
} from '../../src/lib/reminder-content';

describe('reminder-content: reminderMessage (birthday)', () => {
  it('with year, days>0 leads with the age being turned', () => {
    expect(
      reminderMessage({ name: 'Ravi', eventType: 'birthday', daysRemaining: 3, ageTurning: 29 }),
    ).toBe('Ravi turns 29 in 3 days.');
  });

  it('with year, exactly 1 day uses the singular "in 1 day"', () => {
    expect(
      reminderMessage({ name: 'Ravi', eventType: 'birthday', daysRemaining: 1, ageTurning: 29 }),
    ).toBe('Ravi turns 29 in 1 day.');
  });

  it('day-of with year appends the new age', () => {
    expect(
      reminderMessage({ name: 'Ravi', eventType: 'birthday', daysRemaining: 0, ageTurning: 29 }),
    ).toBe("It's Ravi's birthday today, turns 29.");
  });

  it('no year, days>0 falls back to the plain birthday line', () => {
    expect(
      reminderMessage({ name: 'Priya', eventType: 'birthday', daysRemaining: 3, ageTurning: null }),
    ).toBe("Priya's birthday is in 3 days.");
  });

  it('day-of with no year omits the age', () => {
    expect(
      reminderMessage({ name: 'Priya', eventType: 'birthday', daysRemaining: 0, ageTurning: null }),
    ).toBe("It's Priya's birthday today.");
  });
});

describe('reminder-content: reminderMessage (anniversary)', () => {
  it('never mentions an age, even if one is somehow passed', () => {
    expect(
      reminderMessage({ name: 'Sam', eventType: 'anniversary', daysRemaining: 3, ageTurning: 40 }),
    ).toBe("Sam's anniversary is in 3 days.");
  });
});

describe('reminder-content: reminderMessage (custom)', () => {
  it('uses the customName as the noun mid-sentence', () => {
    expect(
      reminderMessage({
        name: 'Maya',
        eventType: 'custom',
        customName: 'graduation',
        daysRemaining: 5,
        ageTurning: null,
      }),
    ).toBe("Maya's graduation is in 5 days.");
  });

  it('falls back to "event" when customName is blank/whitespace', () => {
    expect(
      reminderMessage({
        name: 'Maya',
        eventType: 'custom',
        customName: '   ',
        daysRemaining: 5,
        ageTurning: null,
      }),
    ).toBe("Maya's event is in 5 days.");
  });
});

describe('reminder-content: reminderMessage (past)', () => {
  it('renders a factual "has passed" line for negative daysRemaining', () => {
    expect(
      reminderMessage({ name: 'Ravi', eventType: 'birthday', daysRemaining: -1, ageTurning: 29 }),
    ).toBe("Ravi's birthday has passed.");
  });

  it('uses the custom noun for a past custom event', () => {
    expect(
      reminderMessage({
        name: 'Maya',
        eventType: 'custom',
        customName: 'graduation',
        daysRemaining: -2,
        ageTurning: null,
      }),
    ).toBe("Maya's graduation has passed.");
  });
});

describe('reminder-content: reminderHeadline', () => {
  it('birthday → "<name>\'s birthday"', () => {
    expect(reminderHeadline({ name: 'Ravi', eventType: 'birthday' })).toBe("Ravi's birthday");
  });

  it('anniversary → "<name>\'s anniversary"', () => {
    expect(reminderHeadline({ name: 'Sam', eventType: 'anniversary' })).toBe("Sam's anniversary");
  });

  it('custom → "<name>: <customName>"', () => {
    expect(
      reminderHeadline({ name: 'Maya', eventType: 'custom', customName: 'Graduation' }),
    ).toBe('Maya: Graduation');
  });

  it('custom with a blank customName → "<name>: Event"', () => {
    expect(
      reminderHeadline({ name: 'Maya', eventType: 'custom', customName: '  ' }),
    ).toBe('Maya: Event');
  });
});

describe('reminder-content: greetingTemplate', () => {
  it('returns the default editable greeting (FR-29)', () => {
    expect(greetingTemplate('Ravi')).toBe('Happy birthday, Ravi! 🎉');
  });
});
