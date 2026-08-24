# App Store screenshots

Captured from the `simulator` EAS profile on an **iPhone 17 Pro Max** at
**1320 x 2868**, which is Apple's 6.9" requirement and the only size that must
be supplied - Apple scales it down for every smaller iPhone.

Captured with `xcrun simctl io <udid> screenshot`, not the Simulator's own
Cmd-S, so the file is the exact pixel buffer with no window chrome or corner
rounding.

Simulator was set up as:

    xcrun simctl ui <udid> appearance light
    xcrun simctl status_bar <udid> override --time "9:41" \
      --batteryState charged --batteryLevel 100 \
      --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3

The 9:41 clock and full bars are Apple's own marketing convention, and they
stop a half-drained battery or a "Carrier" label from dating the shots.

Data comes from the App Review account (`appreview@birthdayreminders.us`),
which is seeded with 11 people so no screen shows an empty state.

## Numbered files are the ones to upload, in order

Store order matters - the first two or three are what people see in search
results without scrolling.

| File | Screen |
| --- | --- |
| `01-reminders.png` | Reminders feed, with the day-of greeting ready to send |
| `02-people.png` | Everyone, sorted by next date |
| `03-calendar.png` | Month view with the dated dots |
| `04-settings-channels.png` | Per-channel notification control |
| `05-sign-in.png` | Sign-in, showing Apple / Google / email |

## `x-` prefixed files are NOT for upload

- `x-lists-empty.png` - the shared-lists empty state. Re-shoot once the review
  account actually has a list on it.
- `x-settings-integrations.png` - the copy under "Home screen widget" reads
  "Add it from the home screen on iOS or Android." Screenshots are metadata,
  and guideline 2.3.10 covers references to other mobile platforms in
  metadata. Not worth the risk over one word.

## Still missing

A home-screen shot with the widget showing the next three dates. It is one of
the strongest things the app does and there is no screenshot of it yet.
