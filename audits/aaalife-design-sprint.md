# AAA Life homepage — condensed Design Thinking sprint (Define → Ideate → Prototype → Test)

Scope: the 9 findings from the live audit (`[aaalife-homepage-fixes.md](aaalife-homepage-fixes.md)`). Starting at Define, not Empathize, since the audit already surfaced concrete, verified problems rather than open-ended ones.

## Define

| Problem statement | WCAG / Law of UX | Metric it maps to |
|---|---|---|
| Hero H1/H2 contrast varies 1.67:1–4.65:1 depending on the photo behind it, with no scrim | 1.4.3 Contrast Minimum; Aesthetic-Usability Effect doesn't offset a legibility gap | First-impression legibility; potential AODA/ADA Title III exposure per the CCP's accessibility-as-compliance stance |
| Form-input focus indicator (1.64:1) and CTA focus indicator (no outline, ~1.5:1 bg shift) both fail visibility minimums | 1.4.11 / 2.4.7 / 2.4.11 | Keyboard-user task completion on the quote form — directly upstream of quote-start conversion |
| 3 competing "primary CTA" colors (`#2199e8`, `#00529c`, `#e31b2d`) | Von Restorff Effect diluted; Hick's Law (unclear which action is primary) | Click-through rate on "Get a Term Quote" |
| 5 of 6 scripts render-blocking; ~1.4MB core JS/CSS before hero image | Doherty Threshold (400ms), industry data: sites <2s bounce 35% lower than sites >4s | Bounce rate — the metric you asked about directly |
| `close-button` focus regression (`outline:none`, no replacement) | 2.4.7 Focus Visible | Modal dismissal for keyboard users specifically |

## Ideate

For the two decisions that have real trade-offs (not just bugs to fix), sketch options rather than picking unilaterally:

**CTA color** — three options:
1. Standardize on `#00529c` (existing `.btn-blue`) everywhere. Pro: already passes AAA-adjacent contrast (7.82:1), reads as "trustworthy institutional blue," matches nav/header brand blue already in use. Con: loses the pink's attention-grabbing warmth for the single most important action.
2. Standardize on `#e31b2d` (existing `.btn-pink`) everywhere. Pro: higher Von Restorff contrast against the mostly-blue/white page, reads as more urgent. Con: only 4.71:1 text contrast (passes AA, not AAA), and "red as primary CTA" can read as alarm/error in some design systems.
3. Keep both, but assign them different *jobs*: blue = navigational/secondary ("Learn more"), pink = the one true primary conversion action ("Get a Term Quote"), and audit every instance sitewide to enforce that split rather than mixing them per-component as today.

**Focus indicator rollout** — two options:
1. Apply the existing `#005ea8` 3px outline token everywhere in one pass (fastest, matches finding 4's proof that it already works and is compliant).
2. Use the moment as a chance to formally define a focus-token in whatever design-system source AAA Life's Figma library uses, so it's documented once instead of copy-pasted per component.

Recommend the team pick in a short workshop rather than the agent deciding — these are brand/design-system calls, not accessibility calls (the accessibility bar is the same either way: solid outline, ≥3:1, visible on all interactive elements).

## Prototype (ordered by risk, low first)

1. `defer` on the 5 render-blocking scripts — zero visual/design risk, pure performance, ship first.
2. Global focus-visible outline token — one CSS addition, no visual regression risk since it only appears on `:focus-visible`.
3. Hero scrim gradient — low risk, but should get a quick visual sign-off since it changes hero appearance globally.
4. CTA color unification — highest coordination cost since it touches templates across multiple pages, not just the homepage; do this last and only after the Ideate decision above is made.

## Test

- A/B test #1 and #3 (script defer + hero scrim) against current homepage bounce rate, segmented (not blended — insurance-industry benchmarks show blended bounce rate hides real signal), for at least one full business cycle before reading results.
- For #2 (focus outline), this isn't something to A/B test for bounce rate — it's a compliance/accessibility baseline fix; ship it and verify via manual keyboard-only walkthrough + a screen-reader spot check, not a conversion metric.
- For #4 (CTA color), A/B test the winning Ideate option against current mixed usage on the homepage specifically, measuring click-through on "Get a Term Quote" as the primary metric (not bounce rate directly — CTA color is a click-through lever, script defer/hero scrim are the bounce-rate levers).
