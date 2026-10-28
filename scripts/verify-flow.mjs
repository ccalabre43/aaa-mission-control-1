/**
 * Walks the full request flow in a real browser, screenshots every screen at desktop and mobile
 * widths, and computes contrast ratios from COMPUTED CSS rather than from the source or a
 * screenshot. Also exercises the keyboard path and checks a few structural accessibility facts.
 *
 * Uses the installed Google Chrome via Playwright's `chrome` channel, so no browser download and
 * no third-party network request is needed.
 *
 *   node scripts/verify-flow.mjs [baseUrl]
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { checkBundleCopy, checkCoverageSightings } from "./lib/copy-guard.mjs";

const BASE = process.argv[2] ?? "http://localhost:5173";
const OUT = "assets/exports/verify";
mkdirSync(OUT, { recursive: true });

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

/*
 * The auditable-negative guard lives in scripts/lib/copy-guard.mjs so it can be tested against a
 * fixture rather than only against whatever the current build happens to contain.
 */

/* ------------------------------------------------------------------ *
 * Contrast, computed in the page from resolved styles
 * ------------------------------------------------------------------ */
const CONTRAST_HELPERS = `
function parse(color) {
  const m = color.match(/rgba?\\(([^)]+)\\)/);
  if (!m) return null;
  const parts = m[1].split(',').map((v) => parseFloat(v.trim()));
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}
function effectiveBg(el) {
  let node = el;
  while (node) {
    const bg = parse(getComputedStyle(node).backgroundColor);
    if (bg && bg.a > 0.95) return bg;
    node = node.parentElement;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}
function lum({ r, g, b }) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a, b) {
  const l1 = lum(a);
  const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function toHex({ r, g, b }) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}
`;

/** Measures every text-bearing element actually rendered, and reports failures. */
async function measureText(page, label) {
  return page.evaluate(
    ({ label, helpers }) => {
      // eslint-disable-next-line no-eval
      eval(helpers);
      const results = [];
      const seen = new Set();
      for (const el of document.querySelectorAll("*")) {
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") continue;
        if (parseFloat(style.opacity) < 0.95) continue;
        // Only elements with their own visible text.
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .join(" ")
          .trim();
        if (!own) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        // Skip sr-only.
        if (rect.width <= 1 && rect.height <= 1) continue;
        const fg = parse(style.color);
        if (!fg || fg.a < 0.95) continue;
        const bg = effectiveBg(el);
        const r = ratio(fg, bg);
        const size = parseFloat(style.fontSize);
        const weight = parseInt(style.fontWeight, 10) || 400;
        // 1.4.3: large text is >=24px, or >=18.66px when bold.
        const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
        const required = isLarge ? 3 : 4.5;
        const key = `${toHex(fg)}|${toHex(bg)}|${Math.round(size)}|${weight}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          screen: label,
          text: own.slice(0, 48),
          fg: toHex(fg),
          bg: toHex(bg),
          size: Math.round(size * 10) / 10,
          weight,
          ratio: Math.round(r * 100) / 100,
          required,
          pass: r >= required - 0.005,
        });
      }
      return results;
    },
    { label, helpers: CONTRAST_HELPERS },
  );
}

/** Borders and fills of interactive controls, which need 3:1 under 1.4.11. */
async function measureNonText(page, label) {
  return page.evaluate(
    ({ label, helpers }) => {
      // eslint-disable-next-line no-eval
      eval(helpers);
      const results = [];
      const seen = new Set();
      const selector =
        "input, select, textarea, .aaa-dropzone, .aaa-stepper-dot, progress, .aaa-chip, .aaa-tool-icon";
      for (const el of document.querySelectorAll(selector)) {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        const bg = effectiveBg(el.parentElement ?? el);
        // Prefer the border; fall back to the element's own fill for dots and tiles.
        const borderColor = parse(style.borderTopColor);
        const hasBorder = parseFloat(style.borderTopWidth) > 0 && borderColor && borderColor.a > 0.5;
        const own = parse(style.backgroundColor);
        const subject = hasBorder ? borderColor : own && own.a > 0.5 ? own : null;
        if (!subject) continue;
        const r = ratio(subject, bg);
        const key = `${el.tagName}.${el.className}|${toHex(subject)}|${toHex(bg)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          screen: label,
          what: `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""}`,
          kind: hasBorder ? "border" : "fill",
          color: toHex(subject),
          against: toHex(bg),
          ratio: Math.round(r * 100) / 100,
          pass: r >= 2.995,
        });
      }
      return results;
    },
    { label, helpers: CONTRAST_HELPERS },
  );
}

/** Focus indicator contrast, measured against what the ring actually sits on (2.4.13, 1.4.11). */
async function measureFocusRing(page, selector, label) {
  return page.evaluate(
    ({ selector, label, helpers }) => {
      // eslint-disable-next-line no-eval
      eval(helpers);
      const el = document.querySelector(selector);
      if (!el) return null;
      el.focus();
      const style = getComputedStyle(el);
      const ring = parse(style.outlineColor);
      if (!ring) return null;
      // With a positive offset the ring sits on the ancestor background, not the field border.
      const offset = parseFloat(style.outlineOffset) || 0;
      const bg = effectiveBg(el.parentElement ?? el);
      return {
        screen: label,
        selector,
        ringColor: toHex(ring),
        width: style.outlineWidth,
        offset: `${offset}px`,
        against: toHex(bg),
        ratio: Math.round(ratio(ring, bg) * 100) / 100,
        pass: ratio(ring, bg) >= 2.995 && offset > 0,
      };
    },
    { selector, label, helpers: CONTRAST_HELPERS },
  );
}

