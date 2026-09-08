#!/usr/bin/env python3
"""Compute the exact WCAG 2.x contrast ratio between two colors.

Usage:
    python3 contrast.py "#RRGGBB" "#RRGGBB"
    python3 contrast.py "rgb(17,24,39)" "rgba(255,255,255,0.9)" "#FFFFFF"

If a color has an alpha channel, pass an optional third argument giving the
backdrop it is composited on (defaults to white) so the flattened color is
used for the calculation.
"""
import re
import sys


def parse_color(value):
    value = value.strip()
    hex_match = re.fullmatch(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})", value)
    if hex_match:
        h = hex_match.group(1)
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        r, g, b = (int(h[i : i + 2], 16) for i in (0, 2, 4))
        return r, g, b, 1.0

    rgb_match = re.fullmatch(
        r"rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)",
        value,
        re.IGNORECASE,
    )
    if rgb_match:
        r, g, b = (float(rgb_match.group(i)) for i in (1, 2, 3))
        a = float(rgb_match.group(4)) if rgb_match.group(4) is not None else 1.0
        return r, g, b, a

    raise ValueError(f"Unrecognized color format: {value!r}")


def flatten(rgba, backdrop_rgb):
    r, g, b, a = rgba
    if a >= 1.0:
        return r, g, b
    br, bg, bb = backdrop_rgb
    return (
        r * a + br * (1 - a),
        g * a + bg * (1 - a),
        b * a + bb * (1 - a),
    )


def relative_luminance(rgb):
    def channel(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    r_lin, g_lin, b_lin = channel(r), channel(g), channel(b)
    return 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin


def contrast_ratio(rgb1, rgb2):
    l1, l2 = relative_luminance(rgb1), relative_luminance(rgb2)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def main():
    if len(sys.argv) not in (3, 4):
        print(__doc__)
        sys.exit(1)

    backdrop = parse_color(sys.argv[3])[:3] if len(sys.argv) == 4 else (255, 255, 255)

    rgb1 = flatten(parse_color(sys.argv[1]), backdrop)
    rgb2 = flatten(parse_color(sys.argv[2]), backdrop)

    ratio = contrast_ratio(rgb1, rgb2)
    print(f"Contrast ratio: {ratio:.2f}:1")
    print(f"  AA normal text (>=4.5:1): {'PASS' if ratio >= 4.5 else 'FAIL'}")
    print(f"  AA large text / UI components (>=3:1): {'PASS' if ratio >= 3 else 'FAIL'}")
    print(f"  AAA normal text (>=7:1): {'PASS' if ratio >= 7 else 'FAIL'}")


if __name__ == "__main__":
    main()
