#!/usr/bin/env python3
"""Ninefall favicon factory — the tab mark and the home-screen icons.

The tab mark is the solo 9 chip, full bleed. Two deliberate departures from
`appstore/brand/tools/gen.py`, both forced by the 16 px tab slot:

  * no cream field. The app icon floats the chip on `--card` with ~18% margin;
    at 16 px that margin eats a third of the linear space and the mark turns to
    porridge. The chip runs edge to edge instead.
  * no -4 deg tilt. The tilt is the chip's character at 40 px and up, but at
    16 px it only buys stair-stepped corners.

Everything else is the shipping spec: continuous-corner squircle at r=22%,
the plum value-9 fill (`Palette.flipped[9]`), the vertical base ramp, the
gloss, the rim light, and the Nunito Black numeral — frozen below as an
outline so this script needs no font file and cannot drift with a font update.

The home-screen icons (apple-touch-icon, manifest 192/512) are resampled from
`icon.png`, the shipping App Store icon, so a bookmarked Ninefall is the same
object as an installed one.

    python3 tools/favicon.py      # -> favicon.ico/.svg, favicon-96.png,
                                  #    apple-touch-icon.png, icon-{192,512}.png
"""
import os, re
from PIL import Image, ImageChops, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---- Palette (ios/Ninefall/Theme.swift, via appstore/brand/tools/gen.py) ----
PLUM = "#6F303F"          # RAMP[9] — the hero chip, primary brand colour
CHIP_INK = "#FFF3E1"      # ink_for(9)

# ---- Nunito Black "9" (OFL), instanced at wght 900, 1000 upem ---------------
# fontTools: instantiateVariableFont(nunito_variable.ttf, {"wght": 900}) then
# SVGPathPen on glyph "nine". Y is up, as in the font.
NINE = ("M238 -11Q197 -11 155 -1Q113 9 75 29Q51 41 42 61Q33 82 35 105Q38 127 51 145"
        "Q64 162 85 169Q107 176 134 164Q164 150 190 145Q216 140 240 140Q290 140 323 160"
        "Q357 181 374 223Q390 264 390 326V378H405Q397 336 373 305Q348 274 313 258"
        "Q277 242 233 242Q175 242 129 271Q82 301 55 354Q28 406 28 471Q28 543 59 598"
        "Q90 653 146 685Q201 716 272 716Q365 716 430 674Q494 632 528 553Q562 473 562 359"
        "Q562 272 540 203Q518 134 476 86Q434 39 374 14Q314 -11 238 -11Z"
        "M282 382Q308 382 327 394Q347 407 357 428Q368 450 368 479Q368 509 357 531"
        "Q347 553 327 564Q308 576 282 576Q256 576 237 564Q218 553 207 531Q196 509 196 479"
        "Q196 450 207 428Q218 407 237 394Q256 382 282 382Z")
NINE_BOX = (28.229, -11.277, 562.048, 716.277)   # glyph bounds, font units

CHIP_R = 0.22        # squircle corner, share of the edge (TileViews.swift)
NUM_H = 0.635        # numeral height, share of the chip edge
RIM = 0.018          # rim light, share of the chip edge (drawn inside the edge,
                     # so a full-bleed chip keeps the whole highlight)


def squircle(x, y, w, h, r, smooth=0.45):
    """Continuous-corner squircle — lifted from brand/tools/gen.py."""
    r = min(r, w / 2, h / 2); t = r * (0.5523 + smooth * (1 - 0.5523))
    x1, y1 = x + w, y + h
    return (f"M {x+r:.2f} {y:.2f} L {x1-r:.2f} {y:.2f} "
            f"C {x1-r+t:.2f} {y:.2f} {x1:.2f} {y+r-t:.2f} {x1:.2f} {y+r:.2f} "
            f"L {x1:.2f} {y1-r:.2f} C {x1:.2f} {y1-r+t:.2f} {x1-r+t:.2f} {y1:.2f} {x1-r:.2f} {y1:.2f} "
            f"L {x+r:.2f} {y1:.2f} C {x+r-t:.2f} {y1:.2f} {x:.2f} {y1-r+t:.2f} {x:.2f} {y1-r:.2f} "
            f"L {x:.2f} {y+r:.2f} C {x:.2f} {y+r-t:.2f} {x+r-t:.2f} {y:.2f} {x+r:.2f} {y:.2f} Z")