/* ------------------------------------------------------------------ *
 * Flow walk
 * ------------------------------------------------------------------ */
async function fillStart(page) {
  await page.selectOption("#department", "Marketing");
  await page.fill("#first-name", "Dana");
  await page.fill("#last-name", "Reyes");
  await page.fill("#email", "dana.reyes@aaalife.com");
}

const CONTEXT_TEXT =
  "We want to promote a limited-time rate on term life coverage for members who do not have life insurance yet. We need a direct mail piece and supporting digital ads before the rate expires at the end of next month.";

const ANSWERS = [
  "Drive new term life applications by promoting a limited-time promotional rate before it expires.",
  "A cross-channel push on the promotional term life rate for members without coverage.",
  null, // choice group, answered by checking every option
  "One direct mail piece and three digital ads.",
  "Increase application starts among members who do not yet hold a life policy.",
  "Application starts and completed applications, measured against the prior quarter.",
  null, // date
  "The rate expires at the end of next month, so everything must land before then.",
  "Prior campaign assets are attached for reference.",
];

/** Filled in by `walk` at the Related activity step, asserted in the report section. */
const coverageSightings = [];

/** Multi-select questions answered with every option, plus what survived to the review step. */
const multiChoiceSightings = [];

/**
 * What the Request Queue actually said about its Workfront connection.
 *
 * Asserted rather than eyeballed because the whole design goal is a screen that looks send-ready
 * while stating plainly that nothing was sent. Those two things are one CSS change apart from each
 * other, and the failure mode is silent: the screen looks better and starts lying.
 */
const queueSightings = [];
const cardSightings = [];

/**
 * Exercises the dashboard grid: the column count at this viewport, a keyboard reorder that must
 * survive a reload, accessible names on every grip and checkbox, then add and delete through the
 * dialog.
 *
 * The reload is the point of the reorder check. A move that only holds until refresh is a move that
 * was never saved, and that is exactly the failure a purely visual check misses.
 */
