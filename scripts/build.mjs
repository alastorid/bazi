import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const year = process.argv[2];

if (!year || !/^\d{4}$/.test(year)) {
  console.error("Usage: npm run build -- <year>\nExample: npm run build -- 2027");
  process.exit(2);
}

for (const [script, args] of [
  ["scripts/generate-data.mjs", [year]],
  ["scripts/verify-data.mjs", []],
  ["scripts/prepare-pages.mjs", [year]],
]) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\n${year} static site is ready in dist/`);