def nine_path(cx, cy, height):
    """The numeral as an SVG path, scaled to `height` and centred on cx,cy."""
    x0, y0, x1, y1 = NINE_BOX
    s = height / (y1 - y0)
    dx = cx - (x0 + x1) / 2 * s
    dy = cy + (y0 + y1) / 2 * s          # font Y is up, SVG Y is down
    def pt(px, py): return f"{dx + px*s:.2f} {dy - py*s:.2f}"
    out, i, cur = [], 0, (0.0, 0.0)
    for cmd, nums in re.findall(r"([MLQVHZ])([-\d. ]*)", NINE):
        v = [float(n) for n in nums.replace("-", " -").split()]
        if cmd == "M":   cur = (v[0], v[1]); out.append("M" + pt(*cur))
        elif cmd == "L": cur = (v[0], v[1]); out.append("L" + pt(*cur))
        elif cmd == "H": cur = (v[0], cur[1]); out.append("L" + pt(*cur))
        elif cmd == "V": cur = (cur[0], v[0]); out.append("L" + pt(*cur))
        elif cmd == "Q": out.append("Q" + pt(v[0], v[1]) + " " + pt(v[2], v[3])); cur = (v[2], v[3])
        elif cmd == "Z": out.append("Z")
    return "".join(out)


# =============================================================================
#  SVG — the vector tab mark
# =============================================================================
def tab_mark_svg(S=64):
    """Full-bleed plum 9 chip. Renders identically at 16 px and 512 px."""
    chip = squircle(0, 0, S, S, S * CHIP_R)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">
