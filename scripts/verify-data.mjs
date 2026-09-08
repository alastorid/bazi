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
const scalar = (sql) => rows(sql)[0]?.n ?? 0;

const count = rows('SELECT COUNT(*) AS n, COUNT(DISTINCT "KEY") AS keys FROM "命盤"')[0];
if (count.n !== metadata.rowCount || count.keys !== metadata.rowCount) throw new Error(`row/key mismatch: ${JSON.stringify(count)}`);
const obsolete = rows(`SELECT name FROM sqlite_master WHERE name IN ('命盤評分','命盤完整評分','評分規則','評分維度','排名門檻')`);
if (obsolete.length) throw new Error(`obsolete scoring objects remain: ${obsolete.map((item) => item.name).join(", ")}`);
const schemaNames = new Set(rows('PRAGMA table_info("命盤")').map((column) => column.name));
for (const name of schemaNames) if (/(綜合|財富|橫財|幸運|外貌|事業|社交|家庭助力|福體)(分|排名|百分位)$/.test(name)) throw new Error(`obsolete scoring column remains: ${name}`);

const specs = metadata.palaceSemantics;
if (!Array.isArray(specs) || specs.length !== 12) throw new Error(`expected 12 palace semantics, got ${specs?.length}`);
const byLabel = new Map(specs.map((spec) => [spec.label, spec]));
const expectedOpposites = { 命宮:"遷移宮", 兄弟宮:"交友宮", 夫妻宮:"官祿宮", 子女宮:"田宅宮", 財帛宮:"福德宮", 疾厄宮:"父母宮", 遷移宮:"命宮", 交友宮:"兄弟宮", 官祿宮:"夫妻宮", 田宅宮:"子女宮", 福德宮:"財帛宮", 父母宮:"疾厄宮" };
for (const spec of specs) {
  if (spec.opposite !== expectedOpposites[spec.label]) throw new Error(`wrong opposite mapping for ${spec.label}: ${spec.opposite}`);
  const opposite = byLabel.get(spec.opposite);
  const required = [`${spec.label}是否空宮`,`${spec.label}對宮`,`${spec.label}對宮主星`,`${spec.label}對宮全部星`,`真${spec.label}`,`真${spec.label}主星`,`真${spec.label}全部星`,`真${spec.label}來源`];
  for (const column of required) if (!schemaNames.has(column)) throw new Error(`missing semantic column: ${column}`);
  const invalidEmpty = scalar(`SELECT COUNT(*) AS n FROM "命盤" WHERE "${spec.label}是否空宮" <> CASE WHEN "${spec.raw}主星"='' THEN 1 ELSE 0 END`);
  if (invalidEmpty) throw new Error(`${invalidEmpty} incorrect empty-palace flags for ${spec.label}`);
  const invalidOpposite = scalar(`SELECT COUNT(*) AS n FROM "命盤" WHERE "${spec.label}對宮"<>'${spec.opposite}' OR "${spec.label}對宮主星"<>"${opposite.raw}主星" OR "${spec.label}對宮全部星"<>"${opposite.raw}全部星"`);
  if (invalidOpposite) throw new Error(`${invalidOpposite} incorrect opposite-palace rows for ${spec.label}`);
  const invalidEffective = scalar(`SELECT COUNT(*) AS n FROM "命盤" WHERE "真${spec.label}"<>CASE WHEN "${spec.label}是否空宮"=1 THEN "${opposite.raw}主星" ELSE "${spec.raw}主星" END OR "真${spec.label}主星"<>"真${spec.label}" OR "真${spec.label}全部星"<>CASE WHEN "${spec.label}是否空宮"=1 THEN "${opposite.raw}全部星" ELSE "${spec.raw}全部星" END OR "真${spec.label}來源"<>CASE WHEN "${spec.label}是否空宮"=1 THEN '借對宮' ELSE '本宮' END`);
  if (invalidEffective) throw new Error(`${invalidEffective} incorrect effective-palace rows for ${spec.label}`);
}
if (!schemaNames.has("空宮數")) throw new Error("missing 空宮數");
const emptySum = specs.map((spec) => `"${spec.label}是否空宮"`).join("+");
const invalidEmptyCount = scalar(`SELECT COUNT(*) AS n FROM "命盤" WHERE "空宮數" <> ${emptySum}`);
if (invalidEmptyCount) throw new Error(`${invalidEmptyCount} incorrect 空宮數 values`);

const missing = scalar('SELECT COUNT(*) AS n FROM "命盤" WHERE "化祿宮位"=\'\' OR "化權宮位"=\'\' OR "化科宮位"=\'\' OR "化忌宮位"=\'\' OR "命宮"=\'\' OR "身宮"=\'\'');
if (missing) throw new Error(`${missing} rows have missing required raw fields`);
const invalidLinks = scalar(`SELECT COUNT(*) AS n FROM "命盤" WHERE "命盤連結" NOT LIKE 'https://metisziwei.com/chart?y=${metadata.year}&m=%&d=%&h=%&mi=0&g=%'`);
if (invalidLinks) throw new Error(`${invalidLinks} rows have invalid chart links`);
const daXianColumns = metadata.palaces.map((palace) => `${palace}大限`);
for (const column of daXianColumns) if (!schemaNames.has(column)) throw new Error(`missing da-xian column: ${column}`);
const missingDaXian = scalar(`SELECT COUNT(*) AS n FROM "命盤" WHERE ${daXianColumns.map((column) => `"${column}"=''`).join(" OR ")}`);
if (missingDaXian) throw new Error(`${missingDaXian} rows have missing da-xian ranges`);
const sampleKey = `${metadata.year}0810-子時-女`;
const sample = rows(`SELECT "KEY","命盤連結","命宮","身宮","身宮宮位","空宮數" FROM "命盤" WHERE "KEY"='${sampleKey}'`)[0];
if (!sample) throw new Error("required sample key not found");
if (sample.命盤連結 !== `https://metisziwei.com/chart?y=${metadata.year}&m=8&d=10&h=0&mi=0&g=f`) throw new Error(`unexpected sample chart link: ${sample.命盤連結}`);
const emptyExamples = rows('SELECT "KEY","命宮主星","命宮對宮","命宮對宮主星","真命宮主星","真命宮來源","空宮數" FROM "命盤" WHERE "命宮是否空宮"=1 ORDER BY "KEY" LIMIT 3');
if (!emptyExamples.length) throw new Error("no empty 命宮 examples generated");
console.log(JSON.stringify({ ok:true, ...count, columns:schemaNames.size, obsoleteObjects:0, invalidEmptyCount, missing, invalidLinks, missingDaXian, sample, emptyExamples }, null, 2));
db.close();
