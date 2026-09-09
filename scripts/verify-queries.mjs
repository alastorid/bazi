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
if (definitions.length < 15 || definitions.length > 25) throw new Error(`query library must contain 15–25 entries, got ${definitions.length}`);
const expectedHeader = ["KEY","命盤連結","公曆日期","時辰","性別"];
const seen = new Set();
const samples = {};
for (const definition of definitions) {
  if (seen.has(definition.key)) throw new Error(`duplicate sample query key: ${definition.key}`);
  seen.add(definition.key);
  for (const field of ["key","group","label","description","sql"]) if (!definition[field]) throw new Error(`${definition.key} missing metadata field: ${field}`);
  if (!definition.sql.includes('JOIN "命盤評分"')) throw new Error(`${definition.key} does not expose the ranking engine`);
  const result = db.exec(translateTop(definition.sql))[0];
  if (!result) throw new Error(`${definition.key} returned no result set`);
  if (expectedHeader.some((name,index) => result.columns[index] !== name)) throw new Error(`${definition.key} has inconsistent result header`);
  const objects = asObjects(result);
  if (!objects.length) throw new Error(`${definition.key} has no 2027 matches; rewrite or remove it`);
  samples[definition.key] = [objects[0], objects[Math.floor(objects.length / 2)], objects.at(-1)].filter(Boolean).map((row) => row.KEY);
}
const grouped = Object.values(window.BAZI_QUERY_LIBRARY.groups).flat();
if (grouped.length !== definitions.length || new Set(grouped).size !== definitions.length || grouped.some((key) => !seen.has(key))) throw new Error("sample query groups do not match definitions");
const count = (sql) => db.exec(sql)[0].values[0][0];
const badFire = count(`SELECT COUNT(*) FROM "命盤" WHERE "貪狼宮位"='財帛' AND "火星宮位"='財帛' AND ("財帛主星" NOT LIKE '%貪狼%' OR "財帛全部星" NOT LIKE '%火星%' OR "財帛宮是否空宮"<>0 OR "真財帛宮來源"<>'本宮')`);
const badBell = count(`SELECT COUNT(*) FROM "命盤" WHERE "貪狼宮位"='財帛' AND "鈴星宮位"='財帛' AND ("財帛主星" NOT LIKE '%貪狼%' OR "財帛全部星" NOT LIKE '%鈴星%' OR "財帛宮是否空宮"<>0 OR "真財帛宮來源"<>'本宮')`);
if (badFire || badBell) throw new Error(`strict same-palace proof failed: fire=${badFire}, bell=${badBell}`);
const borrowedFire = count(`SELECT COUNT(*) FROM "命盤" WHERE "財帛宮是否空宮"=1 AND "真財帛宮主星" LIKE '%貪狼%' AND "火星宮位"='財帛'`);
const borrowedFireFalsePositive = count(`SELECT COUNT(*) FROM "命盤" WHERE "財帛宮是否空宮"=1 AND "真財帛宮主星" LIKE '%貪狼%' AND "火星宮位"='財帛' AND "貪狼宮位"='財帛'`);
if (borrowedFireFalsePositive) throw new Error(`${borrowedFireFalsePositive} borrowed 貪狼 charts falsely satisfy strict 火貪`);
const strictExamples = db.exec(`SELECT "KEY","財帛主星","財帛全部星","貪狼宮位","火星宮位","財帛宮是否空宮","真財帛宮來源" FROM "命盤" WHERE "貪狼宮位"='財帛' AND "火星宮位"='財帛' ORDER BY "KEY" LIMIT 3`)[0];
if (window.BAZI_QUERY_LIBRARY.defaultQuery !== "overall_top") throw new Error("unexpected default query");
for (const key of ["wealth_fire_greed","wealth_bell_greed","appearance_bright","health_bright_support","career_bright_leader","career_entrepreneur","social_bright","family_bright"]) {
  const sql = window.BAZI_QUERY_LIBRARY.queries[key];
  if (!/星曜亮度|星等/.test(sql)) throw new Error(`${key} does not use brightness`);
}
const normalizedRows = count('SELECT COUNT(*) FROM "星曜亮度" WHERE "星曜"=\'貪狼\' AND "宮位"=\'財帛\' AND "亮度序">=(SELECT "亮度序" FROM "亮度等級" WHERE "亮度"=\'旺\')');
if (!normalizedRows) throw new Error("normalized brightness comparison returned no rows");
console.log(JSON.stringify({ sampleQueries:definitions.length, groups:Object.keys(window.BAZI_QUERY_LIBRARY.groups).length, defaultQuery:window.BAZI_QUERY_LIBRARY.defaultQuery, badFire, badBell, borrowedFireCandidates:borrowedFire, borrowedFireFalsePositive, normalizedBrightnessRows:normalizedRows, strictFireExamples:asObjects(strictExamples), representativeKeys:samples }, null, 2));
db.close();
