import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:4173";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/request`, { waitUntil: "networkidle" });

const describe = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    if (el === document.documentElement) return "HTML";
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return `${el.tagName}.${String(el.className).split(" ")[0]} left=${Math.round(rect.left)} outline=${style.outlineWidth} ${style.outlineColor}`;
  });

console.log("activeElement immediately after load:", await describe());

// Explicitly reset the sequential focus navigation starting point to the document,
// which is what a real user gets on a fresh page load.
await page.evaluate(() => {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  document.body.focus();
});
console.log("after blur/body focus:          ", await describe());

console.log("\ntab sequence from a clean start:");
for (let i = 0; i < 4; i += 1) {
  await page.keyboard.press("Tab");
  console.log(`  Tab ${i + 1}: ${await describe()}`);
}

// Does the skip link actually work when focused and activated?
console.log("\nskip link behavior:");
await page.evaluate(() => document.querySelector(".aaa-skip-link").focus());
const skipFocused = await page.evaluate(() => {
  const el = document.querySelector(".aaa-skip-link");
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return {
    isActive: document.activeElement === el,
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    outline: `${style.outlineWidth} ${style.outlineColor}`,
  };
});
console.log("  focused:", JSON.stringify(skipFocused));

await page.keyboard.press("Enter");
await page.waitForTimeout(200);
console.log("  after Enter, hash:", await page.evaluate(() => location.hash));
console.log("  main exists:", await page.evaluate(() => Boolean(document.querySelector("#main"))));

await browser.close();
