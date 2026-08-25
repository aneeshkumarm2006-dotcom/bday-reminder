# Play Store assets — Circle the date

## Listing copy
- `listing/short-description.txt` — 74/80 chars
- `listing/full-description.txt` — 2,261/4,000 chars

No mention of iOS or the App Store anywhere: Google rejects listings that
reference a competing platform, the mirror of Apple's 2.3.10.

## Graphics
- `graphics/play-icon-512.png` — 512x512, no alpha, from app/assets/images/icon.png
- `graphics/feature-graphic-{light,dark}.png` — 1024x500, required to publish

Regenerate the feature graphic after editing `graphics/feature-graphic.html`
(VARIANT is substituted with `light` or `dark`):

    G=store/android/graphics
    CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    for v in light dark; do
      sed "s/VARIANT/$v/" $G/feature-graphic.html > /tmp/fg-$v.html
      "$CHROME" --headless --disable-gpu --hide-scrollbars \
        --force-device-scale-factor=1 --virtual-time-budget=6000 \
        --window-size=1024,500 --screenshot="$G/feature-graphic-$v.png" \
        "file:///tmp/fg-$v.html"
    done

The icon is inlined as a data URI, so the only network fetch is Google Fonts
(Hanken Grotesk + Inter, matching the website). Content sits within ~190px of
each edge because Play crops the graphic differently across surfaces.

## Screenshots
Play requires 2-8 phone screenshots, PNG/JPEG, 16:9 or 9:16, each side
320-3840px, and at least 1080px per side to qualify for promotion. Captures
off a modern phone are ~1:2.2 and need padding to 9:16 before upload.

Never usable: login screens, sign-up screens, splash screens, empty states,
anything showing appreview@birthdayreminders.us or a member named "App Review".
