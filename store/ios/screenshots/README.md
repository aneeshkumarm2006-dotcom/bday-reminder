# App Store screenshots

Captured from the `simulator` EAS profile on an **iPhone 17 Pro Max** at
**1320 x 2868** - Apple's 6.9" requirement, and the only size that has to be
supplied, since Apple scales it down for every smaller iPhone.

Taken with `xcrun simctl io <udid> screenshot`, not the Simulator's own Cmd-S,
so each file is the exact pixel buffer with no window chrome or corner
rounding.

Simulator prepared as:

    xcrun simctl ui <udid> appearance light
    xcrun simctl status_bar <udid> override --time "9:41" \
      --batteryState charged --batteryLevel 100 \
      --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3

The 9:41 clock and full bars are Apple's own marketing convention, and they
keep a half-drained battery or a "Carrier" label from dating the shots.

Data comes from the App Review account, seeded with 11 people and a shared
"Family" list, so nothing shows an empty state.

## Upload these five, in this order

The first two or three are what people see in search without scrolling, so
order is doing real work here.

| # | File | Screen |
| --- | --- | --- |
| 1 | `01-reminders.png` | Reminders feed with the day-of greeting ready to send - the app's whole argument in one image |
| 2 | `02-widget-home-screen.png` | Home screen: the widget showing the next three, and the app icon reading today's date |
| 3 | `03-people.png` | Everyone, sorted by next date |
| 4 | `04-calendar.png` | Month view with dated dots |
| 5 | `05-shared-lists.png` | Shared lists |

## rejected/

Kept for reference so nobody re-shoots them by mistake.

Three leak the review account. Screenshots are public store metadata, and a
visible `appreview@birthdayreminders.us` or a member named "App Review" reads
as an unfinished build:

- `sign-in-shows-test-account.png` - the address is typed into the field
- `settings-shows-test-account.png` - "Signed in as appreview@..."
- `list-detail-shows-test-account.png` - member named "App Review", their
  address, and a red "Delete list" button in the middle of the frame

Two more:

- `lists-empty-state.png` - captured before the account had a list. An empty
  state is the worst thing a store screenshot can show.
- `settings-mentions-android.png` - the copy under "Home screen widget" reads
  "Add it from the home screen on iOS or Android". Screenshots count as
  metadata, and guideline 2.3.10 covers references to other mobile platforms
  in metadata.

## Re-shooting

    eas build -p ios --profile simulator

Install the resulting .app, sign in as the review account, then capture with
`simctl io screenshot`. Set the appearance and status bar first - the status
bar override resets when the device idles.
