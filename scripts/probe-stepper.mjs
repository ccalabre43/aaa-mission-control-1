import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:4173";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const readStepper = () =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll(".aaa-stepper-item")).map((li) => {
      const label = li.querySelector(".aaa-stepper-label");
      const dot = li.querySelector(".aaa-stepper-dot");
      const s = getComputedStyle(label);
      return {
        text: label.textContent.replace(/\s*\(.*\)\s*/, "").trim(),
        classes: li.className.replace("aaa-stepper-item ", ""),
        weight: s.fontWeight,
        color: getComputedStyle(label).color,
        dot: getComputedStyle(dot).backgroundColor,
        ariaCurrent: label.getAttribute("aria-current") ?? "-",
      };
    }),
  );

await page.goto(`${BASE}/request`, { waitUntil: "networkidle" });
await page.selectOption("#department", "Marketing");
await page.fill("#first-name", "Dana");
await page.fill("#last-name", "Reyes");
await page.fill("#email", "dana.reyes@aaalife.com");
await page.click('button:has-text("Start request")');

await page.waitForSelector("#context-text");
console.log("=== on Context step ===");
console.table(await readStepper());

await page.fill("#context-text", "Promote a limited-time term life rate to members.");
await page.click('button:has-text("Next")');
await page.waitForSelector(".aaa-progress");

console.log("=== on Guided questions step, read immediately ===");
console.table(await readStepper());

await page.waitForTimeout(400);
console.log("=== on Guided questions step, read after 400ms ===");
console.table(await readStepper());

await browser.close();
