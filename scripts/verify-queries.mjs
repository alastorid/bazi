import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import initSqlJs from "sql.js";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const metadata = JSON.parse(fs.readFileSync(path.join(root, "data", "metadata.json"), "utf8"));
const bytes = zlib.gunzipSync(fs.readFileSync(path.join(root, metadata.sqlite)));
const SQL = await initSqlJs({ locateFile: (file) => path.join(root, "node_modules", "sql.js", "dist", file) });
const db = new SQL.Database(bytes);
globalThis.window = {};
await import("../queryLibrary.js");

const expectedHeader = ["KEY", "命盤連結", "性別", "綜合排名", "綜合分", "財富排名", "財富分", "幸運排名", "幸運分", "外貌排名", "外貌分"];
const translateTop = (source) => {
  const trimmed = source.trim().replace(/;+\s*$/, "");
  const match = trimmed.match(/^(\s*SELECT\s+)(DISTINCT\s+)?TOP\s+(\d+)\s+/i);
  if (!match) return trimmed;
  return `${match[1]}${match[2] || ""}${trimmed.slice(match[0].length)} LIMIT ${Number(match[3])}`;
};

const definitions = window.BAZI_QUERY_LIBRARY.definitions;
const seen = new Set();
for (const definition of definitions) {
  if (seen.has(definition.key)) throw new Error(`duplicate sample query key: ${definition.key}`);
  seen.add(definition.key);
  for (const field of ["key", "group", "label", "description", "rankTarget", "sql"]) {
    if (!definition[field]) throw new Error(`${definition.key} missing metadata field: ${field}`);
  }
  const result = db.exec(translateTop(definition.sql))[0];
  if (definition.rankTarget !== "診斷" && result) {
    const actual = result.columns.slice(0, expectedHeader.length);
    if (actual.some((name, index) => name !== expectedHeader[index])) {
      throw new Error(`${definition.key} has inconsistent ranking header: ${actual.join(", ")}`);
    }
  }
}

const grouped = Object.values(window.BAZI_QUERY_LIBRARY.groups).flat();
if (grouped.length !== definitions.length || grouped.some((key) => !seen.has(key))) throw new Error("sample query groups do not match definitions");
console.log(JSON.stringify({ sampleQueries: definitions.length, groups: Object.keys(window.BAZI_QUERY_LIBRARY.groups).length, defaultQuery: window.BAZI_QUERY_LIBRARY.defaultQuery }, null, 2));
db.close();
