import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import initSqlJs from "sql.js";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const metadata = JSON.parse(fs.readFileSync(path.join(root, "data", "metadata.json"), "utf8"));
const SQL = await initSqlJs({ locateFile: (file) => path.join(root, "node_modules", "sql.js", "dist", file) });
const db = new SQL.Database(zlib.gunzipSync(fs.readFileSync(path.join(root, metadata.sqlite))));
globalThis.window = {};
await import("../queryLibrary.js");
const translateTop = (source) => {
  const trimmed = source.trim().replace(/;+\s*$/, "");
  const match = trimmed.match(/^(\s*SELECT\s+)(DISTINCT\s+)?TOP\s+(\d+)\s+/i);
  return match ? `${match[1]}${match[2] || ""}${trimmed.slice(match[0].length)} LIMIT ${Number(match[3])}` : trimmed;
};
const asObjects = (result) => result ? result.values.map((values) => Object.fromEntries(result.columns.map((column, index) => [column, values[index]]))) : [];
const definitions = window.BAZI_QUERY_LIBRARY.definitions;
if (definitions.length < 10 || definitions.length > 24) throw new Error(`query library must contain 10–24 entries, got ${definitions.length}`);
const seen = new Set();
const samples = {};
for (const definition of definitions) {
  if (seen.has(definition.key)) throw new Error(`duplicate sample query key: ${definition.key}`);
  seen.add(definition.key);
  for (const field of ["key","group","label","description","sql"]) if (!definition[field]) throw new Error(`${definition.key} missing metadata field: ${field}`);
  if (/評分|排名|百分位/.test(`${definition.label} ${definition.description} ${definition.sql}`)) throw new Error(`${definition.key} leaked legacy rating language`);
  if (!/格局|吉凶/.test(definition.sql)) throw new Error(`${definition.key} does not query pattern data`);
  const result = db.exec(translateTop(definition.sql))[0];
  if (!result) throw new Error(`${definition.key} returned no result set`);
  const objects = asObjects(result);
  if (!objects.length) throw new Error(`${definition.key} has no matches; rewrite or remove it`);
  samples[definition.key] = { columns: result.columns, rows: objects.length };
}
const grouped = Object.values(window.BAZI_QUERY_LIBRARY.groups).flat();
if (grouped.length !== definitions.length || new Set(grouped).size !== definitions.length || grouped.some((key) => !seen.has(key))) throw new Error("sample query groups do not match definitions");
const count = (sql) => db.exec(sql)[0].values[0][0];
const legacyWealthRules = count(`SELECT COUNT(*) FROM "評分規則" WHERE "規則ID" IN ('F-HUTAN-CAI','F-LINGTAN-CAI','FEW-FIRE-GREED','FEW-BELL-GREED')`);
if (legacyWealthRules) throw new Error("legacy 火貪／鈴貪 wealth rules remain in generated database");
if (window.BAZI_QUERY_LIBRARY.defaultQuery !== "rare_all") throw new Error("unexpected default query");
if (definitions.some((definition) => /命盤評分|家庭評分/.test(definition.sql))) throw new Error("sample query library must not use rating tables");
const formationRows = count('SELECT COUNT(*) FROM "命盤格局" WHERE "成格數">=1');
if (!formationRows) throw new Error("no chart forms any named formation");
const halfEmptyFold = count('SELECT COUNT(*) FROM "命盤格局" WHERE "半空折翅"=1 OR "廉貪陷沖命"=1');
console.log(JSON.stringify({ sampleQueries:definitions.length, groups:Object.keys(window.BAZI_QUERY_LIBRARY.groups).length, defaultQuery:window.BAZI_QUERY_LIBRARY.defaultQuery, chartsWithFormation:formationRows, halfEmptyFold, legacyWealthRules, queryResults:samples }, null, 2));
db.close();