<title>Ninefall</title>
<defs>
<linearGradient id="base" x1="0" y1="0" x2="0" y2="{S}" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="{PLUM}"/><stop offset=".72" stop-color="{PLUM}"/>
<stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>
<linearGradient id="gloss" x1="0" y1="0" x2="0" y2="{S*0.62:.2f}" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#fff" stop-opacity=".42"/>
<stop offset=".5" stop-color="#fff" stop-opacity=".08"/>
<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="chip"><path d="{chip}"/></clipPath>
</defs>
<path d="{chip}" fill="url(#base)"/>
<rect width="{S}" height="{S}" fill="url(#gloss)" clip-path="url(#chip)"/>
<path d="{chip}" fill="none" stroke="#fff" stroke-opacity=".40" stroke-width="{S*RIM:.2f}" clip-path="url(#chip)"/>
<path d="{nine_path(S/2, S/2, S*NUM_H)}" fill="{CHIP_INK}" fill-rule="evenodd"/>
</svg>
'''


# =============================================================================
#  Raster — the same chip, drawn with Pillow at 16x and resampled down
# =============================================================================
def _flatten(d, steps=24):
    """SVG path -> list of closed point lists (M/L/C/Q/Z, absolute only)."""
    contours, pts, cur, start = [], [], (0.0, 0.0), (0.0, 0.0)
    for cmd, nums in re.findall(r"([MLCQZ])([-\d.e ]*)", d):
        v = [float(n) for n in nums.replace("-", " -").split()]
        if cmd == "M":
            if pts: contours.append(pts)
            cur = start = (v[0], v[1]); pts = [cur]
        elif cmd == "L":
            cur = (v[0], v[1]); pts.append(cur)
        elif cmd in "CQ":
            p = [cur] + [(v[i], v[i+1]) for i in range(0, len(v), 2)]
            for i in range(1, steps + 1):
                t, u = i / steps, 1 - i / steps
                if cmd == "C":
                    pts.append((u*u*u*p[0][0] + 3*u*u*t*p[1][0] + 3*u*t*t*p[2][0] + t*t*t*p[3][0],
                                u*u*u*p[0][1] + 3*u*u*t*p[1][1] + 3*u*t*t*p[2][1] + t*t*t*p[3][1]))
                else:
                    pts.append((u*u*p[0][0] + 2*u*t*p[1][0] + t*t*p[2][0],
                                u*u*p[0][1] + 2*u*t*p[1][1] + t*t*p[2][1]))
            cur = p[-1]
        elif cmd == "Z":
            cur = start
    if pts: contours.append(pts)
    return contours


def _mask(d, size):
    """Even-odd fill of a path into an L-mode mask (XOR of its contours)."""
    m = Image.new("L", (size, size), 0)
    for c in _flatten(d):
        layer = Image.new("L", (size, size), 0)
        ImageDraw.Draw(layer).polygon(c, fill=255)
        m = ImageChops.difference(m, layer)
    return m


def _vgrad(size, stops):
    """Vertical gradient as an L mask. stops: [(offset, alpha 0-255), ...]."""
    g = Image.new("L", (1, size))
    px = g.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        for i in range(len(stops) - 1):
            (o0, a0), (o1, a1) = stops[i], stops[i + 1]
            if o0 <= t <= o1:
                k = 0 if o1 == o0 else (t - o0) / (o1 - o0)
                px[0, y] = int(round(a0 + (a1 - a0) * k)); break
        else:
            px[0, y] = stops[-1][1]
    return g.resize((size, size), Image.NEAREST)


def tab_mark_png(size, ss=16):
    """The tab mark, drawn at `size*ss` and resampled to `size`."""
    S = size * ss
    chip = _mask(squircle(0, 0, S - 1, S - 1, (S - 1) * CHIP_R), S)
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    plum = Image.new("RGBA", (S, S), PLUM)                      # base ramp
    plum.paste(Image.new("RGBA", (S, S), "#000000"), (0, 0),
               _vgrad(S, [(0, 0), (0.72, 0), (1.0, 41)]))
    img.paste(plum, (0, 0), chip)

    gloss = Image.new("RGBA", (S, S), "#FFFFFF")                # top gloss
    ga = _vgrad(S, [(0, 107), (0.31, 20), (0.62, 0), (1.0, 0)])
    img.paste(gloss, (0, 0), ImageChops.multiply(ga, chip))

    i = S * RIM / 2                                             # rim light
    inner = _mask(squircle(i, i, S - 1 - 2*i, S - 1 - 2*i, (S - 1 - 2*i) * CHIP_R), S)
    rim = ImageChops.subtract(chip, inner)
    img.paste(Image.new("RGBA", (S, S), "#FFFFFF"), (0, 0), rim.point(lambda a: a * 40 // 100))

    img.paste(Image.new("RGBA", (S, S), CHIP_INK), (0, 0),      # the numeral
              _mask(nine_path(S / 2, S / 2, S * NUM_H), S))
    return img.resize((size, size), Image.LANCZOS)


# =============================================================================
def main():
    w = lambda n, b: (open(os.path.join(ROOT, n), "wb").write(b), print(f"  {n}"))
    print("tab mark")
    open(os.path.join(ROOT, "favicon.svg"), "w").write(tab_mark_svg())
    print("  favicon.svg")
    # Pillow drops any requested ICO size larger than the base image, so the
    # base has to be the biggest one; the rest ride along in append_images.
    ico = [tab_mark_png(s) for s in (48, 32, 16)]
    ico[0].save(os.path.join(ROOT, "favicon.ico"), sizes=[(48, 48), (32, 32), (16, 16)],
                append_images=ico[1:])
    print("  favicon.ico  16/32/48")
    tab_mark_png(96).save(os.path.join(ROOT, "favicon-96.png"), optimize=True)
    print("  favicon-96.png")

    print("home screen (resampled from the App Store icon)")
    src = Image.open(os.path.join(ROOT, "icon.png")).convert("RGB")
    for name, s in [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)]:
        out = src if s == src.width else src.resize((s, s), Image.LANCZOS)
        out.save(os.path.join(ROOT, name), optimize=True)
        print(f"  {name}")


if __name__ == "__main__":
    main()