async function exerciseCards(page, viewport, tag, shot, collect) {
  const sighting = { screen: tag };

  sighting.columns = await page.$eval(".aaa-tool-grid", (grid) =>
    getComputedStyle(grid).gridTemplateColumns.split(" ").length,
  );

  const names = async () =>
    page.$$eval(".aaa-tool-grid .aaa-tool-label", (nodes) =>
      nodes.map((node) => node.textContent.trim()),
    );
  sighting.initialOrder = await names();

  // Every grip must be named, and the manager must not have one.
  sighting.gripNames = await page.$$eval(".aaa-tool-handle", (nodes) =>
    nodes.map((node) => node.getAttribute("aria-label") ?? ""),
  );
  sighting.managerHasGrip = await page.$$eval(
    ".aaa-tool-cell",
    (cells) =>
      cells.some(
        (cell) =>
          cell.querySelector(".aaa-tool-card-manager") !== null &&
          cell.querySelector(".aaa-tool-handle") !== null,
      ),
  );

  /*
   * The grip is revealed on rollover, so check the reveal actually works. A hidden control that
   * never comes back is worse than a visible one that is always there, and the keyboard reveal is
   * the part most likely to rot: it depends on :focus-within, which is easy to drop in a refactor.
   */
  const reorderOpacity = async () =>
    page.$eval(".aaa-tool-cell .aaa-tool-reorder", (el) =>
      Number(getComputedStyle(el).opacity),
    );
  /*
   * Waits for the fade to finish before reading. Reading immediately catches the transition
   * mid-flight and reports something like 0.04, which looks like a broken reveal when it is only a
   * race. On a real failure this still resolves and the caller reports the stuck value.
   */
  const settledOpacity = async (target) => {
    await page
      .waitForFunction(
        (want) => {
          const el = document.querySelector(".aaa-tool-cell .aaa-tool-reorder");
          return el !== null && Number(getComputedStyle(el).opacity) === want;
        },
        target,
        { timeout: 2000 },
      )
      .catch(() => {});
    return reorderOpacity();
  };

  sighting.gripIdleOpacity = await reorderOpacity();
  await page.hover(".aaa-tool-cell");
  sighting.gripHoverOpacity = await settledOpacity(1);
  // Mousing out must hide it again. That is the whole point of a rollover affordance, and it broke
  // once already: clicking the grip focused it, and a :focus-within reveal then pinned it visible.
  await page.mouse.move(5, 5);
  sighting.gripMouseOutOpacity = await settledOpacity(0);

  /*
   * Tabbed with a real keyboard rather than focused programmatically. The reveal keys off
   * :focus-visible, which depends on the input modality, so a scripted .focus() following mouse
   * movement would not match it - the check would report a failure no real keyboard user ever sees.
   */
  const tabToGrip = async (position) => {
    for (let i = 0; i < 40; i += 1) {
      const label = await page.evaluate(() => {
        const el = document.activeElement;
        return el instanceof HTMLElement && el.classList.contains("aaa-tool-handle")
          ? el.getAttribute("aria-label")
          : null;
      });
      if (label && label.includes(`position ${position} of`)) return true;
      await page.keyboard.press("Tab");
    }
    return false;
  };

  sighting.tabbedToGrip = await tabToGrip(1);
  // Keyboard focus alone must reveal it, or a keyboard user is aiming at something invisible.
  sighting.gripFocusOpacity = await settledOpacity(1);

  // Keyboard route: reach the second card's grip and move it left with an arrow key alone.
  if (await tabToGrip(2)) {
    await page.keyboard.press("ArrowLeft");
    sighting.afterKeyboardMove = await names();
    sighting.announced = await page
      .$eval('.aaa-home [role="status"]', (el) => el.textContent.trim())
      .catch(() => "");
    // Focus must stay on a grip, or a keyboard user is stranded after one move.
    sighting.focusKeptGrip = await page.evaluate(() =>
      document.activeElement?.classList.contains("aaa-tool-handle") ?? false,
    );

    await page.reload({ waitUntil: "networkidle" });
    sighting.afterReload = await names();
  }

  // Armed mode: the grip must reveal the Move buttons, the WCAG 2.5.7 no-drag alternative.
  const firstGrip = await page.$(".aaa-tool-handle");
  if (firstGrip) {
    await firstGrip.click();
    sighting.nudgeNames = await page.$$eval(".aaa-tool-nudge", (nodes) =>
      nodes.map((node) => node.getAttribute("aria-label") ?? ""),
    );
    await shot("1b-home-armed");

    // Mousing out must cancel the armed state as well as hide the grip. Otherwise the card stays
    // armed and the Move buttons stay mounted with nothing on screen saying so.
    await page.mouse.move(5, 5);
    await page
      .waitForFunction(() => document.querySelectorAll(".aaa-tool-nudge").length === 0, null, {
        timeout: 2000,
      })
      .catch(() => {});
    sighting.nudgesAfterMouseOut = await page.$$eval(".aaa-tool-nudge", (n) => n.length);
    sighting.armedAfterMouseOut = await page.$$eval(
      '.aaa-tool-handle[aria-pressed="true"]',
      (n) => n.length,
    );

    await page.keyboard.press("Escape");
  }

  // The dialog: add a card, confirm it is honest about having nowhere to go, then delete it.
  await page.click(".aaa-tool-card-manager");
  await page.waitForSelector('[role="dialog"]');
  await collect(page, `${tag} add tools dialog`);

  sighting.checkboxNames = await page.$$eval(
    ".aaa-card-check input[type=checkbox]",
    (nodes) =>
      nodes.map((node) => node.closest("label")?.textContent?.trim() ?? ""),
  );
  sighting.pinnedRows = await page.$$eval(".aaa-card-pinned", (nodes) => nodes.length);

  await page.fill("#card-title", "Verify Card");
  await page.fill("#card-description", "Added by verify-flow");
  await shot("1c-add-tools");
  await page.click('button:has-text("Add card")');
  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="dialog"]', { state: "detached" });

  sighting.afterAdd = await names();
  // An added card has no destination, so it must render as unavailable rather than as a live link.
  sighting.addedIsHonest = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".aaa-tool-cell")];
    const added = cards.find((cell) =>
      cell.querySelector(".aaa-tool-label")?.textContent?.includes("Verify Card"),
    );
    if (!added) return null;
    return {
      soon: added.querySelector(".aaa-tool-card-soon") !== null,
      isLink: added.querySelector("a") !== null,
      note: added.querySelector(".aaa-tool-soon")?.textContent?.trim() ?? "",
    };
  });
  await shot("1d-home-added");

  // Added cards must survive a reload too, or nothing was persisted.
  await page.reload({ waitUntil: "networkidle" });
  sighting.addedAfterReload = await names();

  // Delete it again, exercising the two-step confirm.
  await page.click(".aaa-tool-card-manager");
  await page.waitForSelector('[role="dialog"]');
  const row = page
    .locator(".aaa-card-row", { hasText: "Verify Card" })
    .locator("input[type=checkbox]");
  await row.check();
  await page.click('.aaa-modal-listhead button:has-text("Delete")');
  sighting.confirmPrompt = await page
    .$eval(".aaa-modal-confirm-prompt", (el) => el.textContent.trim())
    .catch(() => "");
  await page.click('button:has-text("Yes, remove")');
  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="dialog"]', { state: "detached" });
  sighting.afterDelete = await names();

  cardSightings.push(sighting);
}

