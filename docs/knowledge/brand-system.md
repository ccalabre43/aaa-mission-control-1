# AAA Life brand system as implemented

- **Source:** `assets/brand/AAAL-Brand-Visual-Style-Guide.pdf` (MAR 2025)
- **Implemented in:** `src/index.css`
- **Status:** active
- **Last verified:** 16 Sep 2026

Every contrast ratio on this page is **computed**, not estimated, using
`.cursor/skills/verify-live-ux/scripts/contrast.py`. That distinction is a guardrail: the brand
guide itself makes ADA claims that do not survive being checked, and three of them are corrected
below.

The guide separates official print colors from digital/ADA-adjusted colors and is explicit that web
work uses the adjusted set. This implementation uses the adjusted set exclusively.

## Palette as implemented

| Token | Value | Role | Verified |
| --- | --- | --- | --- |
| `--aaa-blue` | `#05539F` (PMS 287) | Primary actions, focus ring, links | 7.65:1 on white; white on it 7.65:1 |
| `--aaa-blue-headline` | `#06549C` | Headline blue | 7.62:1 on white; 6.57:1 on `#EEEEEE` |
| `--aaa-blue-hover` | `#0A63B8` | Rollover, slightly lighter per the guide | white on it 6.02:1 |
| `--aaa-blue-active` | `#044383` | Pressed, slightly darker | white on it 9.83:1 |
| `--aaa-navy` | `#0B233F` | Dark navy | 15.83:1 on white |
| `--aaa-red` | `#E31E2E` | Final submit and genuine errors only | white on it 4.68:1 |
| `--aaa-bronze` | `#EA580C` | Deep Dive tile fill (brighter orange; token name still says bronze) | white on it **3.56:1**; fill on white **3.56:1** |
| `--aaa-bronze-edge` | `#B57D1A` | Unused after 032; was edge for light `#ECB350` fill | 3.55:1 on white |
| `--aaa-bronze-glyph` | `#3D3116` | Unused after 032; was dark glyph for light `#ECB350` fill | 6.75:1 on `#ECB350` |
| `--aaa-ink` | `#424242` | Body text | 10.05:1 white, 8.66:1 `#EEEEEE`, 8.29:1 wash |
| `--aaa-muted` | `#5C5C5C` | Secondary and helper text | 6.69:1 white, 5.76:1 `#EEEEEE`, 5.52:1 wash |
| `--aaa-border` | `#767676` | Card and field borders | 4.54:1 white, 3.75:1 wash |
| `--aaa-surface-gray` | `#EEEEEE` | Header and gray surface | — |
| `--aaa-wash` | `#DAECF7` | The mocks' pale blue mobile wash | — |
| `--aaa-green-tile` | `#16A34A` | Logged exception. Large tile fill only | white glyph 3.30:1 |
| `--aaa-green-safe` | `#0D5C2E` | Stepper dots, success text | 8.12:1 white; 7.00:1 on `#EEEEEE` |
| `--aaa-track` | `#C9C9C9` | Progress track | blue fill on it 4.62:1 |

### The one token that no longer holds the guide's value

`--aaa-bronze` held the guide's **antique bronze `#5F6240`** (rarely used, never primary; white on it
6.35:1) until 2026-09-17, when it was redefined to the requested gold `#ECB350`. On 2026-10-05 it was
darkened to `#9C6A15` for a white glyph (032), then shifted to brighter orange **`#EA580C`** (033).
The guide's antique bronze and rejected light gold stay recorded here; the token name still says
bronze while the value is orange.

## Six corrections the computation forced

These are the places where following the guide or the mocks literally would have shipped an
accessibility failure. Each is a real decision, not a nitpick.

1. **`#767676` is only "the lightest ADA-compliant gray" on white.** At 4.54:1 on white it passes,
   but on its own `#EEEEEE` surface it drops to **3.91:1 and fails** 1.4.3, and on the pale blue
   wash it is **3.75:1 and also fails**. Implemented rule: `#767676` is a *border* color, not a text
   color. Secondary text uses `#5C5C5C`, which passes on all three surfaces.

2. **The official print red fails as a button.** `#ED1C2F` gives white text **4.37:1**, below AA.
   This is why the guide publishes the digital red `#E31E2E` at 4.68:1. `#ED1C2F` never appears in
   the app.

