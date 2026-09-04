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
const dimensions = ["財富", "幸運", "外貌", "事業", "社交", "家庭助力", "福體", "綜合"];
const scoreCount = rows('SELECT COUNT(*) AS n, COUNT(DISTINCT "KEY") AS keys FROM "命盤評分"')[0];
if (scoreCount.n !== metadata.rowCount || scoreCount.keys !== metadata.rowCount) throw new Error(`score row/key mismatch: ${JSON.stringify(scoreCount)}`);
for (const dimension of dimensions) {
  const invalid = rows(`SELECT COUNT(*) AS n FROM "命盤評分" WHERE "${dimension}分" NOT BETWEEN 0 AND 100 OR "${dimension}百分位" NOT BETWEEN 0 AND 100 OR "${dimension}排名" NOT IN ('SSS','SSR','SS','S','A','B','C','D','E','F')`)[0].n;
  if (invalid) throw new Error(`${invalid} invalid ${dimension} scores`);
  const elite = rows(`SELECT COUNT(*) AS n FROM "命盤評分" WHERE "${dimension}排名" = 'SSS'`)[0].n;
  if (elite > Math.ceil(metadata.rowCount * 0.03)) throw new Error(`${dimension} SSS is not rare: ${elite} rows`);
}
const storedRules = rows('SELECT COUNT(*) AS n FROM "評分規則"')[0].n;
if (storedRules !== metadata.scoring.rules) throw new Error(`score rule mismatch: ${storedRules}/${metadata.scoring.rules}`);
const overallWeight = rows('SELECT ROUND(SUM("綜合權重"), 6) AS n FROM "評分維度"')[0].n;
if (overallWeight !== 1) throw new Error(`overall score weights must total 1, got ${overallWeight}`);
const missing = rows('SELECT COUNT(*) AS n FROM "命盤" WHERE "化祿宮位" = \'\' OR "化權宮位" = \'\' OR "化科宮位" = \'\' OR "化忌宮位" = \'\' OR "命宮" = \'\' OR "身宮" = \'\'')[0].n;
if (missing) throw new Error(`${missing} rows have missing required palace fields`);
const invalidLinks = rows(`SELECT COUNT(*) AS n FROM "命盤" WHERE "命盤連結" NOT LIKE 'https://metisziwei.com/chart?y=${metadata.year}&m=%&d=%&h=%&mi=0&g=%'`)[0].n;
if (invalidLinks) throw new Error(`${invalidLinks} rows have invalid chart links`);
const daXianColumns = metadata.palaces.map((palace) => `${palace}大限`);
const schemaNames = new Set(rows('PRAGMA table_info("命盤")').map((column) => column.name));
for (const column of daXianColumns) {
  if (!schemaNames.has(column)) throw new Error(`missing da-xian column: ${column}`);
}
const missingDaXian = rows(`SELECT COUNT(*) AS n FROM "命盤" WHERE ${daXianColumns.map((column) => `"${column}" = ''`).join(" OR ")}`)[0].n;
if (missingDaXian) throw new Error(`${missingDaXian} rows have missing da-xian ranges`);
const sampleKey = `${metadata.year}0810-子時-女`;
const sample = rows(`SELECT "KEY", "命盤連結", "命宮", "身宮", "身宮宮位", "化祿星", "化祿宮位", "化權星", "化權宮位", "化科星", "化科宮位", "化忌星", "化忌宮位" FROM "命盤" WHERE "KEY" = '${sampleKey}'`)[0];
if (!sample) throw new Error("required sample key not found");
if (sample.命盤連結 !== `https://metisziwei.com/chart?y=${metadata.year}&m=8&d=10&h=0&mi=0&g=f`) throw new Error(`unexpected sample chart link: ${sample.命盤連結}`);
const topScores = rows('SELECT "KEY", "財富分", "財富排名", "財富百分位", "幸運分", "幸運排名", "外貌分", "外貌排名", "綜合分", "綜合排名", "綜合百分位" FROM "命盤評分" ORDER BY "綜合分" DESC LIMIT 3');
console.log(JSON.stringify({ ok: true, ...count, scoreCount, storedRules, missing, invalidLinks, missingDaXian, daXianColumns, sample, topScores }, null, 2));
db.close();
