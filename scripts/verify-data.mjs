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
const rows = (sql) => {
  const result = db.exec(sql)[0];
  return result ? result.values.map((values) => Object.fromEntries(result.columns.map((column, i) => [column, values[i]]))) : [];
};
const count = rows('SELECT COUNT(*) AS n, COUNT(DISTINCT "KEY") AS keys FROM "命盤"')[0];
if (count.n !== metadata.rowCount || count.keys !== metadata.rowCount) throw new Error(`row/key mismatch: ${JSON.stringify(count)}`);
const missing = rows('SELECT COUNT(*) AS n FROM "命盤" WHERE "化祿宮位" = \'\' OR "化權宮位" = \'\' OR "化科宮位" = \'\' OR "化忌宮位" = \'\' OR "命宮" = \'\' OR "身宮" = \'\'')[0].n;
if (missing) throw new Error(`${missing} rows have missing required palace fields`);
const daXianColumns = metadata.palaces.map((palace) => `${palace}大限`);
const schemaNames = new Set(rows('PRAGMA table_info("命盤")').map((column) => column.name));
for (const column of daXianColumns) {
  if (!schemaNames.has(column)) throw new Error(`missing da-xian column: ${column}`);
}
const missingDaXian = rows(`SELECT COUNT(*) AS n FROM "命盤" WHERE ${daXianColumns.map((column) => `"${column}" = ''`).join(" OR ")}`)[0].n;
if (missingDaXian) throw new Error(`${missingDaXian} rows have missing da-xian ranges`);
const sampleKey = `${metadata.year}0810-子時-女`;
const sample = rows(`SELECT "KEY", "命宮", "身宮", "身宮宮位", "化祿星", "化祿宮位", "化權星", "化權宮位", "化科星", "化科宮位", "化忌星", "化忌宮位" FROM "命盤" WHERE "KEY" = '${sampleKey}'`)[0];
if (!sample) throw new Error("required sample key not found");
console.log(JSON.stringify({ ok: true, ...count, missing, missingDaXian, daXianColumns, sample }, null, 2));
db.close();
