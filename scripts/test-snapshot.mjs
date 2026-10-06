/**
 * Exercises local saved versions of the Request Queue against a real browser.
 *
 * Separate from verify-flow.mjs on purpose. That script walks the request flow and measures
 * accessibility; this one is about whether data survives a round trip, which needs file downloads and
 * uploads and a deliberately corrupted input. Mixing them would make both harder to read.
 *
 * The bad-file cases are the point of this script rather than a footnote. An importer that accepts a
 * file it does not understand is worse than no importer, because it replaces real work with a
 * confident-looking partial restore.
 *
 *   node scripts/test-snapshot.mjs [baseUrl]
 */
import { chromium } from "playwright-core";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:5173";
const FORMAT = "aaa-mission-control-queue-snapshot";

const failures = [];
const pass = (label) => console.log(`  PASS ${label}`);
const check = (condition, label, detail) => {
  if (condition) pass(label);
  else {
    failures.push(`${label}${detail ? ` - ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? ` - ${detail}` : ""}`);
  }
};

const dir = mkdtempSync(join(tmpdir(), "mc-snapshot-"));

/** Every file a user could plausibly pick by mistake, plus one written by a future version. */
const BAD_FILES = [
  {
    name: "newer-schema.json",
    body: JSON.stringify({
      meta: { format: FORMAT, schemaVersion: 99, createdAt: new Date().toISOString(), origin: "x" },
      data: { "aaa-intake-briefs": "[]" },
    }),
    expect: /newer version/i,
    why: "a snapshot from a newer schema is refused rather than partially applied",
  },
  {
    name: "not-json.json",
    body: "this is not json at all {",
    expect: /not valid JSON/i,
    why: "a file that is not JSON is refused",
  },
  {
    name: "wrong-format.json",
    body: JSON.stringify({ meta: { format: "some-other-tool", schemaVersion: 1 }, data: {} }),
    expect: /not a Mission Control queue snapshot/i,
    why: "another tool's JSON is refused by format",
  },
  {
    name: "no-header.json",
    body: JSON.stringify({ data: { "aaa-intake-briefs": "[]" } }),
    expect: /no snapshot header/i,
    why: "a file with no header is refused",
  },
];

for (const file of BAD_FILES) writeFileSync(join(dir, file.name), file.body);

// Not a bad file: an unrecognized key must warn and still import, or a snapshot from a slightly
// different build would be unusable.
const UNKNOWN_KEY_FILE = join(dir, "unknown-key.json");
writeFileSync(
  UNKNOWN_KEY_FILE,
  JSON.stringify({
    meta: {
      format: FORMAT,
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      origin: "http://example.invalid",
      counts: {},
    },
    data: { "aaa-intake-briefs": "[]", "some-rogue-key": "[]" },
  }),
);

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1400, height: 1000 },
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

const FILE_INPUT = "input[type=file][accept*=json]";
const visibleRows = () =>
  page.$$eval(".aaa-queue-table tbody tr:visible", (rows) => rows.length);
const draftCount = async () => {
  const label = await page
    .$eval('button:has-text("Drafts")', (el) => el.textContent.trim())
    .catch(() => "");
  const match = label.match(/\((\d+)\)/);
  return match ? Number(match[1]) : 0;
};

await page.goto(`${BASE}/deliverables`, { waitUntil: "networkidle" });

console.log("sample requests");
await page.click('button:has-text("Load sample requests")');
await page.waitForTimeout(500);
const loaded = await visibleRows();
const drafts = await draftCount();
// Four submitted plus one draft. The draft is excluded from All, matching Workfront's Submitted
// Requests list, so the visible count is deliberately one short of the five that exist.
check(loaded === 4, "loading samples fills the queue", `${loaded} visible rows, expected 4`);
check(drafts === 1, "the sample draft lands in the Drafts filter", `Drafts (${drafts})`);

// `cells` rather than `td:first-child`: the Name cell is a `th` row header, so a td selector finds
// nothing and the check passes vacuously on an empty list.
const names = await page.$$eval(".aaa-queue-table tbody tr:visible", (rows) =>
  rows.map((row) => row.cells[0]?.textContent?.trim() ?? ""),
);
check(
  names.length > 0 && names.every((name) => name.includes("SAMPLE")),
  "every sample request is visibly labelled SAMPLE",
  JSON.stringify(names.filter((name) => !name.includes("SAMPLE"))),
);

await page.click('button:has-text("Load sample requests")');
await page.waitForTimeout(500);
const reloaded = await visibleRows();
check(
  reloaded === loaded,
  "loading samples twice does not duplicate them",
  `${loaded} became ${reloaded}`,
);

console.log("\nround trip");
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.click('button:has-text("Export a snapshot")'),
]);
const snapshotPath = join(dir, download.suggestedFilename());
await download.saveAs(snapshotPath);
check(
  /^mission-control-queue-[\d-]+T[\d-]+\.json$/.test(download.suggestedFilename()),
  "the export is named with a sortable timestamp and no colons",
  download.suggestedFilename(),
);

await page.click('button:has-text("Remove 5 sample requests")');
await page.waitForTimeout(500);
const emptied = await visibleRows();
check(emptied === 0, "removing samples clears them", `${emptied} rows left`);

await page.setInputFiles(FILE_INPUT, snapshotPath);
await page.waitForTimeout(350);
const confirmShown = (await page.$('button:has-text("Replace and import")')) !== null;
check(confirmShown, "import asks before replacing anything");

await page.click('button:has-text("Replace and import")');
await page.waitForTimeout(700);
const restored = await visibleRows();
check(restored === loaded, "the snapshot restores what was exported", `${restored} of ${loaded}`);

const undoOffered = (await page.$('button:has-text("Undo the last import")')) !== null;
check(undoOffered, "undo is offered after an import");

await page.click('button:has-text("Undo the last import")');
await page.waitForTimeout(700);
const undone = await visibleRows();
check(undone === emptied, "undo puts back the pre-import state", `${undone}, expected ${emptied}`);

console.log("\nrefusing files it does not understand");
await page.click('button:has-text("Load sample requests")');
await page.waitForTimeout(500);
const guardBaseline = await visibleRows();

for (const file of BAD_FILES) {
  await page.setInputFiles(FILE_INPUT, join(dir, file.name));
  await page.waitForTimeout(300);
  const offered = (await page.$('button:has-text("Replace and import")')) !== null;
  const shown = await page
    .$$eval(".aaa-attention", (els) => els.map((el) => el.textContent.replace(/\s+/g, " ").trim()))
    .catch(() => []);
  check(!offered && shown.some((text) => file.expect.test(text)), file.why, shown.join(" || "));
  if (offered) {
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(200);
  }
}

const afterGuards = await visibleRows();
check(
  afterGuards === guardBaseline,
  "a refused file changes nothing",
  `${guardBaseline} became ${afterGuards}`,
);

await page.setInputFiles(FILE_INPUT, UNKNOWN_KEY_FILE);
await page.waitForTimeout(350);
const warningItems = await page
  .$$eval(".aaa-attention-list li", (items) => items.map((item) => item.textContent.trim()))
  .catch(() => []);
check(
  warningItems.some((text) => /some-rogue-key/.test(text)),
  "an unrecognized key warns by name instead of failing the whole import",
  JSON.stringify(warningItems),
);
check(
  (await page.$('button:has-text("Replace and import")')) !== null,
  "a snapshot with one unknown key can still be imported",
);

console.log("\nprivacy");
const bodyText = await page.$eval(".aaa-queue-versions", (el) => el.textContent ?? "");
check(/PII/.test(bodyText), "the screen says a snapshot contains PII");
check(
  /never commit/i.test(bodyText),
  "the screen says not to commit a snapshot",
);
// The excluded key is the whole of the minimization claim, so it is asserted rather than trusted.
const snapshotText = await page.evaluate(async (path) => path, snapshotPath);
const { readFileSync } = await import("node:fs");
const written = readFileSync(snapshotText, "utf8");
check(
  !written.includes('"aaa-intake-identity"') || /omitted/.test(written),
  "the exported file does not carry the saved requester identity as data",
);
const parsedFile = JSON.parse(written);
check(
  parsedFile.data["aaa-intake-identity"] === undefined,
  "aaa-intake-identity is absent from the snapshot's data",
);
check(
  parsedFile.meta.omitted.some((entry) => entry.key === "aaa-intake-identity"),
  "the snapshot states that identity was omitted on purpose",
);

check(pageErrors.length === 0, "no page errors", pageErrors.join(" | "));

await browser.close();

console.log(
  `\n${failures.length === 0 ? "ALL SNAPSHOT TESTS PASSED" : `${failures.length} SNAPSHOT TEST FAILURE(S)`}`,
);
process.exit(failures.length === 0 ? 0 : 1);
