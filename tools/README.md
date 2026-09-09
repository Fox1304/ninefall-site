# tools

Excluded from deploys by `.vercelignore`.

`favicon.py` builds the icon set from the game's own chip spec: `favicon.ico`
(16/32/48), `favicon.svg`, `favicon-96.png`, and the home-screen icons
(`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) resampled from
`icon.png`. Needs Pillow, nothing else — the Nunito Black 9 is frozen in the
script as an outline.

To regenerate: `python3 tools/favicon.py` from the repo root.

`og.html` renders the Open Graph card at `assets/og.jpg`.

To regenerate: serve the site locally, open `tools/og.html` at a 1200x630
viewport, and save a screenshot over `assets/og.jpg`.