async function walk(page, viewport, tag, collect) {
  await page.setViewportSize(viewport);
  const shot = async (name) => {
    await page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: false });
  };

  // 1. Home
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await shot("1-home");
  await collect(page, `${tag} home`);
  await exerciseCards(page, viewport, tag, shot, collect);

  // 2. Start
  await page.goto(`${BASE}/request`, { waitUntil: "networkidle" });
  await shot("2-start");
  await collect(page, `${tag} start`);
  await fillStart(page);
  await page.click('button:has-text("Start request")');

  // 3. Context
  await page.waitForSelector("#context-text");
  await page.fill("#context-text", CONTEXT_TEXT);
  await page.click('button:has-text("I have an ALAN number")');
  await page.waitForSelector('input[list], input[placeholder="ALAN-00000-000-00"]');
  await page.fill('input[placeholder="ALAN-00000-000-00"]', "ALAN-29541-624-00");
  await shot("3-context");
  await collect(page, `${tag} context`);
  await page.click('button:has-text("Next")');

  // 4. Guided questions
  await page.waitForSelector(".aaa-progress");
  for (let i = 0; i < ANSWERS.length; i += 1) {
    if (i === 0) {
      await shot("4-questions");
      await collect(page, `${tag} questions`);
    }
    const answer = ANSWERS[i];
    const checkboxes = await page.$$(".aaa-fieldset input[type=checkbox]");
    const radio = await page.$(".aaa-fieldset input[type=radio]");
    const date = await page.$('input[type="date"]');
    if (checkboxes.length > 0) {
      /*
       * Check every box, not just the first. Selecting several is the interesting case: the value
       * becomes a joined string that has to survive assembly and the review step's edit control.
       * Checking one would pass even if multi-select were silently broken.
       */
      for (const box of checkboxes) await box.check();
      multiChoiceSightings.push({
        screen: tag,
        count: checkboxes.length,
        note: await page
          .$eval('.aaa-field-group p[role="status"]', (el) => el.textContent.trim())
          .catch(() => null),
      });
    } else if (radio) {
      await radio.check();
    } else if (date) {
      await date.fill("2026-10-31");
    } else if (answer) {
      const field = await page.$("textarea:not(#context-text)");
      if (field) await field.fill(answer);
    }
    const next = await page.$(
      'button:has-text("Next"), button:has-text("Review related activity")',
    );
    if (!next) break;
    await next.click();
    await page.waitForTimeout(120);
  }

  // 5. Related activity
  await page.waitForSelector('button:has-text("Draft my brief")', { timeout: 5000 });
  await page.waitForTimeout(700); // let the debounced matcher settle
  await shot("5-related");
  await collect(page, `${tag} related`);

  // Whatever the matcher concluded, the coverage disclosure must be on screen and must name the
  // corpus. Captured here because this is the only point in the run where the panel is rendered.
  coverageSightings.push({
    screen: tag,
    coverage: await page
      .$eval(".aaa-related-coverage", (el) => el.textContent.trim())
      .catch(() => null),
    empty: await page
      .$eval(".aaa-related-empty", (el) => el.textContent.trim())
      .catch(() => null),
  });
  await page.click('button:has-text("Draft my brief")');

  // 6. Review draft (Generating is transient by design)
  await page.waitForSelector('button:has-text("Submit request")', { timeout: 5000 });
  await shot("6-review");
  await collect(page, `${tag} review`);

  // Did both selected teams reach the assembled brief, or did one get dropped on the way?
  const sighting = multiChoiceSightings.find((item) => item.screen === tag);
  if (sighting) {
    sighting.reviewText = await page
      .$$eval(".aaa-review-text", (nodes) =>
        nodes.map((node) => node.textContent.trim()),
      )
      .then((texts) => texts.find((text) => text.includes(",")) ?? null)
      .catch(() => null);
  }

  await page.click('button:has-text("Submit request")');

  // 7. Confirmed
  await page.waitForSelector('button:has-text("Start another request")', {
    timeout: 5000,
  });
  await shot("7-confirmed");
  await collect(page, `${tag} confirmed`);

  // Admin view and tracker
  await page.goto(`${BASE}/settings/questions`, { waitUntil: "networkidle" });
  await shot("8-questions-admin");
  await collect(page, `${tag} manage questions`);

  /*
   * The Request Queue, reached after the flow so one submitted request exists and the list renders
   * real content. Contrast measured on an empty state would prove nothing about the table.
   */
  await page.goto(`${BASE}/deliverables`, { waitUntil: "networkidle" });
  await page.waitForSelector(".aaa-queue-connection");
  await shot("9-deliverables");
  await collect(page, `${tag} request queue`);

  const queueSighting = {
    screen: tag,
    connection: await page
      .$eval(".aaa-queue-connection", (el) => el.textContent.trim())
      .catch(() => null),
    // Present in the table on desktop and in the cards on mobile; both must say No.
    sentCells: await page
      .$$eval(".aaa-queue-sent, .aaa-queue-card-list dd", (nodes) =>
        nodes.map((node) => node.textContent.trim()),
      )
      .catch(() => []),
    filters: await page
      .$$eval(".aaa-queue-filter", (nodes) => nodes.map((node) => node.textContent.trim()))
      .catch(() => []),
    /*
     * `:visible` again. The table and the card list both render every request and one of the two is
     * always display:none, so counting both reported two rows for one request - which looked like
     * upsertBrief inserting where it should update, and cost a probe to rule out.
     */
    rows: await page
      .$$eval(".aaa-queue-table tbody tr:visible, .aaa-queue-card:visible", (nodes) => nodes.length)
      .catch(() => 0),
    // Two sections, two headings. The tracker must not read as part of the request list.
    sectionHeadings: await page
      .$$eval(".aaa-queue-heading", (nodes) => nodes.map((node) => node.textContent.trim()))
      .catch(() => []),
  };

  // Every filter is clicked, because a filter that throws or empties the list is only visible when
  // it is used. Drafts is checked last so the screenshot below shows the submitted list.
  for (const label of ["Open", "My Requests", "My Open Requests", "Drafts", "All"]) {
    const button = await page.$(`.aaa-queue-filter:has-text("${label}")`);
    if (button) {
      await button.click();
      await page.waitForTimeout(80);
    }
  }
  queueSighting.filterNote = await page
    .$eval(".aaa-queue-filter-note", (el) => el.textContent.trim())
    .catch(() => null);

  /*
   * The summary panel, then its payload tab. The payload view is what makes the screen genuinely
   * send-ready rather than merely send-looking, so it is measured for contrast too.
   *
   * `:visible` matters. The table and the card list both render a Summary button and one of the two
   * is always display:none, so the first DOM match is the hidden one at mobile width - which is
   * exactly how this first failed.
   */
  const summaryButton = await page.$(
    '.aaa-queue-actions button:has-text("Summary"):visible',
  );
  if (summaryButton) {
    await summaryButton.click();
    await page.waitForSelector('[role="dialog"]');
    await shot("10-queue-summary");
    await collect(page, `${tag} queue summary panel`);
    queueSighting.panelSent = await page
      .$$eval('[role="dialog"] dd', (nodes) => nodes.map((node) => node.textContent.trim()))
      .catch(() => []);

    await page.click('button:has-text("Workfront payload")');
    await page.waitForSelector(".aaa-panel-payload");
    await shot("11-queue-payload");
    await collect(page, `${tag} queue payload`);
    queueSighting.payload = await page
      .$eval(".aaa-panel-payload", (el) => el.textContent.trim())
      .catch(() => null);

    // Escape must close it. A dialog a keyboard user cannot leave is worse than no dialog.
    await page.keyboard.press("Escape");
    queueSighting.escapeClosed = (await page.$('[role="dialog"]')) === null;
  }

  queueSightings.push(queueSighting);

  await page.goto(`${BASE}/settings/queue`, { waitUntil: "networkidle" });
  await shot("12-queue-admin");
  await collect(page, `${tag} manage queue`);
}

