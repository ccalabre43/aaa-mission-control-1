/**
 * Proves the auditable-negative guard actually fails on bad input.
 *
 * A guard that has never been observed failing is indistinguishable from a guard that does nothing,
 * and the previous version of this rule was exactly that: a constant with a comment claiming a check
 * used it, and no check. So the guard is exercised here against fixtures in a temp directory. The
 * real build output is never touched.
 *
 *   node scripts/test-copy-guard.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BANNED_SEND_CLAIMS,
  REQUIRED_SAFE_PHRASES,
  checkBundleCopy,
  checkCoverageSightings,
} from "./lib/copy-guard.mjs";

let failures = 0;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  PASS ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

const root = mkdtempSync(join(tmpdir(), "copy-guard-"));
const assets = join(root, "assets");
mkdirSync(assets);

try {
  console.log("bundle grep");

  writeFileSync(join(assets, "clean.js"), 'const t="No matches among the 3 requests saved on this device.";');
  check("clean bundle passes", checkBundleCopy(assets).length === 0);

  writeFileSync(join(assets, "bad.js"), 'const t="No duplicates found";');
  const banned = checkBundleCopy(assets);
  check(
    "bare negative is caught",
    banned.some((p) => p.includes("No duplicates found")),
    JSON.stringify(banned),
  );
  check("the offending file is named", banned.some((p) => p.includes("bad.js")));

  rmSync(join(assets, "bad.js"));
  writeFileSync(join(assets, "bad.css"), '.x::after{content:"No matches found"}');
  check("CSS content is checked too", checkBundleCopy(assets).length === 1);
  rmSync(join(assets, "bad.css"));

  console.log("false send claims");

  /*
   * Every banned claim is exercised individually rather than as one lump. The list is the kind of
   * thing someone extends later, and a single combined fixture would still pass with a typo in a new
   * entry - the other seven would carry it.
   */
  for (const phrase of BANNED_SEND_CLAIMS) {
    const file = join(assets, "claim.js");
    writeFileSync(file, `const t=${JSON.stringify(phrase)};`);
    const found = checkBundleCopy(assets);
    check(
      `caught: "${phrase}"`,
      found.some((problem) => problem.includes(phrase)),
      JSON.stringify(found),
    );
    rmSync(file);
  }

  /*
   * The other half of the guard, and the half that is easy to break. "Sent to Workfront: No" is the
   * honest disclosure on every queue row; a guard that banned the substring "sent to Workfront"
   * would fail the build for telling the truth. These assertions exist so that mistake cannot ship.
   */
  for (const phrase of REQUIRED_SAFE_PHRASES) {
    const file = join(assets, "safe.js");
    writeFileSync(file, `const t=${JSON.stringify(phrase)};`);
    const found = checkBundleCopy(assets);
    check(`allowed: "${phrase}"`, found.length === 0, JSON.stringify(found));
    rmSync(file);
  }

  // A skipped check must never look like a passing one.
  check("missing directory is reported", checkBundleCopy(join(root, "nope")).length === 1);
  const emptyDir = join(root, "empty");
  mkdirSync(emptyDir);
  check("empty directory is reported", checkBundleCopy(emptyDir).length === 1);

  console.log("rendered coverage text");

  check(
    "scoped coverage passes",
    checkCoverageSightings([
      {
        screen: "desktop",
        coverage: "Checked against 3 requests. Only requests saved on this device were checked.",
        empty: null,
      },
    ]).length === 0,
  );

  check(
    "missing coverage line is caught",
    checkCoverageSightings([{ screen: "desktop", coverage: null, empty: "No matches." }]).length === 1,
  );

  check(
    "unscoped coverage line is caught",
    checkCoverageSightings([
      { screen: "mobile", coverage: "Checked against 3 requests.", empty: null },
    ]).length === 1,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log(failures === 0 ? "\nALL GUARD TESTS PASSED" : `\n${failures} GUARD TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
