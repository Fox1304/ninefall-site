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

`hero-source.mp4` is the raw screen recording of 1-11 · Grand Finale that the
hero clip is cut from. It is kept here, out of the deploy, because the cut
drops the win dialog and a source without it cannot be recovered from the
shipped file.

To re-cut `assets/hero.mp4` (4.4s, silent, seamless loop: a beat on the poised
board, the placement, the cascade, the banner, then a half-second dissolve back
to the start):

    ffmpeg -i tools/hero-source.mp4 -filter_complex \
      "[0:v]trim=0:4.22,setpts=PTS-STARTPTS,tpad=start_duration=0.7:start_mode=clone,fps=30,settb=AVTB[a];\
       [a]split[a1][a2];[a1]trim=0:4.42,setpts=PTS-STARTPTS[main];\
       [a2]trim=0:0.5,setpts=PTS-STARTPTS[head];\
       [main][head]xfade=transition=fade:duration=0.5:offset=3.92[v]" \
      -map "[v]" -an -c:v libx264 -profile:v high -level 3.1 -pix_fmt yuv420p \
      -crf 25 -preset slow -movflags +faststart assets/hero.mp4

Then refresh the poster, which is the clip's first frame:

    ffmpeg -i assets/hero.mp4 -frames:v 1 -q:v 4 assets/hero-poster.jpg