/* ------------------------------------------------------------------ *
 * Structural accessibility checks
 * ------------------------------------------------------------------ */
async function structuralChecks(page) {
  const problems = [];

  await page.goto(`${BASE}/request`, { waitUntil: "networkidle" });

  // Exactly one h1 per screen (1.3.1).
  const h1s = await page.$$eval("h1", (nodes) => nodes.map((n) => n.textContent.trim()));
  if (h1s.length !== 1) problems.push(`Start screen has ${h1s.length} h1 elements: ${h1s}`);

  // Every form control has an accessible name (4.1.2, 3.3.2).
  const unnamed = await page.$$eval(
    "input:not([type=hidden]), select, textarea",
    (nodes) =>
      nodes
        .filter((n) => {
          if (n.closest(".sr-only")) return false;
          const id = n.getAttribute("id");
          const labelled =
            (id && document.querySelector(`label[for="${id}"]`)) ||
            n.closest("label") ||
            n.getAttribute("aria-label") ||
            n.getAttribute("aria-labelledby");
          return !labelled;
        })
        .map((n) => n.outerHTML.slice(0, 90)),
  );
  if (unnamed.length > 0) problems.push(`Controls with no accessible name: ${unnamed}`);

  // Keyboard: tab from the top must reach the skip link first, then the form.
  // The earlier evaluate() calls can leave a stale focus target, so reset to the document the way
  // a genuine fresh page load does before measuring the first tab stop.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => {
    const el = document.activeElement;
    return el ? `${el.tagName}:${el.className}` : "none";
  });
  if (!first.includes("aaa-skip-link")) {
    problems.push(`First tab stop is ${first}, expected the skip link`);
  }

  // The whole start form must be reachable and submittable by keyboard alone.
  await fillStart(page);
  const reachable = await page.evaluate(() => {
    const focusable = Array.from(
      document.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    });
    return focusable.length;
  });
  if (reachable < 6) problems.push(`Only ${reachable} focusable controls on the start screen`);

  // Heading focus on step change must not paint a focus ring.
  await page.click('button:has-text("Start request")');
  await page.waitForSelector("#context-text");
  const headingOutline = await page.evaluate(() => {
    const h1 = document.querySelector("h1[tabindex='-1']");
    if (!h1) return "missing";
    h1.focus();
    return `${document.activeElement === h1}|${getComputedStyle(h1).outlineStyle}`;
  });
  if (!headingOutline.startsWith("true")) {
    problems.push(`Step heading did not take focus: ${headingOutline}`);
  }

  // The stepper must actually advance, asserted rather than eyeballed. The header learns the step
  // from an effect, so it settles one commit after the question content appears; wait for the
  // stepper itself rather than reading as soon as the question is on screen.
  const stepperOnQuestions = await (async () => {
    await page.fill("#context-text", "Promote a limited-time term life rate to members.");
    await page.click('button:has-text("Next")');
    await page.waitForSelector(".aaa-progress");
    await page.waitForFunction(
      () => document.querySelector(".aaa-stepper-item.aaa-stepper-done") !== null,
      null,
      { timeout: 2000 },
    );
    return page.$$eval(".aaa-stepper-item", (items) =>
      items.map((li) => ({
        text: li.querySelector(".aaa-stepper-label").textContent.replace(/\s*\(.*/, "").trim(),
        state: li.className.replace("aaa-stepper-item aaa-stepper-", ""),
        current: li.querySelector(".aaa-stepper-label").getAttribute("aria-current"),
      })),
    );
  })();
  const current = stepperOnQuestions.find((s) => s.state === "current");
  if (current?.text !== "Guided questions") {
    problems.push(
      `On the questions step the stepper marks "${current?.text}" as current, expected "Guided questions"`,
    );
  }
  const done = stepperOnQuestions.filter((s) => s.state === "done").map((s) => s.text);
  if (done.join() !== "Context") {
    problems.push(`Expected only Context marked done, got [${done.join(", ")}]`);
  }
  // aria-current must be on exactly one stage (4.1.2).
  const currents = stepperOnQuestions.filter((s) => s.current === "step").length;
  if (currents !== 1) problems.push(`${currents} stages carry aria-current="step", expected 1`);

  // Reduced motion must actually stop the spinner.
  const reducedOk = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "aaa-spinner";
    document.body.appendChild(probe);
    const duration = getComputedStyle(probe).animationDuration;
    probe.remove();
    return duration;
  });

  return { problems, spinnerDuration: reducedOk };
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */
const browser = await chromium.launch({ channel: "chrome" });

