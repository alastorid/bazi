import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const year = process.argv[2];
if (!year || !/^\d{4}$/.test(year)) throw new Error("year required");

const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "data"), { recursive: true });
fs.mkdirSync(path.join(dist, "vendor", "sqljs"), { recursive: true });

for (const file of ["index.html", "terminal.css", "terminal.js", "queryLibrary.js", "sqlWorker.js", ".nojekyll"]) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}
for (const file of ["metadata.json", `ziwei-${year}.sqlite.gz`]) {
  fs.copyFileSync(path.join(root, "data", file), path.join(dist, "data", file));
}
for (const file of ["sql-wasm.js", "sql-wasm.wasm"]) {
  fs.copyFileSync(path.join(root, "vendor", "sqljs", file), path.join(dist, "vendor", "sqljs", file));
}

console.log(`Staged GitHub Pages artifact: ${dist}`);
