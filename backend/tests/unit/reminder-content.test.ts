import { describe, expect, it } from 'vitest';

import {
  greetingTemplate,
  ordinalYear,
  reminderHeadline,
  reminderMessage,
} from '../../src/lib/reminder-content';

describe('reminder-content: reminderMessage (birthday)', () => {
  it('with year, days>0 leads with the age being turned', () => {
    expect(
      reminderMessage({ name: 'Michael', eventType: 'birthday', daysRemaining: 3, ageTurning: 29 }),
    ).toBe('Michael turns 29 in 3 days.');
  });

  it('with year, exactly 1 day uses the singular "in 1 day"', () => {
    expect(
      reminderMessage({ name: 'Michael', eventType: 'birthday', daysRemaining: 1, ageTurning: 29 }),
    ).toBe('Michael turns 29 in 1 day.');
  });

  it('day-of with year appends the new age', () => {
    expect(
      reminderMessage({ name: 'Michael', eventType: 'birthday', daysRemaining: 0, ageTurning: 29 }),
    ).toBe("It's Michael's birthday today, turns 29.");
  });

  it('no year, days>0 falls back to the plain birthday line', () => {
    expect(
      reminderMessage({ name: 'Emma', eventType: 'birthday', daysRemaining: 3, ageTurning: null }),
    ).toBe("Emma's birthday is in 3 days.");
  });

  it('day-of with no year omits the age', () => {
    expect(
      reminderMessage({ name: 'Emma', eventType: 'birthday', daysRemaining: 0, ageTurning: null }),
    ).toBe("It's Emma's birthday today.");
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
      reminderMessage({ name: 'Michael', eventType: 'birthday', daysRemaining: -1, ageTurning: 29 }),
    ).toBe("Michael's birthday has passed.");
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
    expect(reminderHeadline({ name: 'Michael', eventType: 'birthday' })).toBe("Michael's birthday");
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

describe('reminder-content: milestone years', () => {
  it('ordinalYear handles the ordinary suffixes', () => {
    expect(ordinalYear(1)).toBe('1st');
    expect(ordinalYear(2)).toBe('2nd');
    expect(ordinalYear(3)).toBe('3rd');
    expect(ordinalYear(25)).toBe('25th');
    expect(ordinalYear(50)).toBe('50th');
  });

  it('ordinalYear gets the teens right, where the last digit lies', () => {
    expect(ordinalYear(11)).toBe('11th');
    expect(ordinalYear(12)).toBe('12th');
    expect(ordinalYear(13)).toBe('13th');
    expect(ordinalYear(111)).toBe('111th');
    expect(ordinalYear(121)).toBe('121st');
  });

  it('names a milestone anniversary with its ordinal', () => {
    expect(
      reminderMessage({
        name: 'Emma',
        eventType: 'anniversary',
        daysRemaining: 7,
        ageTurning: null,
        yearsMarking: 25,
      }),
    ).toBe("Emma's 25th anniversary is in 7 days.");
  });

  it('names it day-of too', () => {
    expect(
      reminderMessage({
        name: 'Emma',
        eventType: 'anniversary',
        daysRemaining: 0,
        ageTurning: null,
        yearsMarking: 50,
      }),
    ).toBe("It's Emma's 50th anniversary today.");
  });

  it('leaves a non-milestone anniversary as the plain line', () => {
    // The count is known — it is simply not a year worth calling out, and §11
    // keeps a running year count off anniversaries generally.
    expect(
      reminderMessage({
        name: 'Emma',
        eventType: 'anniversary',
        daysRemaining: 7,
        ageTurning: null,
        yearsMarking: 24,
      }),
    ).toBe("Emma's anniversary is in 7 days.");
  });

  it('leaves a yearless anniversary alone', () => {
    expect(
      reminderMessage({
        name: 'Emma',
        eventType: 'anniversary',
        daysRemaining: 7,
        ageTurning: null,
        yearsMarking: null,
      }),
    ).toBe("Emma's anniversary is in 7 days.");
  });

  it('names a milestone custom event by its own name', () => {
    expect(
      reminderMessage({
        name: 'Maya',
        eventType: 'custom',
        customName: 'Sobriety day',
        daysRemaining: 1,
        ageTurning: null,
        yearsMarking: 10,
      }),
    ).toBe("Maya's 10th Sobriety day is in 1 day.");
  });

  it('does not touch a birthday line, which already leads with the age', () => {
    expect(
      reminderMessage({
        name: 'Michael',
        eventType: 'birthday',
        daysRemaining: 3,
        ageTurning: 40,
        yearsMarking: 40,
      }),
    ).toBe('Michael turns 40 in 3 days.');
  });

  it('carries the milestone into the push title / email subject', () => {
    expect(
      reminderHeadline({ name: 'Emma', eventType: 'anniversary', yearsMarking: 25 }),
    ).toBe("Emma's 25th anniversary");
    expect(
      reminderHeadline({
        name: 'Maya',
        eventType: 'custom',
        customName: 'Graduation',
        yearsMarking: 10,
      }),
    ).toBe('Maya: 10th Graduation');
  });
});

describe('reminder-content: greetingTemplate', () => {
  it('returns the default editable greeting (FR-29)', () => {
    expect(greetingTemplate('Michael')).toBe('Happy birthday, Michael! 🎉');
  });
});
