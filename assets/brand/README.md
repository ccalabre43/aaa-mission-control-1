# Brand assets

## Files

| File | Role |
| --- | --- |
| `AAAL-Brand-Visual-Style-Guide.pdf` | The brand system, MAR 2025. Proprietary and internal-use only |
| `aaa-life-logo-2color.eps` | **Print master**, 2-color process. Do not use on the web |
| `aaa-life-logo-white.eps` | **Print master**, reversed white. Do not use on the web |
| `aaa-life-logo-2color-web.png` | Web derivative, 358x226, transparent |
| `aaa-life-logo-white-web.png` | Web derivative, 358x226, transparent |

The two web PNGs are duplicated into `src/assets/` so Vite fingerprints and bundles them. Edit them
here and copy across; this folder is the source of truth.

## How the derivatives were produced

Browsers cannot render EPS, and no PostScript converter (Ghostscript, ImageMagick, Inkscape) is
installed on this machine. Both EPS files are DOS-format EPS with a binary header, and each embeds a
296x164 TIFF preview with an alpha channel. The preview was extracted at the byte offsets in that
header and converted to PNG with `sips`.

**Clear space is baked in.** The guide requires clear space equal to half the red oval's height on
all sides. The oval is roughly 62px tall in the 164px artwork, so 31px was added on every side,
taking the canvas from 296x164 to 358x226 with the artwork centered. Because the padding is part of
the image, a layout cannot crowd the mark even if someone removes the CSS margin.

Sizing note: the artwork is 164/226 of the image height, so rendering the PNG at 44px tall yields
about 32px of visible mark, which is what the dashboard mock shows. At 226px native that is roughly
5x oversampled, so it stays crisp on any realistic display density and needs no `srcset`.

## Two caveats that matter

**1. The 2-color PNG is color-approximate.** Its colors come from the EPS's embedded preview, which
is a low-fidelity CMYK-to-RGB conversion. The dominant values measured in the extracted file are
`#00339A`, `#00669A`, `#FF3333`, and `#CD0033`. The brand digital palette is `#05539F` and
`#E31E2E`, so these are close but **not** brand-exact.

The guide forbids recoloring the mark, and a preview conversion is effectively an unintended
recolor. This asset is therefore an **interim** derivative. It is visually correct in shape,
proportion, and clear space, and wrong by a few percent in hue.

**The white derivative has no such problem** - it is pure `#FFFFFF` across all 12,013 opaque pixels,
so it is exact. Prefer it wherever the surface is dark or brand blue.

**2. There is no SVG yet.** An SVG needs a vector export from the original Illustrator artwork.
Re-vectorizing the raster here would alter the mark, which the guide forbids outright, so it was not
attempted.

## Open request to the brand team

Ask for a proper web export of both lockups from the Illustrator source:

- **SVG**, with the digital palette values `#05539F` and `#E31E2E` applied
- **PNG** at 1x and 2x if a raster fallback is wanted
- Clear space included, matching the 31px-per-side ratio used here

Until that arrives, the interim PNG above ships. Tracked as a blocker in `docs/INDEX.md` and recorded
in `docs/decisions/decision-log.md`.

## Standing rules

Never stretch, recolor, disassemble, or rotate the mark. Never crowd its clear space. Never rebuild
it from parts. The EPS files stay untouched as print masters.
