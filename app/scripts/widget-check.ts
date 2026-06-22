/**
 * Quick runtime check for the pure widget logic (Stage 10) — the code that
 * drives both native widgets and the in-app preview. Run:
 *   cd backend && npx tsx ../app/scripts/widget-check.ts
 */
import {
  buildWidgetPayload,
  daysUntilOccurrence,
  deepLinkForPerson,
  WIDGET_EVENT_COUNT,
  widgetCountdown,
} from '../src/lib/widget-data';
import type { UpcomingItem } from '../src/lib/api';

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean): void {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function item(over: Partial<UpcomingItem>): UpcomingItem {
  return {
    personId: 'p',
    eventId: 'e',
    fullName: 'Name',
    type: 'human',
    relationshipTag: null,
    photoUrl: null,
    phone: null,
    eventType: 'birthday',
    customName: null,
    occurrenceDate: '2026-06-25T00:00:00.000Z',
    daysRemaining: 3,
    ageTurning: null,
    group: 'This week',
    ...over,
  };
}

// --- buildWidgetPayload: keeps the soonest N, mapped correctly ---------------
const many: UpcomingItem[] = [
  item({ personId: 'a', eventId: 'a', fullName: 'Ada', occurrenceDate: '2026-06-23T00:00:00.000Z' }),
  item({ personId: 'b', eventId: 'b', fullName: 'Bo', type: 'pet', occurrenceDate: '2026-06-24T00:00:00.000Z' }),
  item({
    personId: 'c',
    eventId: 'c',
    fullName: 'Cy',
    eventType: 'anniversary',
    occurrenceDate: '2026-06-25T00:00:00.000Z',
  }),
  item({
    personId: 'd',
    eventId: 'd',
    fullName: 'Di',
    eventType: 'custom',
    customName: 'Gotcha day',
    occurrenceDate: '2026-06-26T00:00:00.000Z',
  }),
];
const payload = buildWidgetPayload(many);
check('keeps only WIDGET_EVENT_COUNT events', payload.events.length === WIDGET_EVENT_COUNT);
check('preserves server order (soonest first)', payload.events[0].name === 'Ada');
check('reads day/month in UTC', payload.events[0].day === 23 && payload.events[0].month === 'Jun');
check('flags a pet', payload.events[1].isPet === true);
check('birthday has no event label', payload.events[0].eventLabel === null);
check('anniversary labelled', payload.events[2].eventLabel === 'Anniversary');

const payloadCustom = buildWidgetPayload([many[3]]);
check('custom event uses its name as the label', payloadCustom.events[0].eventLabel === 'Gotcha day');
check('empty feed → empty events', buildWidgetPayload([]).events.length === 0);
check('stamps an ISO timestamp', !Number.isNaN(Date.parse(payload.updatedAtISO)));

// --- daysUntilOccurrence: live recompute, UTC-pinned, DST-proof --------------
const occ = '2026-06-25T00:00:00.000Z';
check('3 days before → 3', daysUntilOccurrence(occ, new Date('2026-06-22T10:00:00')) === 3);
check('same day (morning local) → 0', daysUntilOccurrence(occ, new Date('2026-06-25T08:00:00')) === 0);
check('same day (late local) → 0', daysUntilOccurrence(occ, new Date('2026-06-25T23:30:00')) === 0);
check('day after → -1', daysUntilOccurrence(occ, new Date('2026-06-26T01:00:00')) === -1);

// --- widgetCountdown copy (DESIGN.md §8.13) ----------------------------------
check('today copy', widgetCountdown(0) === 'Today');
check('past clamps to Today', widgetCountdown(-2) === 'Today');
check('singular day', widgetCountdown(1) === 'in 1 day');
check('plural days', widgetCountdown(9) === 'in 9 days');

// --- deep link (FR-50) -------------------------------------------------------
check('deep link targets the profile', deepLinkForPerson('abc123') === 'circlethedate://person/abc123');

console.log(`\nwidget-check: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
