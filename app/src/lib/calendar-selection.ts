/**
 * Turning a set of ticked rows into a calendar update.
 *
 * The catch-up screen is used twice over: once right after joining a list, when
 * everything is already in your calendar, and again later from the list itself,
 * when some of it isn't. Diffing the selection against what the server says is
 * currently in your calendar makes one component correct in both cases, and
 * keeps the request to only what actually changed.
 */

export interface CalendarSelectable {
  id: string;
  /** The server's current answer. Treated as "in" when the field is absent. */
  inMyCalendar?: boolean;
}

export interface CalendarSelectionDiff {
  add: string[];
  remove: string[];
}

export function calendarSelectionDiff(
  people: CalendarSelectable[],
  selected: ReadonlySet<string>,
): CalendarSelectionDiff {
  const add: string[] = [];
  const remove: string[] = [];
  for (const person of people) {
    const isIn = person.inMyCalendar !== false;
    const wantIn = selected.has(person.id);
    if (wantIn && !isIn) add.push(person.id);
    else if (!wantIn && isIn) remove.push(person.id);
  }
  return { add, remove };
}

/** Whether a diff would change anything - lets the caller skip the request. */
export function hasCalendarChanges(diff: CalendarSelectionDiff): boolean {
  return diff.add.length > 0 || diff.remove.length > 0;
}