const textResults = [];
const nonTextResults = [];
const focusResults = [];

for (const [tag, viewport] of [
  ["desktop", DESKTOP],
  ["mobile", MOBILE],
]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await walk(page, viewport, tag, async (p, label) => {
    textResults.push(...(await measureText(p, label)));
    nonTextResults.push(...(await measureNonText(p, label)));
  });
  await context.close();
}

// Focus rings, on a field and on a button.
{
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  await page.goto(`${BASE}/request`, { waitUntil: "networkidle" });
  for (const selector of ["#first-name", "#department", 'button[type="submit"]']) {
    const result = await measureFocusRing(page, selector, "start");
    if (result) focusResults.push(result);
  }
  await context.close();
}

// Structural checks, plus the same run under prefers-reduced-motion.
const structural = await (async () => {
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  const out = await structuralChecks(page);
  await context.close();
  return out;
})();

const reducedMotion = await (async () => {
  const context = await browser.newContext({
    viewport: DESKTOP,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/request`, { waitUntil: "networkidle" });
  const duration = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "aaa-spinner";
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).animationDuration;
    probe.remove();
    return value;
  });
  await context.close();
  return duration;
})();

await browser.close();

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */
const textFails = textResults.filter((r) => !r.pass);
const nonTextFails = nonTextResults.filter((r) => !r.pass);
const focusFails = focusResults.filter((r) => !r.pass);

console.log(`\nText pairings measured: ${textResults.length}`);
console.log(`Non-text pairings measured: ${nonTextResults.length}`);
console.log(`Focus rings measured: ${focusResults.length}`);

console.log("\n--- 1.4.3 text contrast failures ---");
if (textFails.length === 0) console.log("none");
for (const r of textFails) {
  console.log(
    `  FAIL ${r.ratio}:1 (need ${r.required}) ${r.fg} on ${r.bg} ${r.size}px/${r.weight} [${r.screen}] "${r.text}"`,
  );
}

console.log("\n--- 1.4.11 non-text contrast failures ---");
if (nonTextFails.length === 0) console.log("none");
for (const r of nonTextFails) {
  console.log(
    `  FAIL ${r.ratio}:1 ${r.what} ${r.kind} ${r.color} on ${r.against} [${r.screen}]`,
  );
}

console.log("\n--- focus indicators ---");
for (const r of focusResults) {
  console.log(
    `  ${r.pass ? "PASS" : "FAIL"} ${r.ratio}:1 ${r.selector} ring ${r.ringColor} ${r.width} offset ${r.offset} on ${r.against}`,
  );
}

/* Auditable-negative guard: the built copy plus what was actually on screen. */
const coverageProblems = [
  ...checkBundleCopy(),
  ...checkCoverageSightings(coverageSightings),
];
console.log("\n--- auditable negative result ---");
if (coverageProblems.length === 0) {
  console.log("  no banned phrasing in the bundle; coverage disclosure names its corpus");
  for (const s of coverageSightings) console.log(`  [${s.screen}] "${s.coverage}"`);
}
for (const p of coverageProblems) console.log(`  PROBLEM ${p}`);

/*
 * Multi-select round trip. The failure this catches is silent: a two-team answer that assembles or
 * re-renders as one team still produces a submittable brief, just the wrong one.
 */
const multiProblems = [];
if (multiChoiceSightings.length === 0) {
  multiProblems.push(
    "No multi-select question was reached; the team-routing question should offer checkboxes",
  );
}
for (const s of multiChoiceSightings) {
  if (s.count < 2) {
    multiProblems.push(`[${s.screen}] only ${s.count} option offered, expected at least 2`);
  }
  if (!s.note) {
    multiProblems.push(
      `[${s.screen}] selecting several options showed no explanation of what that does`,
    );
  }
  if (!s.reviewText || !s.reviewText.includes(",")) {
    multiProblems.push(
      `[${s.screen}] review shows "${s.reviewText}" - both selected teams did not survive assembly`,
    );
  }
}
console.log("\n--- multi-select round trip ---");
if (multiProblems.length === 0) {
  for (const s of multiChoiceSightings) {
    console.log(`  [${s.screen}] ${s.count} options, review kept "${s.reviewText}"`);
  }
}
for (const p of multiProblems) console.log(`  PROBLEM ${p}`);

/*
 * The Request Queue's honesty checks. Everything here is about the gap between looking connected and
 * claiming to be connected, which is the one thing this screen could get badly wrong.
 */
const queueProblems = [];
if (queueSightings.length === 0) {
  queueProblems.push("The Request Queue was never reached");
}
for (const s of queueSightings) {
  if (!s.connection || !s.connection.includes("not connected")) {
    queueProblems.push(
      `[${s.screen}] the queue header reads "${s.connection}" - it must say Workfront is not connected`,
    );
  }
  if (s.rows === 0) {
    queueProblems.push(
      `[${s.screen}] no rows rendered, so nothing on this screen was actually measured`,
    );
  }
  if (s.filters.length !== 5) {
    queueProblems.push(
      `[${s.screen}] ${s.filters.length} filters found, expected Workfront's four plus Drafts: ${s.filters.join(", ")}`,
    );
  }
  // Both sections must be labelled, so the tracker cannot be read as part of the request list.
  if (!s.sectionHeadings.includes("Requests") || !s.sectionHeadings.includes("Project tracker")) {
    queueProblems.push(
      `[${s.screen}] section headings are [${s.sectionHeadings.join(", ")}], expected Requests and Project tracker`,
    );
  }
  if (!s.sentCells.some((text) => text === "No")) {
    queueProblems.push(
      `[${s.screen}] no row states "No" for Sent to Workfront: ${JSON.stringify(s.sentCells.slice(0, 8))}`,
    );
  }
  if (!s.payload || !s.payload.includes("queueTopicID")) {
    queueProblems.push(
      `[${s.screen}] the payload view did not render the real Workfront field names`,
    );
  }
  // A payload that shows a queue topic ID would mean the app invented one. The character class has
  // to exclude the closing quote: `"\S` matches an empty string's own closing quote and reports
  // every correct payload as a failure.
  if (s.payload && /"queueTopicID":\s*"[^"]/.test(s.payload)) {
    queueProblems.push(
      `[${s.screen}] the payload carries a queue topic ID, but no Workfront ID has been supplied - it must be empty`,
    );
  }
  if (s.escapeClosed === false) {
    queueProblems.push(`[${s.screen}] Escape did not close the summary panel`);
  }
}
console.log("\n--- request queue honesty ---");
if (queueProblems.length === 0) {
  for (const s of queueSightings) {
    console.log(
      `  [${s.screen}] "${s.connection}", ${s.rows} row(s), ${s.filters.length} filters, Escape closed the panel: ${s.escapeClosed}`,
    );
  }
}
for (const p of queueProblems) console.log(`  PROBLEM ${p}`);