3. **Form field borders were failing badly.** The guide's "1px medium gray stroke" drawn in
   `#A09FA0` is **2.64:1**, and the tracker's previous `--aaa-field-stroke: #cacaca` was **1.64:1** —
   both fail 1.4.11's 3:1 for control boundaries. Field borders are now `#767676` at 4.54:1. This
   visibly changes the existing tracker, and that is the point.

4. **The focus ring's offset is load-bearing, and the plan's claim about it was wrong.** The plan
   stated a brand-blue focus ring clears 3:1 "against both white and the border." Computed, blue
   `#05539F` against a `#767676` border is only **1.68:1**. The ring therefore must never sit
   directly on the border. With the 2px `outline-offset`, the ring's adjacent color is the page
   background, where it reaches 7.65:1 on white, 6.60:1 on `#EEEEEE`, and 6.31:1 on the wash.
   **Removing `--focus-outline-offset` would silently break 1.4.11 and 2.4.13.**

5. **Light blue `#7EA9CD` is 2.49:1 on white.** Decorative only. Never a boundary, never text.

6. **Bright green fails twice, and passes once.** White glyphs on `#16A34A` are **3.30:1** — enough
   for 1.4.11's non-text 3:1, not enough for 1.4.3 text. As a small stepper dot against the light
   header it is **2.84:1 and fails**. So the bright green is permitted only as a large tile fill
   behind a white glyph, and the stepper uses `#0D5C2E` instead.

## Green as a documented brand exception

Green appears nowhere in the AAA Life palette, but it is deliberate across both dashboard mocks and
the flow stepper. It stays as an internal-tool accent under a dated exception in
`docs/decisions/decision-log.md`, pending brand-team sign-off.

**Accessibility is explicitly not part of the exception.** The value darkens wherever the bright
green fails a success criterion, as in correction 6 above. An approved brand deviation does not
approve a WCAG failure.

## Typography

Brand primary is Gotham (Book, Bold, Black). The guide states plainly that Gotham is licensed and
cannot be shared, and designates **Open Sans** as the web substitute. It also forbids pairing the
two, so Open Sans is used alone at 400/600/700.

**Drift corrected.** The previous `src/index.css` loaded Nunito Sans, Oswald, and Roboto — none of
which is a brand font — plus `@font-face` rules for Gotham **Condensed**, which is a different
family from the specified Gotham and was referenced from local fonts most machines do not have. All
of that is removed.

**Open Sans is self-hosted** through the `@fontsource/open-sans` package and imported in
`src/main.tsx`. The previous Google Fonts `<link>` and `preconnect` in `index.html` are removed: a
webfont request sends the user's IP address and user agent to a third party on every page load,
which is a privacy consideration under the company guardrails and entirely avoidable.

## Buttons and fields

The guide prefers pills but explicitly allows rectangular buttons with rounded corners, which is
what every mock draws — so the mocks are compliant as drawn and the existing 0.25rem radius holds.
Rollover is slightly lighter, pressed slightly darker. Outlined transparent-fill buttons are the
sanctioned way to express hierarchy.

**Primary actions in the request flow are blue, not red.** The guide cautions against red buttons on
screens containing form fields, because red reads as an error state, and this flow is nothing but
form fields. Red is reserved for the final submit and for genuine errors, consistent with the
guide's light-and-cool ratio and its flat refusal of red as a layout's primary color.

## Logo

The EPS masters in `assets/brand/` are print originals that browsers cannot render; web derivatives
live beside them. The guide requires clear space equal to half the red oval's height on all sides and
forbids stretching, recoloring, or disassembling the mark. The web derivative bakes that clear space
into its viewBox so layout cannot crowd it.

**Deliberate deviation from the mocks:** the three intake-screen mocks omit the logo while the
dashboard mock includes it. The logo is kept persistent across all routes, since the guide asks for
branding throughout.

## Retheme note

The previous daisyUI theme was `aaa-michigan` using `#003087`, `#98150b`, `#222222`, and `#f4f4f4` —
none of which are AAA Life digital values. The theme is now `aaa-life`. This visibly changes the
existing deliverables tracker. That is brand compliance, not a redesign.

## Still missing

Four companion guides the PDF references are not in the folder: the AAA Life Language Guide, Product
Guide, Direct Mail Guide, and AAA National Brand Guide. The **Language Guide** matters most, since it
likely constrains brief voice and disclaimer wording. Tracked as a blocker in `docs/INDEX.md`.
