import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const yearRange = process.argv[2];
if (!yearRange || !/^\d{4}(?:-\d{4})?$/.test(yearRange)) throw new Error("year or year range required");
const deployedBase = process.env.BAZI_DEPLOYED_BASE || "https://alastorid.github.io/bazi/";
const metadataUrl = new URL(`data/metadata.json?reuse=${Date.now()}`, deployedBase);
const metadataResponse = await fetch(metadataUrl, { cache: "no-store" });
if (!metadataResponse.ok) throw new Error(`cannot fetch deployed metadata: ${metadataResponse.status}`);
const metadata = await metadataResponse.json();
if (String(metadata.year) !== yearRange) throw new Error(`deployed range ${metadata.year} does not match ${yearRange}`);
if (!metadata.sqlite || !metadata.hash) throw new Error("deployed metadata is incomplete");

const databaseUrl = new URL(`${metadata.sqlite}?reuse=${metadata.hash}`, deployedBase);
const databaseResponse = await fetch(databaseUrl, { cache: "no-store" });
if (!databaseResponse.ok) throw new Error(`cannot fetch deployed database: ${databaseResponse.status}`);
const database = Buffer.from(await databaseResponse.arrayBuffer());
const hash = crypto.createHash("sha256").update(database).digest("hex");
if (hash !== metadata.hash) throw new Error(`deployed database hash mismatch: ${hash}`);

const dataDir = path.join(root, "data");
const vendorDir = path.join(root, "vendor", "sqljs");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(vendorDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
fs.writeFileSync(path.join(dataDir, path.basename(metadata.sqlite)), database);
for (const name of ["sql-wasm.js", "sql-wasm.wasm"]) {
  fs.copyFileSync(path.join(root, "node_modules", "sql.js", "dist", name), path.join(vendorDir, name));
}

for (const [script, args] of [
  ["scripts/verify-scoring-model.mjs", []],
  ["scripts/verify-data.mjs", []],
  ["scripts/verify-queries.mjs", []],
  ["scripts/prepare-pages.mjs", [yearRange]],
]) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...args], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Reused and reverified deployed ${yearRange} database.`);
