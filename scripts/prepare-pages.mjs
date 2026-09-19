import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const yearRange = process.argv[2];
const dataDirectory = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'data');
if (!yearRange || !/^\d{4}(?:-\d{4})?$/.test(yearRange)) throw new Error("year or year range required");

const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "data"), { recursive: true });
fs.mkdirSync(path.join(dist, "vendor", "duckdb"), { recursive: true });
fs.mkdirSync(path.join(dist, "src"), { recursive: true });

for (const file of ["index.html", "terminal.css", "design.css", "browser.js", "comparison.js", "visualization.css", "terminal.js", "visualization.js", "queryLibrary.js", "duckWorker.js", "src/query-sql.mjs", ".nojekyll"]) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}
for (const file of ["metadata.json", `ziwei-${yearRange}.duckdb.gz`]) {
  fs.copyFileSync(path.join(dataDirectory, file), path.join(dist, "data", file));
}
for (const file of ["duckdb-browser-eh.worker.js", "duckdb-eh.wasm"]) {
  fs.copyFileSync(path.join(root, "node_modules", "@duckdb", "duckdb-wasm", "dist", file), path.join(dist, "vendor", "duckdb", file));
}
await build({entryPoints:[path.join(root,'node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser.mjs')],bundle:true,format:'esm',minify:true,outfile:path.join(dist,'vendor/duckdb/duckdb-bundle.js')});

console.log(`Staged GitHub Pages artifact: ${dist}`);
