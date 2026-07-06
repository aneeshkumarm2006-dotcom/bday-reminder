// Opt this whole file out of the React Compiler. The app enables it
// (app.json → experiments.reactCompiler), which rewrites components to call
// `useMemoCache`. But react-native-android-widget's `buildWidgetTree` invokes
// these components as plain functions *outside* React's renderer, so a compiled
// component crashes with "Cannot read properties of null (reading
// 'useMemoCache')". That crash makes every widget render fail, leaving the
// home-screen widget an invisible/transparent bitmap (its click regions, cached
// in the RemoteViews, still fire - hence tapping it opens the app). The library
// itself documents this exact fix. Must stay at the very top of the file.
'use no memo';

import {
  FlexWidget,
  OverlapWidget,
  SvgWidget,
  TextWidget,
  type WidgetRepresentation,
} from 'react-native-android-widget';

import {
  daysUntilOccurrence,
  deepLinkForPerson,
  RING_PATH,
  widgetCountdown,
  type WidgetEvent,
  type WidgetPayload,
} from '@/lib/widget-data';
import { darkTokens, lightTokens, type Tokens } from '@/theme/tokens';

/**
 * Android home-screen widget UI (TODO Stage 10; FR-48/50, DESIGN.md §8.13).
 * Built with react-native-android-widget primitives (rendered to RemoteViews),
 * so it can't share the RN/NativeWind components - it re-implements the look
 * from the same tokens: `DateRing sm` + name + "in Nd", `radius-xl`, surface
 * over paper. The real §7.4 ring path renders via `SvgWidget`, tilted -4°.
 *
 * Days-remaining is recomputed here from each event's absolute date, so a
 * background refresh keeps the countdown current as days pass (FR-49). Each row
 * deep-links into that person's profile via `OPEN_URI` (FR-50); the rest of the
 * widget opens the app.
 */

const RING_BOX = 44;

/** The wobbly ring as a standalone SVG - outline (upcoming) or filled (today). */
function ringSvg(color: string, filled: boolean): string {
  const fill = filled ? `<path d="${RING_PATH}" fill="${color}" />` : '';
  return (
    `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">` +
    fill +
    `<path d="${RING_PATH}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" />` +
    `</svg>`
  );
}

function Ring({ day, month, filled, t }: { day: number; month: string; filled: boolean; t: Tokens }) {
  const numColor = filled ? t.paper : t.ink;
  const monthColor = filled ? t.paper : t.inkMuted;
  return (
    <OverlapWidget style={{ width: RING_BOX, height: RING_BOX }}>
      <SvgWidget
        svg={ringSvg(t.biro, filled)}
        style={{ width: RING_BOX, height: RING_BOX, rotation: -4 }}
      />
      <FlexWidget
        style={{
          width: RING_BOX,
          height: RING_BOX,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <TextWidget
          text={String(day)}
          style={{ fontSize: 15, fontWeight: '600', color: numColor as `#${string}` }}
        />
        <TextWidget
          text={month}
          style={{ fontSize: 8, color: monthColor as `#${string}` }}
        />
      </FlexWidget>
    </OverlapWidget>
  );
}

function EventRow({ event, now, t }: { event: WidgetEvent; now: Date; t: Tokens }) {
  const days = daysUntilOccurrence(event.occurrenceISO, now);
  const subtitle = event.eventLabel ?? (event.isPet ? 'Pet' : null);
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: deepLinkForPerson(event.personId) }}
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
      }}>
      <Ring day={event.day} month={event.month} filled={days <= 0} t={t} />
      <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 10 }}>
        <TextWidget
          text={`${event.isPet ? '🐾 ' : ''}${event.name}`}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 14, fontWeight: '600', color: t.ink as `#${string}` }}
        />
        {subtitle ? (
          <TextWidget
            text={subtitle}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 11, color: t.inkMuted as `#${string}` }}
          />
        ) : null}
      </FlexWidget>
      <TextWidget
        text={widgetCountdown(days)}
        style={{ fontSize: 12, fontWeight: '500', color: t.biro as `#${string}`, marginLeft: 8 }}
      />
    </FlexWidget>
  );
}

function BirthdaysWidget({
  payload,
  now,
  theme,
}: {
  payload: WidgetPayload;
  now: Date;
  theme: 'light' | 'dark';
}) {
  const t = theme === 'dark' ? darkTokens : lightTokens;
  const events = payload.events;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: t.surface as `#${string}`,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: t.borderSubtle as `#${string}`,
        padding: 14,
        flexDirection: 'column',
      }}>
      <TextWidget
        text="Upcoming"
        style={{ fontSize: 12, fontWeight: '600', color: t.inkMuted as `#${string}`, marginBottom: 6 }}
      />
      {events.length === 0 ? (
        <TextWidget
          text="No birthdays yet."
          style={{ fontSize: 13, color: t.inkSecondary as `#${string}`, marginTop: 6 }}
        />
      ) : (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
          {events.map((event) => (
            <EventRow key={event.eventId} event={event} now={now} t={t} />
          ))}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

/**
 * Build the light + dark renditions the OS picks between (WidgetRepresentation).
 * `now` is captured once per render so every row computes against the same day.
 */
export function renderBirthdaysWidget(
  payload: WidgetPayload,
  now: Date = new Date(),
): WidgetRepresentation {
  return {
    light: <BirthdaysWidget payload={payload} now={now} theme="light" />,
    dark: <BirthdaysWidget payload={payload} now={now} theme="dark" />,
  };
}
