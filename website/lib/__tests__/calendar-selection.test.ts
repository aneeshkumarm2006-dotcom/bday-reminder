import { describe, expect, it } from "vitest";

import { calendarSelectionDiff, hasCalendarChanges } from "../calendar-selection";

/**
 * The catch-up screen's diff. It runs in two situations - straight after joining
 * a list, when everything is already in your calendar, and on a later visit when
 * some of it isn't - so the interesting cases are all about the starting state,
 * not the ticks.
 */
describe('calendarSelectionDiff', () => {
  const people = [
    { id: 'a', inMyCalendar: true },
    { id: 'b', inMyCalendar: true },
    { id: 'c', inMyCalendar: false },
  ];

  it('sends nothing when the selection already matches the server', () => {
    const diff = calendarSelectionDiff(people, new Set(['a', 'b']));
    expect(diff).toEqual({ add: [], remove: [] });
    expect(hasCalendarChanges(diff)).toBe(false);
  });

  it('removes what was unticked and adds what was ticked', () => {
    const diff = calendarSelectionDiff(people, new Set(['a', 'c']));
    expect(diff).toEqual({ add: ['c'], remove: ['b'] });
    expect(hasCalendarChanges(diff)).toBe(true);
  });

  it('handles the two extremes: keep everyone, or nobody', () => {
    expect(calendarSelectionDiff(people, new Set(['a', 'b', 'c']))).toEqual({
      add: ['c'],
      remove: [],
    });
    expect(calendarSelectionDiff(people, new Set())).toEqual({ add: [], remove: ['a', 'b'] });
  });

  it('treats a person with no flag as already in the calendar', () => {
    // Older responses, and the create path, don't carry the field.
    expect(calendarSelectionDiff([{ id: 'x' }], new Set(['x']))).toEqual({ add: [], remove: [] });
    expect(calendarSelectionDiff([{ id: 'x' }], new Set())).toEqual({ add: [], remove: ['x'] });
  });

  it('is empty for an empty list', () => {
    expect(calendarSelectionDiff([], new Set())).toEqual({ add: [], remove: [] });
  });
});