const cardProblems = [];
if (cardSightings.length === 0) {
  cardProblems.push("the dashboard grid was never exercised, so nothing about it was verified");
}
for (const s of cardSightings) {
  const expectedColumns = s.screen === "desktop" ? 4 : 2;
  if (s.columns !== expectedColumns) {
    cardProblems.push(
      `[${s.screen}] the grid rendered ${s.columns} column(s), expected ${expectedColumns}`,
    );
  }
  // Three orderable cards ship by default; the manager must not be one of them.
  if (s.gripNames.length !== 3) {
    cardProblems.push(
      `[${s.screen}] ${s.gripNames.length} grip(s) found, expected 3 - the manager must not have one`,
    );
  }
  if (s.managerHasGrip) {
    cardProblems.push(
      `[${s.screen}] the Add Tools card has a reorder grip, but it is pinned last and must not move`,
    );
  }
  const unnamedGrip = s.gripNames.find((name) => !/position \d+ of \d+/.test(name));
  if (unnamedGrip !== undefined) {
    cardProblems.push(
      `[${s.screen}] a grip's name does not state its position: ${JSON.stringify(unnamedGrip)}`,
    );
  }
  if (String(s.afterKeyboardMove) === String(s.initialOrder)) {
    cardProblems.push(
      `[${s.screen}] an arrow key did not reorder the grid: still ${s.initialOrder.join(" / ")}`,
    );
  }
  if (String(s.afterReload) !== String(s.afterKeyboardMove)) {
    cardProblems.push(
      `[${s.screen}] the reorder did not survive a reload: ${s.afterKeyboardMove?.join(" / ")} became ${s.afterReload?.join(" / ")}`,
    );
  }
  // The grip is opacity-hidden, never display:none - it has to stay in the tab order.
  if (s.gripHoverOpacity !== 1) {
    cardProblems.push(
      `[${s.screen}] hovering a card did not reveal its grip (opacity ${s.gripHoverOpacity})`,
    );
  }
  if (s.gripMouseOutOpacity !== 0) {
    cardProblems.push(
      `[${s.screen}] the grip stayed visible after the pointer left the card (opacity ${s.gripMouseOutOpacity})`,
    );
  }
  if (s.tabbedToGrip === false) {
    cardProblems.push(
      `[${s.screen}] a grip could not be reached by tabbing, so reordering is mouse-only`,
    );
  }
  if (s.gripFocusOpacity !== 1) {
    cardProblems.push(
      `[${s.screen}] focusing a grip did not reveal it (opacity ${s.gripFocusOpacity}) - a keyboard user cannot see where focus is`,
    );
  }
  if (s.focusKeptGrip === false) {
    cardProblems.push(
      `[${s.screen}] focus left the grip after a keyboard move, stranding a keyboard user`,
    );
  }
  if (!/position \d+ of \d+/.test(s.announced ?? "")) {
    cardProblems.push(
      `[${s.screen}] the move was not announced with its new position: ${JSON.stringify(s.announced)}`,
    );
  }
  // 2.5.7 Dragging Movements: there must be a no-drag route, and it must be named.
  if ((s.nudgeNames ?? []).length !== 2) {
    cardProblems.push(
      `[${s.screen}] arming a grip revealed ${(s.nudgeNames ?? []).length} Move button(s), expected 2 - a drag-only control fails WCAG 2.5.7`,
    );
  }
  for (const name of s.nudgeNames ?? []) {
    if (!/^Move .+ (left|right)$/.test(name)) {
      cardProblems.push(`[${s.screen}] a Move button is not clearly named: ${JSON.stringify(name)}`);
    }
  }
  if (s.nudgesAfterMouseOut !== 0 || s.armedAfterMouseOut !== 0) {
    cardProblems.push(
      `[${s.screen}] the card stayed armed after the pointer left it: ${s.nudgesAfterMouseOut} Move button(s), ${s.armedAfterMouseOut} pressed grip(s) - an active state nobody can see`,
    );
  }
  const unnamedBox = (s.checkboxNames ?? []).find((name) => !/^Select .+/.test(name));
  if (unnamedBox !== undefined || (s.checkboxNames ?? []).length === 0) {
    cardProblems.push(
      `[${s.screen}] a Current dashboard checkbox has no usable name: ${JSON.stringify(s.checkboxNames)}`,
    );
  }
  if (s.pinnedRows !== 1) {
    cardProblems.push(
      `[${s.screen}] ${s.pinnedRows} row(s) marked as pinned, expected exactly 1 for Add Tools`,
    );
  }
  if (!s.afterAdd?.includes("Verify Card")) {
    cardProblems.push(`[${s.screen}] the added card never appeared on the dashboard`);
  }
  // Checked without an intervening reload on purpose. Storage normalized the order while state did
  // not, so a reload hid the defect: Add Tools sat mid-grid until the page happened to refresh.
  if ((s.afterAdd ?? []).at(-1) !== "Add Tools") {
    cardProblems.push(
      `[${s.screen}] Add Tools is not last immediately after adding: ${s.afterAdd?.join(" / ")}`,
    );
  }
  if (!s.addedAfterReload?.includes("Verify Card")) {
    cardProblems.push(`[${s.screen}] the added card did not survive a reload, so it was not saved`);
  }
  // An added card is a placeholder. Rendering it as a working link would be the dishonest outcome.
  if (!s.addedIsHonest?.soon || s.addedIsHonest?.isLink) {
    cardProblems.push(
      `[${s.screen}] the added card does not render as unavailable: ${JSON.stringify(s.addedIsHonest)}`,
    );
  }
  if (s.addedIsHonest?.note !== "Not built yet") {
    cardProblems.push(
      `[${s.screen}] the added card does not say it is not built yet: ${JSON.stringify(s.addedIsHonest?.note)}`,
    );
  }
  if (!/remove/i.test(s.confirmPrompt ?? "")) {
    cardProblems.push(
      `[${s.screen}] Delete did not ask for confirmation first: ${JSON.stringify(s.confirmPrompt)}`,
    );
  }
  if (s.afterDelete?.includes("Verify Card")) {
    cardProblems.push(`[${s.screen}] the deleted card is still on the dashboard`);
  }
  // The dashboard must never end up empty, and Add Tools must stay reachable and last.
  if ((s.afterDelete ?? []).at(-1) !== "Add Tools") {
    cardProblems.push(
      `[${s.screen}] Add Tools is not the last card after editing: ${s.afterDelete?.join(" / ")}`,
    );
  }
}
console.log("\n--- dashboard cards ---");
if (cardProblems.length === 0) {
  for (const s of cardSightings) {
    console.log(
      `  [${s.screen}] ${s.columns} columns, grip opacity idle ${s.gripIdleOpacity} / hover ${s.gripHoverOpacity} / mouse-out ${s.gripMouseOutOpacity} / keyboard focus ${s.gripFocusOpacity}, keyboard move held across reload (${s.afterReload?.join(" / ")}), add and delete both persisted`,
    );
  }
}
for (const p of cardProblems) console.log(`  PROBLEM ${p}`);

console.log("\n--- structure and keyboard ---");
if (structural.problems.length === 0) console.log("  no problems found");
for (const p of structural.problems) console.log(`  PROBLEM ${p}`);
console.log(`  spinner animation-duration, normal:  ${structural.spinnerDuration}`);
console.log(`  spinner animation-duration, reduced: ${reducedMotion}`);

const lowest = [...textResults].sort((a, b) => a.ratio - b.ratio).slice(0, 6);
console.log("\n--- six lowest text ratios actually rendered ---");
for (const r of lowest) {
  console.log(
    `  ${r.ratio}:1 (need ${r.required}) ${r.fg} on ${r.bg} ${r.size}px/${r.weight} "${r.text}"`,
  );
}

const failed =
  textFails.length +
  nonTextFails.length +
  focusFails.length +
  structural.problems.length +
  coverageProblems.length +
  multiProblems.length +
  queueProblems.length +
  cardProblems.length;
console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} PROBLEM(S) FOUND`}`);
process.exit(failed === 0 ? 0 : 1);
