import WidgetKit
import SwiftUI

// Circle the date — iOS home-screen widget (TODO Stage 10; FR-48/49/50,
// DESIGN.md §8.13). Shows the next 3 events as `DateRing sm` + name + "in Nd"
// on a surface-over-paper card. Data comes from the App Group the app writes to
// (src/lib/widget.ios.ts); the timeline recomputes days-remaining for each of
// the coming days so the countdown ticks down without the app being opened
// (FR-49). Tapping a row deep-links into that person's profile (FR-50).

private let appGroup = "group.com.circlethedate.app.widget"
private let storageKey = "circle-the-date.widget"
// The canonical hand-drawn ring, normalized to a 0 0 64 64 box (DESIGN.md §7.4).
private let ringBox: CGFloat = 64

// MARK: - Shared data model (mirrors WidgetEvent in src/lib/widget-data.ts)

private struct WidgetEvent: Decodable {
  let personId: String
  let eventId: String
  let name: String
  let isPet: Bool
  let day: Int
  let month: String
  let occurrenceISO: String
  let eventLabel: String?
}

private struct WidgetPayload: Decodable {
  let updatedAtISO: String
  let events: [WidgetEvent]
}

private func loadPayload() -> WidgetPayload {
  guard
    let defaults = UserDefaults(suiteName: appGroup),
    let raw = defaults.string(forKey: storageKey),
    let data = raw.data(using: .utf8),
    let payload = try? JSONDecoder().decode(WidgetPayload.self, from: data)
  else {
    return WidgetPayload(updatedAtISO: "", events: [])
  }
  return payload
}

private func parseOccurrence(_ iso: String) -> Date? {
  let withFractional = ISO8601DateFormatter()
  withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  if let date = withFractional.date(from: iso) { return date }
  let plain = ISO8601DateFormatter()
  plain.formatOptions = [.withInternetDateTime]
  return plain.date(from: iso)
}

/// Whole days from a reference day to an occurrence, pinned to UTC midnight so
/// the math matches the JS/server logic (DST-proof). Mirrors daysUntilOccurrence.
private func daysUntil(_ occurrenceISO: String, from reference: Date) -> Int {
  guard let occurrence = parseOccurrence(occurrenceISO) else { return 0 }
  var utc = Calendar(identifier: .gregorian)
  utc.timeZone = TimeZone(identifier: "UTC")!
  let occDay = utc.startOfDay(for: occurrence)
  // `reference` is a local startOfDay instant; re-read its calendar day in the
  // local zone, then express that same day at UTC midnight to compare like-for-like.
  var local = Calendar.current
  let comps = local.dateComponents([.year, .month, .day], from: reference)
  local = utc
  let todayUTC = local.date(from: comps).map { utc.startOfDay(for: $0) } ?? occDay
  return utc.dateComponents([.day], from: todayUTC, to: occDay).day ?? 0
}

private func countdown(_ days: Int) -> String {
  if days <= 0 { return "Today" }
  if days == 1 { return "in 1 day" }
  return "in \(days) days"
}

// MARK: - Timeline

private struct EntryRow: Identifiable {
  let id: String
  let name: String
  let isPet: Bool
  let day: Int
  let month: String
  let days: Int
  let url: URL?
}

private struct BirthdaysEntry: TimelineEntry {
  let date: Date
  let rows: [EntryRow]
}

private func rows(for events: [WidgetEvent], on day: Date) -> [EntryRow] {
  events.map { event in
    EntryRow(
      id: event.eventId,
      name: event.name,
      isPet: event.isPet,
      day: event.day,
      month: event.month,
      days: daysUntil(event.occurrenceISO, from: day),
      url: URL(string: "circlethedate://person/\(event.personId)")
    )
  }
}

private struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> BirthdaysEntry {
    BirthdaysEntry(date: Date(), rows: rows(for: loadPayload().events, on: Date()))
  }

  func getSnapshot(in context: Context, completion: @escaping (BirthdaysEntry) -> Void) {
    completion(BirthdaysEntry(date: Date(), rows: rows(for: loadPayload().events, on: Date())))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<BirthdaysEntry>) -> Void) {
    let events = loadPayload().events
    let calendar = Calendar.current
    let startOfToday = calendar.startOfDay(for: Date())
    // One entry per day for the next week so "in Nd" decrements as days pass
    // without the app opening (FR-49). The app also force-reloads on data change.
    var entries: [BirthdaysEntry] = []
    for offset in 0..<8 {
      guard let day = calendar.date(byAdding: .day, value: offset, to: startOfToday) else { continue }
      entries.append(BirthdaysEntry(date: day, rows: rows(for: events, on: day)))
    }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

// MARK: - Ring (the §7 hand-drawn mark, dates only)

private struct RingShape: Shape {
  func path(in rect: CGRect) -> Path {
    let s = rect.width / ringBox
    func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * s, y: y * s) }
    var path = Path()
    path.move(to: p(33, 8))
    path.addCurve(to: p(57, 32), control1: p(49, 7), control2: p(58, 19))
    path.addCurve(to: p(26, 55), control1: p(56, 47), control2: p(41, 57))
    path.addCurve(to: p(9, 25), control1: p(12, 53), control2: p(6, 39))
    path.addCurve(to: p(36, 9), control1: p(12, 13), control2: p(22, 8))
    return path
  }
}

private struct DateRing: View {
  let day: Int
  let month: String
  let isToday: Bool
  private let box: CGFloat = 42

  var body: some View {
    ZStack {
      if isToday {
        RingShape().fill(Color("biro")).frame(width: box, height: box).rotationEffect(.degrees(-4))
      }
      RingShape()
        .stroke(Color("biro"), style: StrokeStyle(lineWidth: 2.4, lineCap: .round))
        .frame(width: box, height: box)
        .rotationEffect(.degrees(-4))
      VStack(spacing: 0) {
        Text("\(day)")
          .font(.system(size: 15, weight: .semibold))
          .monospacedDigit()
          .foregroundColor(isToday ? Color("paper") : Color("ink"))
        Text(month)
          .font(.system(size: 8))
          .foregroundColor(isToday ? Color("paper").opacity(0.75) : Color("inkMuted"))
      }
    }
    .frame(width: box, height: box)
  }
}

// MARK: - Views

private struct EventRowView: View {
  let row: EntryRow

  var body: some View {
    HStack(spacing: 10) {
      DateRing(day: row.day, month: row.month, isToday: row.days <= 0)
      VStack(alignment: .leading, spacing: 1) {
        Text("\(row.isPet ? "🐾 " : "")\(row.name)")
          .font(.system(size: 14, weight: .semibold))
          .foregroundColor(Color("ink"))
          .lineLimit(1)
      }
      Spacer(minLength: 6)
      Text(countdown(row.days))
        .font(.system(size: 12, weight: .medium))
        .monospacedDigit()
        .foregroundColor(Color("biro"))
    }
    .widgetURL(row.url)
  }
}

private struct BirthdaysWidgetView: View {
  let entry: BirthdaysEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("Upcoming")
        .font(.system(size: 12, weight: .semibold))
        .foregroundColor(Color("inkMuted"))
      if entry.rows.isEmpty {
        Text("No birthdays yet.")
          .font(.system(size: 13))
          .foregroundColor(Color("inkSecondary"))
          .padding(.top, 2)
        Spacer(minLength: 0)
      } else {
        ForEach(entry.rows) { row in
          if let url = row.url {
            Link(destination: url) { EventRowView(row: row) }
          } else {
            EventRowView(row: row)
          }
        }
        Spacer(minLength: 0)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .containerBackground(for: .widget) { Color("surface") }
  }
}

@main
struct BirthdaysWidget: Widget {
  let kind = "Birthdays"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      BirthdaysWidgetView(entry: entry)
    }
    .configurationDisplayName("Upcoming birthdays")
    .description("Your next 3 birthdays and events.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}
