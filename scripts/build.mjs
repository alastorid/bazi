import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const yearRange = process.argv[2];

if (!yearRange || !/^\d{4}(?:-\d{4})?$/.test(yearRange)) {
  console.error("Usage: npm run build -- <year|start-end>\nExample: npm run build -- 2026-2027");
  process.exit(2);
}

for (const [script, args] of [
  ["scripts/verify-scoring-model.mjs", []],
  ["scripts/generate-data.mjs", [yearRange]],
  ["scripts/verify-data.mjs", []],
  ["scripts/verify-queries.mjs", []],
  ["scripts/prepare-pages.mjs", [yearRange]],
]) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\n${yearRange} static site is ready in dist/`);
