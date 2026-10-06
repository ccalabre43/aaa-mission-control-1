/**
 * Walks the app under the production Content-Security-Policy and reports every violation.
 *
 * A CSP is the kind of thing that looks correct in review and breaks one screen in production, so
 * the policy is exercised here instead of reasoned about. Run against `vite preview`, which sends
 * the same headers the host configs send.
 *
 *   node scripts/probe-csp.mjs [baseUrl]
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:4173";

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const violations = [];
const consoleErrors = [];

/** A blocked data: URI font puts its whole base64 payload in the message, which buries the report. */
function trim(text) {
  return text.replace(/(data:[^;]+;base64,)[A-Za-z0-9+/=]+/g, "$1<...>").slice(0, 300);
}

page.on("console", (msg) => {
  const text = msg.text();
  if (/Content Security Policy|Refused to/i.test(text)) violations.push(trim(text));
  else if (msg.type() === "error") consoleErrors.push(trim(text));
});
page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
page.on("requestfailed", (req) => {
  consoleErrors.push(`requestfailed ${req.url()} ${req.failure()?.errorText ?? ""}`);
});
page.on("response", (res) => {
  if (res.status() >= 400) consoleErrors.push(`HTTP ${res.status()} ${res.url()}`);
});

// Headers arrive on the document response, not just in theory.
const response = await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const headers = response.headers();

async function visit(path, actions) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  if (actions) await actions();
  await page.waitForTimeout(250);
}

await visit("/request", async () => {
  await page.selectOption("#department", "Marketing");
  await page.fill("#first-name", "Dana");
  await page.fill("#last-name", "Reyes");
  await page.fill("#email", "dana.reyes@aaalife.com");
  await page.click('button:has-text("Start request")');
  await page.waitForSelector("#context-text");
  await page.fill("#context-text", "Promote a limited-time term life rate to members.");
  await page.click('button:has-text("Next")');
  await page.waitForSelector(".aaa-progress");
});
await visit("/settings/questions");

// The row actions menu is the one place with a React inline style, and the tracker is the one
// place that lazily fetches the spreadsheet chunk. Both are exactly what a strict CSP would break.
await visit("/deliverables", async () => {
  await page.click('button:has-text("Add row")').catch(() => {});
  await page.waitForTimeout(200);
  const menu = await page.$('button[aria-haspopup="menu"], button[aria-label*="ctions"]');
  if (menu) {
    await menu.click();
    await page.waitForTimeout(200);
    // Close it before reaching for Export. The open menu is absolutely positioned, and once the
    // tracker moved below the requests section its items sit over the toolbar - Playwright reported
    // the menu's own buttons intercepting the click rather than a CSP problem.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);
  }
  const exportBtn = await page.$('button:has-text("Export"):not([disabled])');
  if (exportBtn) {
    await exportBtn.click();
    await page.waitForTimeout(900); // give the lazy xlsx chunk time to load
  }
});

await browser.close();

console.log("--- headers on the document response ---");
for (const key of [
  "content-security-policy",
  "referrer-policy",
  "x-content-type-options",
  "permissions-policy",
  "cross-origin-opener-policy",
]) {
  console.log(`  ${key}: ${headers[key] ?? "MISSING"}`);
}

console.log("\n--- CSP violations ---");
console.log(violations.length === 0 ? "  none" : "");
for (const v of violations) console.log(`  VIOLATION ${v}`);

console.log("\n--- other console errors ---");
console.log(consoleErrors.length === 0 ? "  none" : "");
for (const e of consoleErrors) console.log(`  ERROR ${e}`);

process.exit(violations.length === 0 ? 0 : 1);
