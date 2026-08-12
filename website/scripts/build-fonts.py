"""Regenerate the vendored webfonts in `app/fonts/`.

`app/layout.tsx` loads its two families through `next/font/local` rather than
`next/font/google`, because the Google loader downloads woff2 files at build
time and Google rotates the hashed filenames inside its stylesheets. A stale
stylesheet in Turbopack's build cache is enough to fail a deploy with
"Can't resolve @vercel/turbopack-next/internal/font/google/font". Vendoring the
files makes the build hermetic.

This script reproduces what Google's CSS API serves, from the same upstream
sources, so the rendered result is unchanged:

  * pin the variable font to a single weight (Google ships static instances)
  * subset to latin + latin-ext, using the exact unicode ranges from the CSS
  * keep pyftsubset's default layout features, plus `tnum` — the UI leans on
    Tailwind's `tabular-nums` in a lot of places, and that needs `tnum`
  * compress to woff2

Cyrillic, Greek and Vietnamese are deliberately dropped; the product is
English-only (US/CA), and those subsets were only ever lazily fetched.

Dev-only. Not needed to build or deploy — the outputs are committed.

    pip install "fonttools[woff]"
    npm run fonts:build
"""

from __future__ import annotations

import os
import shutil
import tempfile
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

# Upstream variable sources, straight from the Google Fonts repo.
SOURCES = {
    "inter": "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf",
    "hanken": "https://github.com/google/fonts/raw/main/ofl/hankengrotesk/HankenGrotesk%5Bwght%5D.ttf",
}

# `latin` + `latin-ext`, copied verbatim from the unicode-range values in
# https://fonts.googleapis.com/css2?family=Inter:wght@400
UNICODES = ",".join(
    (
        # latin
        "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,"
        "U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,"
        "U+FEFF,U+FFFD",
        # latin-ext
        "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,"
        "U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,"
        "U+A720-A7FF",
    )
)

# (source, axis pins, output filename). `opsz` 14 is Inter's text optical size,
# which is what Google's static instances are cut at.
FACES = [
    ("inter", {"opsz": 14, "wght": 400}, "Inter-Regular.woff2"),
    ("inter", {"opsz": 14, "wght": 500}, "Inter-Medium.woff2"),
    ("hanken", {"wght": 500}, "HankenGrotesk-Medium.woff2"),
    ("hanken", {"wght": 600}, "HankenGrotesk-SemiBold.woff2"),
]

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "fonts")


def main() -> None:
    out_dir = os.path.normpath(OUT_DIR)
    os.makedirs(out_dir, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        masters = {}
        for name, url in SOURCES.items():
            path = os.path.join(tmp, f"{name}.ttf")
            print(f"fetching {url}")
            with urllib.request.urlopen(url) as res, open(path, "wb") as fh:
                shutil.copyfileobj(res, fh)
            masters[name] = path

        for source, pins, filename in FACES:
            # recalcTimestamp=False keeps `head.modified` at the upstream value,
            # so regenerating an unchanged face is a no-op in git.
            font = TTFont(masters[source], recalcTimestamp=False)
            instantiateVariableFont(font, pins, inplace=True, updateFontNames=False)

            instanced = os.path.join(tmp, filename + ".ttf")
            font.save(instanced)

            out_path = os.path.join(out_dir, filename)
            subset.main(
                [
                    instanced,
                    f"--unicodes={UNICODES}",
                    "--layout-features+=tnum",
                    "--flavor=woff2",
                    "--no-hinting",
                    f"--output-file={out_path}",
                ]
            )
            print(f"  {filename:30s} {os.path.getsize(out_path) / 1024:6.1f} KB")


if __name__ == "__main__":
    main()
