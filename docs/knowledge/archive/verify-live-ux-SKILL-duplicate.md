---
name: verify-live-ux
description: >-
  Verifies real WCAG contrast ratios, focus-visible indicator contrast, and
  carousel/motion behavior (autoplay, pause controls, reduced-motion support)
  against actual CSS/JS values instead of visual estimation. Use whenever a
  UX/UI recommendation cites a contrast ratio, a focus state, or
  carousel/animation behavior for a live URL or local codebase, so the claim
  is backed by a computed number rather than a guess.
---

# Verify Live UX

Never assert a contrast ratio, focus-indicator contrast, or motion/carousel behavior from memory or a screenshot alone when the real source is reachable. Pull the actual values and compute exact numbers.

## Getting the source

- **Live URL**: fetch raw HTML/CSS/JS with `curl` via the `Shell` tool (not `WebFetch` — it converts to markdown and drops styling). Request `required_permissions: ["full_network"]` up front if the domain isn't on the default allowlist; don't wait for a failure first.

  ```bash
  curl -sL "https://example.com" -o page.html
  curl -sL "https://example.com/styles.css" -o styles.css
  ```

  Follow `<link rel="stylesheet">` and `<script src>` references to pull the actual stylesheets/bundles referenced by the page.

- **Local codebase**: use `Grep`/`Read` on the real CSS/SCSS/Tailwind config, CSS custom properties, or design-token files — never assume a hex value.

- If the page is a heavily client-rendered SPA and neither route above exposes the real computed styles, say so explicitly and fall back to a screenshot-based visual estimate (see "Confidence labeling" below).

## 1. Contrast ratio

Find the actual foreground and background hex/rgb values (text color + the color it renders on, including any semi-transparent overlays flattened onto their backdrop), then compute the exact ratio with the helper script — never eyeball it:

```bash
python3 .cursor/skills/verify-live-ux/scripts/contrast.py "#111827" "#FFFFFF"
```

Report the exact ratio (e.g. `15.86:1`) and compare against the applicable WCAG threshold (4.5:1 normal text, 3:1 large text/UI components, 7:1 for AAA).

## 2. Focus-visible states

- Grep the fetched/local CSS for `:focus`, `:focus-visible`, and `:focus-within` rules.
- Extract the indicator's outline/box-shadow color, width, and offset.
- Run `contrast.py` against the indicator color vs. the color(s) it sits on to confirm the 3:1 minimum (WCAG 1.4.11 Non-text Contrast).
- Check thickness/area against WCAG 2.4.13 Focus Appearance (min. 2px solid perimeter or equivalent area).
- If no `:focus-visible` rule exists and the element relies on the browser default (or `outline: none` with nothing replacing it), flag this as a failure, not a stylistic choice.

## 3. Carousel / motion behavior

- Grep fetched JS/HTML for known carousel libraries (Swiper, Slick, Splide, Embla, Owl) or custom animation/interval code.
- Extract: autoplay interval, pause-on-hover/focus support, presence of visible pause/stop controls, `aria-live` region usage, and whether `prefers-reduced-motion` is honored (media query or JS check).
- Cross-reference against WCAG 2.2.2 (Pause, Stop, Hide — required for anything that auto-updates/moves for >5s) and 2.3.3 (Animation from Interactions).

## Confidence labeling (mandatory)

Tag every reported number/behavior as one of:

- **Verified from source** — pulled from real fetched/local CSS/JS and computed via the script.
- **Estimated from screenshot/visual** — used only when no static source was reachable; state exactly why (e.g. "SPA renders via obfuscated bundle, no readable CSS").

Never present an estimate with the same confidence as a verified number.
