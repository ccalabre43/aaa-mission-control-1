# AAA Life homepage — ready-to-apply fixes

Source: `https://www.aaalife.com` homepage, audited via `verify-live-ux`. No local checkout of this site was found on disk (searched `~/Desktop` for matching class names — no match), so these are patch-ready snippets for your engineering team to apply against the actual Freemarker/AEM templates, not a diff against a repo in this workspace.

## 1. Hero text contrast scrim (`.row-hero .hero-title-content`)

Current (from `styles.css`):

```css
.row-hero .hero-title-content {
    padding: 40px 20px 40px 0;
    border-radius: 8px 0 0 8px;
}
```

Add a gradient scrim so white text contrast no longer depends on the underlying hero photo (currently 4.65:1 average, ~1.67:1 in bright regions — both measured against the live `hphero.jpg`):

```css
.row-hero .hero-title-content {
    padding: 40px 20px 40px 0;
    border-radius: 8px 0 0 8px;
    background: linear-gradient(90deg, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.35) 60%, transparent 100%);
}
```

This keeps white text at a stable ≥7:1 regardless of which hero photo is swapped in later.

## 2. Unified focus-visible outline token

A compliant pattern already exists in `styles.css` for the privacy modal (`#005ea8`, 6.63:1). Promote it to a global token and apply everywhere focus is currently weak or missing:

```css
:root {
    --focus-outline: 3px solid #005ea8;
    --focus-outline-offset: 2px;
}

/* Text/date/etc. inputs — currently outline:0 + a 1.64:1 box-shadow, fails 1.4.11 */
:focus,
[type=date]:focus, [type=datetime-local]:focus, [type=datetime]:focus, [type=email]:focus,
[type=month]:focus, [type=number]:focus, [type=password]:focus, [type=search]:focus,
[type=tel]:focus, [type=text]:focus, [type=time]:focus, [type=url]:focus, [type=week]:focus,
textarea:focus {
    outline: var(--focus-outline);
    outline-offset: var(--focus-outline-offset);
    /* keep existing border/box-shadow for the "active field" look, just add the outline */
}

/* Primary CTAs — currently rely only on a ~1.5:1 background shift with no outline */
.button.btn-blue:focus-visible,
.button.btn-pink:focus-visible {
    outline: var(--focus-outline);
    outline-offset: var(--focus-outline-offset);
}

/* Regression fix: this currently removes the outline with nothing replacing it */
.popup-content button.close-button:focus-visible {
    outline: var(--focus-outline);
    outline-offset: var(--focus-outline-offset);
}
```

Using `:focus-visible` (not `:focus`) keeps the outline keyboard-only, matching the pattern the privacy modal already uses, and avoids re-introducing an outline for mouse clicks where the existing hover treatment is enough.

## 3. Single primary-CTA color token

Currently three colors compete as "the important action": `.button.primary` (`#2199e8`, defined but not used on this page), `.btn-blue` (`#00529c`), `.btn-pink` (`#e31b2d`). Both `.btn-blue` and `.btn-pink` individually pass text-contrast (7.82:1 / 4.71:1), so this is a consistency fix, not a contrast fix — pick one and repoint the other's class usage at it in the templates:

```css
/* Example: standardize on btn-blue's color as the one primary CTA token, keep btn-pink
   only for a deliberately distinct secondary/urgent case if the business still wants one */
:root {
    --cta-primary-bg: #00529c;
    --cta-primary-bg-hover: #0b72d3;
}
.button.primary,
.button.btn-blue {
    background-color: var(--cta-primary-bg);
}
.button.primary:hover, .button.primary:focus-visible,
.button.btn-blue:hover, .button.btn-blue:focus-visible {
    background-color: var(--cta-primary-bg-hover);
}
```

Then in the Freemarker templates, change any "Get a Term Quote" instance still using `btn-pink` to `btn-blue` (or vice versa — pick the color that wins your Ideate step, see the sprint doc).

## 4. Defer non-critical scripts

Current script tags on the homepage (`<head>`/body, in this order):

```html
<script src="https://cdn.optimizely.com/js/17908878585.js"></script>
<script async="async" src="//widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js" type="text/javascript"></script>
<script src="https://www.youtube.com/iframe_api"></script>
<script src="https://maps.googleapis.com/maps/api/js?libraries=places&key=..."></script>
<script src="/webfiles/1783432527923/gen/js/vendors.js"></script>
<script src="/webfiles/1783432527923/gen/js/aaalife.js"></script>
```

Recommended:

```html
<script src="https://cdn.optimizely.com/js/17908878585.js" defer></script>
<script async="async" src="//widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js" type="text/javascript"></script>
<script src="https://www.youtube.com/iframe_api" defer></script>
<script src="https://maps.googleapis.com/maps/api/js?libraries=places&key=..." defer></script>
<script src="/webfiles/1783432527923/gen/js/vendors.js" defer></script>
<script src="/webfiles/1783432527923/gen/js/aaalife.js" defer></script>
```

Use `defer` (not `async`) for `vendors.js`/`aaalife.js` specifically — `defer` preserves execution order between the two, which `async` does not guarantee, and `aaalife.js` likely depends on `vendors.js` (jQuery, etc.) being loaded first. Trustpilot's existing `async` is fine as-is since it's independent, non-blocking, third-party content.

**Caveat**: verify none of these scripts write to the document with `document.write()` (common in older Optimizely/GTM snippets) before moving them, since `defer` changes *when* they run relative to DOM parsing completion, not just *whether* they block it.
