import { Cake, Heart, Star } from 'lucide-react-native';

import type { CalendarEvent } from '@/lib/api';
import { eventTypeMeta, EVENT_TYPE_LEGEND } from '@/lib/event-style';

/**
 * Event-type metadata - the single source for how each event reads on the
 * calendar (label, icon, dot color). The calendar grid, legend and agenda all
 * lean on this, so the mapping is pinned here.
 */
function meta(overrides: Partial<Pick<CalendarEvent, 'eventType' | 'customName'>>) {
  return eventTypeMeta({ eventType: 'birthday', customName: null, ...overrides });
}

describe('eventTypeMeta', () => {
  it('labels a birthday with the cake icon and birthday dot', () => {
    const m = meta({ eventType: 'birthday' });
    expect(m.label).toBe('Birthday');
    expect(m.Icon).toBe(Cake);
    expect(m.dotClass).toBe('bg-cal-birthday');
    expect(m.tokenKey).toBe('calBirthday');
  });

  it('labels an anniversary with the heart icon and anniversary dot', () => {
    const m = meta({ eventType: 'anniversary' });
    expect(m.label).toBe('Anniversary');
    expect(m.Icon).toBe(Heart);
    expect(m.dotClass).toBe('bg-cal-anniversary');
  });

  it('uses the custom name for a custom event, with the star icon', () => {
    const m = meta({ eventType: 'custom', customName: 'Graduation' });
    expect(m.label).toBe('Graduation');
    expect(m.Icon).toBe(Star);
    expect(m.dotClass).toBe('bg-cal-custom');
  });

  it('falls back to "Event" when a custom event has no name', () => {
    expect(meta({ eventType: 'custom', customName: null }).label).toBe('Event');
  });
});

describe('EVENT_TYPE_LEGEND', () => {
  it('lists the three types in order with fixed labels', () => {
    expect(EVENT_TYPE_LEGEND.map((i) => i.type)).toEqual(['birthday', 'anniversary', 'custom']);
    expect(EVENT_TYPE_LEGEND.map((i) => i.label)).toEqual(['Birthday', 'Anniversary', 'Event']);
  });
});
