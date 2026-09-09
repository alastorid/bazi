import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import initSqlJs from "sql.js";
import { fileURLToPath } from "node:url";
import { generateChart, HOURS, GENDERS } from "../src/ziwei-algorithm.mjs";
import {
  BRIGHTNESS_LEVELS, CONTEXT_RULES, DIMENSIONS, DIMENSION_CONFIG,
  RANK_THRESHOLDS, STAR_NATURE, STAR_RULES, scoreChart,
} from "../src/scoring-model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const year = Number(process.argv[2] || new Date().getFullYear() + 1);
if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error(`Invalid year: ${year}`);

const dataDir = path.join(root, "data");
const vendorDir = path.join(root, "vendor", "sqljs");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(vendorDir, { recursive: true });

const sqlDist = path.join(root, "node_modules", "sql.js", "dist");
for (const name of ["sql-wasm.js", "sql-wasm.wasm"]) {
  fs.copyFileSync(path.join(sqlDist, name), path.join(vendorDir, name));
}

function datesOfYear(targetYear) {
  const dates = [];
  for (let date = new Date(Date.UTC(targetYear, 0, 1)); date.getUTCFullYear() === targetYear; date.setUTCDate(date.getUTCDate() + 1)) {
    dates.push({ year: targetYear, month: date.getUTCMonth() + 1, day: date.getUTCDate() });
  }
  return dates;
}

const pad2 = (value) => String(value).padStart(2, "0");
const quoteIdent = (value) => `"${String(value).replaceAll('"', '""')}"`;
const dates = datesOfYear(year);
const brightnessRank = new Map(BRIGHTNESS_LEVELS);

// Every natal chart contains the complete fixed star catalogue, distributed
// across its twelve palaces. One representative chart is therefore sufficient
// to discover the wide-table schema; every requested row is still calculated
// independently below (including both genders).
const starNames = new Set();
const palaceNames = new Set();
const schemaChart = generateChart({ ...dates[0], hour: 0, gender: "male" });
for (const palace of schemaChart.palaces) {
  palaceNames.add(palace.name);
  for (const star of palace.stars) starNames.add(star.name);
}

const stars = [...starNames].sort((a, b) => a.localeCompare(b, "zh-Hant"));
const preferredPalaces = ["命宮", "兄弟", "夫妻", "子女", "財帛", "疾厄", "遷移", "僕役", "交友", "官祿", "田宅", "福德", "父母"];
const palaces = [...palaceNames].sort((a, b) => {
  const ai = preferredPalaces.indexOf(a);
  const bi = preferredPalaces.indexOf(b);
  return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b, "zh-Hant");
});

// User-facing palace semantics. iztro calls 交友宮「僕役」in the raw chart;
// keep that original column while exposing the conventional 交友宮 name in
// every new semantic field.
const friendPalace = palaces.includes("交友") ? "交友" : "僕役";
const palaceSpecs = [
  { label: "命宮", raw: "命宮", opposite: "遷移宮" },
  { label: "兄弟宮", raw: "兄弟", opposite: "交友宮" },
  { label: "夫妻宮", raw: "夫妻", opposite: "官祿宮" },
  { label: "子女宮", raw: "子女", opposite: "田宅宮" },
  { label: "財帛宮", raw: "財帛", opposite: "福德宮" },
  { label: "疾厄宮", raw: "疾厄", opposite: "父母宮" },
  { label: "遷移宮", raw: "遷移", opposite: "命宮" },
  { label: "交友宮", raw: friendPalace, opposite: "兄弟宮" },
  { label: "官祿宮", raw: "官祿", opposite: "夫妻宮" },
  { label: "田宅宮", raw: "田宅", opposite: "子女宮" },
  { label: "福德宮", raw: "福德", opposite: "財帛宮" },
  { label: "父母宮", raw: "父母", opposite: "疾厄宮" },
];
const specByLabel = new Map(palaceSpecs.map((spec) => [spec.label, spec]));

const baseColumns = [
  ["KEY", "TEXT PRIMARY KEY"], ["公曆日期", "TEXT NOT NULL"], ["年", "INTEGER NOT NULL"],
  ["月", "INTEGER NOT NULL"], ["日", "INTEGER NOT NULL"], ["時辰", "TEXT NOT NULL"],
  ["時辰序號", "INTEGER NOT NULL"], ["性別", "TEXT NOT NULL"], ["命盤連結", "TEXT NOT NULL"],
  ["農曆日期", "TEXT NOT NULL"],
  ["年干", "TEXT NOT NULL"], ["年支", "TEXT NOT NULL"], ["命宮", "TEXT NOT NULL"],
  ["身宮", "TEXT NOT NULL"], ["身宮宮位", "TEXT NOT NULL"], ["五行局", "TEXT NOT NULL"],
  ["五行局數", "INTEGER NOT NULL"], ["化祿星", "TEXT"], ["化祿宮位", "TEXT"],
  ["化權星", "TEXT"], ["化權宮位", "TEXT"], ["化科星", "TEXT"], ["化科宮位", "TEXT"],
  ["化忌星", "TEXT"], ["化忌宮位", "TEXT"],
];
const starColumns = stars.flatMap((star) => [[`${star}星等`, "TEXT"], [`${star}宮位`, "TEXT"]]);
const palaceColumns = palaces.flatMap((palace) => [
  [`${palace}主星`, "TEXT"],
  [`${palace}全部星`, "TEXT"],
  [`${palace}大限`, "TEXT"],
]);
const semanticColumns = palaceSpecs.flatMap(({ label }) => [
  [`${label}是否空宮`, "INTEGER NOT NULL"],
  [`${label}對宮`, "TEXT NOT NULL"],
  [`${label}對宮主星`, "TEXT NOT NULL"],
  [`${label}對宮全部星`, "TEXT NOT NULL"],
  [`真${label}`, "TEXT NOT NULL"],
  [`真${label}主星`, "TEXT NOT NULL"],
  [`真${label}全部星`, "TEXT NOT NULL"],
  [`真${label}來源`, "TEXT NOT NULL"],
]);
const columns = [...baseColumns, ...starColumns, ...palaceColumns, ...semanticColumns, ["空宮數", "INTEGER NOT NULL"]];

const SQL = await initSqlJs({ locateFile: (file) => path.join(sqlDist, file) });
const db = new SQL.Database();
db.run(`CREATE TABLE 命盤 (${columns.map(([name, type]) => `${quoteIdent(name)} ${type}`).join(", ")})`);
db.run('CREATE INDEX "idx_日期性別" ON "命盤"("公曆日期", "性別", "時辰序號")');
for (const name of ["化祿宮位", "化權宮位", "化科宮位", "化忌宮位", "命宮", "身宮"]) {
  db.run(`CREATE INDEX ${quoteIdent(`idx_${name}`)} ON "命盤"(${quoteIdent(name)})`);
}
for (const name of ["空宮數", "命宮是否空宮", "父母宮是否空宮"]) {
  db.run(`CREATE INDEX ${quoteIdent(`idx_${name}`)} ON "命盤"(${quoteIdent(name)})`);
}

db.run('CREATE TABLE "亮度等級" ("亮度" TEXT PRIMARY KEY, "亮度序" INTEGER UNIQUE NOT NULL)');
const brightnessLevelInsert = db.prepare('INSERT INTO "亮度等級" VALUES (?, ?)');
for (const level of BRIGHTNESS_LEVELS) brightnessLevelInsert.run(level);
brightnessLevelInsert.free();
db.run('CREATE TABLE "星曜亮度" ("KEY" TEXT NOT NULL REFERENCES "命盤"("KEY"), "星曜" TEXT NOT NULL, "宮位" TEXT NOT NULL, "星曜類型" TEXT NOT NULL, "星性質" TEXT NOT NULL, "亮度" TEXT NOT NULL, "亮度序" INTEGER NOT NULL, "四化" TEXT NOT NULL, PRIMARY KEY ("KEY", "星曜"))');
db.run('CREATE INDEX "idx_星曜亮度_查詢" ON "星曜亮度"("星曜", "宮位", "亮度序", "KEY")');

db.run('CREATE TABLE "評分維度" ("維度" TEXT PRIMARY KEY, "基礎分" REAL NOT NULL, "綜合權重" REAL NOT NULL)');
const dimensionInsert = db.prepare('INSERT INTO "評分維度" VALUES (?, ?, ?)');
for (const dimension of DIMENSIONS) dimensionInsert.run([dimension, DIMENSION_CONFIG[dimension].baseScore, DIMENSION_CONFIG[dimension].overallWeight]);
dimensionInsert.free();
db.run('CREATE TABLE "排名門檻" ("排名" TEXT PRIMARY KEY, "最低百分位" REAL NOT NULL)');
const thresholdInsert = db.prepare('INSERT INTO "排名門檻" VALUES (?, ?)');
for (const threshold of RANK_THRESHOLDS) thresholdInsert.run(threshold);
thresholdInsert.free();
db.run('CREATE TABLE "評分規則" ("規則ID" TEXT PRIMARY KEY, "維度" TEXT NOT NULL, "類型" TEXT NOT NULL, "星曜" TEXT NOT NULL, "適用宮位" TEXT NOT NULL, "基礎作用" REAL, "說明" TEXT NOT NULL)');
const scoringRuleInsert = db.prepare('INSERT INTO "評分規則" VALUES (?, ?, ?, ?, ?, ?, ?)');
for (const item of STAR_RULES) scoringRuleInsert.run([item.id, item.dimension, "星曜宮位", item.star, item.palaces.join("、"), item.base, item.description]);
for (const item of CONTEXT_RULES) scoringRuleInsert.run([item.id, item.dimension, item.type, "", "", null, item.description]);
scoringRuleInsert.free();
db.run('CREATE TABLE "命盤評分明細" ("KEY" TEXT NOT NULL REFERENCES "命盤"("KEY"), "規則ID" TEXT NOT NULL REFERENCES "評分規則"("規則ID"), "維度" TEXT NOT NULL, "類型" TEXT NOT NULL, "星曜" TEXT NOT NULL, "宮位" TEXT NOT NULL, "亮度" TEXT NOT NULL, "亮度序" INTEGER, "亮度倍率" REAL NOT NULL, "基礎作用" REAL NOT NULL, "實際貢獻" REAL NOT NULL, "說明" TEXT NOT NULL)');
db.run('CREATE INDEX "idx_評分明細_KEY" ON "命盤評分明細"("KEY", "維度")');
db.run('CREATE INDEX "idx_評分明細_星曜" ON "命盤評分明細"("星曜", "宮位", "亮度序")');
const scoreSchema = [...DIMENSIONS, "綜合"].map((dimension) => `${quoteIdent(`${dimension}分`)} REAL NOT NULL`).join(", ");
db.run(`CREATE TEMP TABLE "_命盤原始評分" ("KEY" TEXT PRIMARY KEY, ${scoreSchema})`);

const insert = db.prepare(`INSERT INTO 命盤 (${columns.map(([name]) => quoteIdent(name)).join(",")}) VALUES (${columns.map(() => "?").join(",")})`);
const brightnessInsert = db.prepare('INSERT INTO "星曜亮度" VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const scoreInsert = db.prepare(`INSERT INTO "_命盤原始評分" VALUES (${["KEY", ...DIMENSIONS, "綜合"].map(() => "?").join(",")})`);
const scoreDetailInsert = db.prepare('INSERT INTO "命盤評分明細" VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
db.run("BEGIN");
let rowCount = 0;
console.log(`Generating ${dates.length * HOURS.length * GENDERS.length} charts for ${year}…`);
for (const date of dates) {
  for (const hour of HOURS) {
    for (const gender of GENDERS) {
      const chart = generateChart({ ...date, hour: hour.index, gender: gender.code });
      const iso = `${year}-${pad2(date.month)}-${pad2(date.day)}`;
      const compact = `${year}${pad2(date.month)}${pad2(date.day)}`;
      const byStar = new Map();
      const byPalace = new Map();
      const siHua = new Map();
      for (const palace of chart.palaces) {
        byPalace.set(palace.name, palace);
        for (const star of palace.stars) {
          byStar.set(star.name, { ...star, palace: palace.name });
          if (["祿", "權", "科", "忌"].includes(star.siHua)) siHua.set(star.siHua, { star: star.name, palace: palace.name });
        }
      }
      const values = {
        KEY: `${compact}-${hour.label}-${gender.label}`,
        公曆日期: iso, 年: year, 月: date.month, 日: date.day, 時辰: hour.label,
        時辰序號: hour.index, 性別: gender.label,
        命盤連結: `https://metisziwei.com/chart?y=${year}&m=${date.month}&d=${date.day}&h=${hour.index * 2}&mi=0&g=${gender.code === "female" ? "f" : "m"}`,
        農曆日期: `${chart.lunarInfo.lunarYear}-${chart.lunarInfo.isLeapMonth ? "閏" : ""}${pad2(chart.lunarInfo.lunarMonth)}-${pad2(chart.lunarInfo.lunarDay)}`,
        年干: chart.lunarInfo.yearStem, 年支: chart.lunarInfo.yearBranch,
        命宮: chart.soulBranch, 身宮: chart.bodyBranch, 身宮宮位: chart.bodyPalaceName,
        五行局: chart.wuxingJuName, 五行局數: chart.wuxingJu,
        化祿星: siHua.get("祿")?.star ?? "", 化祿宮位: siHua.get("祿")?.palace ?? "",
        化權星: siHua.get("權")?.star ?? "", 化權宮位: siHua.get("權")?.palace ?? "",
        化科星: siHua.get("科")?.star ?? "", 化科宮位: siHua.get("科")?.palace ?? "",
        化忌星: siHua.get("忌")?.star ?? "", 化忌宮位: siHua.get("忌")?.palace ?? "",
      };
      for (const star of stars) {
        const item = byStar.get(star);
        values[`${star}星等`] = item?.brightness ?? "";
        values[`${star}宮位`] = item?.palace ?? "";
      }
      for (const palaceName of palaces) {
        const palace = byPalace.get(palaceName);
        values[`${palaceName}主星`] = palace?.stars.filter((star) => star.type === "major").map((star) => star.name).join("、") ?? "";
        values[`${palaceName}全部星`] = palace?.stars.map((star) => `${star.name}${star.siHua ? `化${star.siHua}` : ""}${star.brightness ? `(${star.brightness})` : ""}`).join("、") ?? "";
        values[`${palaceName}大限`] = palace?.daXianRange?.length === 2 ? `${palace.daXianRange[0]}-${palace.daXianRange[1]}` : "";
      }
      let emptyCount = 0;
      for (const spec of palaceSpecs) {
        const opposite = specByLabel.get(spec.opposite);
        const ownMain = values[`${spec.raw}主星`] ?? "";
        const ownAll = values[`${spec.raw}全部星`] ?? "";
        const oppositeMain = values[`${opposite.raw}主星`] ?? "";
        const oppositeAll = values[`${opposite.raw}全部星`] ?? "";
        const isEmpty = ownMain === "" ? 1 : 0;
        const effectiveMain = isEmpty ? oppositeMain : ownMain;
        const effectiveAll = isEmpty ? oppositeAll : ownAll;
        emptyCount += isEmpty;
        values[`${spec.label}是否空宮`] = isEmpty;
        values[`${spec.label}對宮`] = spec.opposite;
        values[`${spec.label}對宮主星`] = oppositeMain;
        values[`${spec.label}對宮全部星`] = oppositeAll;
        values[`真${spec.label}`] = effectiveMain;
        values[`真${spec.label}主星`] = effectiveMain;
        values[`真${spec.label}全部星`] = effectiveAll;
        values[`真${spec.label}來源`] = isEmpty ? "借對宮" : "本宮";
      }
      values.空宮數 = emptyCount;
      insert.run(columns.map(([name]) => values[name] ?? ""));
      for (const palace of chart.palaces) {
        for (const star of palace.stars) {
          const brightnessOrder = brightnessRank.get(star.brightness);
          if (!brightnessOrder) continue;
          brightnessInsert.run([
            values.KEY, star.name, palace.name, star.type, STAR_NATURE[star.name] ?? "mixed",
            star.brightness, brightnessOrder, star.siHua ?? "",
          ]);
        }
      }
      const rating = scoreChart(chart);
      scoreInsert.run([values.KEY, ...DIMENSIONS.map((dimension) => rating.scores[dimension]), rating.scores.綜合]);
      for (const item of rating.details) {
        scoreDetailInsert.run([
          values.KEY, item.id, item.dimension, item.type, item.star, item.palace,
          item.brightness, item.brightnessOrder, item.factor, item.base, item.contribution, item.description,
        ]);
      }
      rowCount += 1;
    }
  }
  if (date.day === 1 || rowCount === dates.length * HOURS.length * GENDERS.length) {
    const percent = ((rowCount / (dates.length * HOURS.length * GENDERS.length)) * 100).toFixed(1);
    console.log(`${date.year}-${pad2(date.month)}-${pad2(date.day)} · ${rowCount.toLocaleString()} rows · ${percent}%`);
  }
}
db.run("COMMIT");
insert.free();
brightnessInsert.free();
scoreInsert.free();
scoreDetailInsert.free();

const scoredDimensions = [...DIMENSIONS, "綜合"];
const percentileColumns = scoredDimensions.map((dimension) => `ROUND(PERCENT_RANK() OVER (ORDER BY ${quoteIdent(`${dimension}分`)} ASC) * 100, 2) AS ${quoteIdent(`${dimension}百分位`)}`);
db.run(`CREATE TEMP TABLE "_含百分位" AS SELECT *, ${percentileColumns.join(", ")} FROM "_命盤原始評分"`);
const ratingSchema = scoredDimensions.flatMap((dimension) => [
  `${quoteIdent(`${dimension}分`)} REAL NOT NULL`,
  `${quoteIdent(`${dimension}排名`)} TEXT NOT NULL`,
  `${quoteIdent(`${dimension}百分位`)} REAL NOT NULL`,
]);
db.run(`CREATE TABLE "命盤評分" ("KEY" TEXT PRIMARY KEY REFERENCES "命盤"("KEY"), ${ratingSchema.join(", ")})`);
const sqlQuote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const rankCase = (dimension) => `CASE ${RANK_THRESHOLDS.map(([rank, minimum]) => `WHEN ${quoteIdent(`${dimension}百分位`)} >= ${minimum} THEN ${sqlQuote(rank)}`).join(" ")} END`;
const ratingValues = scoredDimensions.flatMap((dimension) => [quoteIdent(`${dimension}分`), `${rankCase(dimension)} AS ${quoteIdent(`${dimension}排名`)}`, quoteIdent(`${dimension}百分位`)]);
db.run(`INSERT INTO "命盤評分" SELECT "KEY", ${ratingValues.join(", ")} FROM "_含百分位"`);
for (const dimension of scoredDimensions) db.run(`CREATE INDEX ${quoteIdent(`idx_評分_${dimension}`)} ON "命盤評分"(${quoteIdent(`${dimension}排名`)}, ${quoteIdent(`${dimension}分`)} DESC)`);
db.run('DROP TABLE "_含百分位"');
db.run('DROP TABLE "_命盤原始評分"');

const bytes = Buffer.from(db.export());
db.close();
const gzip = zlib.gzipSync(bytes, { level: 9 });
const hash = crypto.createHash("sha256").update(gzip).digest("hex");
fs.writeFileSync(path.join(dataDir, `ziwei-${year}.sqlite`), bytes);
fs.writeFileSync(path.join(dataDir, `ziwei-${year}.sqlite.gz`), gzip);
const ratingMetadata = [{ name:"KEY", type:"TEXT" }, ...[...DIMENSIONS, "綜合"].flatMap((dimension) => [
  { name:`${dimension}分`, type:"REAL" }, { name:`${dimension}排名`, type:"TEXT" }, { name:`${dimension}百分位`, type:"REAL" },
])];
const metadata = {
  version: 1,
  generatedAt: new Date().toISOString(),
  algorithm: "ziwei-doushu/lib/ziwei/algorithm.ts (iztro bySolar, zh-TW)",
  year,
  rowCount,
  keyFormat: "YYYYMMDD-時辰-性別",
  table: "命盤",
  tables: {
    命盤: columns.map(([name, type]) => ({ name, type: type.split(" ")[0] })),
    星曜亮度: ["KEY","星曜","宮位","星曜類型","星性質","亮度","亮度序","四化"].map((name) => ({ name, type: name === "亮度序" ? "INTEGER" : "TEXT" })),
    亮度等級: [{ name:"亮度", type:"TEXT" }, { name:"亮度序", type:"INTEGER" }],
    命盤評分: ratingMetadata,
    命盤評分明細: ["KEY","規則ID","維度","類型","星曜","宮位","亮度","亮度序","亮度倍率","基礎作用","實際貢獻","說明"].map((name) => ({ name, type: ["亮度序"].includes(name) ? "INTEGER" : ["亮度倍率","基礎作用","實際貢獻"].includes(name) ? "REAL" : "TEXT" })),
    評分規則: ["規則ID","維度","類型","星曜","適用宮位","基礎作用","說明"].map((name) => ({ name, type: name === "基礎作用" ? "REAL" : "TEXT" })),
    評分維度: [{ name:"維度", type:"TEXT" }, { name:"基礎分", type:"REAL" }, { name:"綜合權重", type:"REAL" }],
    排名門檻: [{ name:"排名", type:"TEXT" }, { name:"最低百分位", type:"REAL" }],
  },
  sqlite: `data/ziwei-${year}.sqlite.gz`,
  hash,
  uncompressedBytes: bytes.byteLength,
  compressedBytes: gzip.byteLength,
  columns: columns.map(([name, type]) => ({ name, type: type.split(" ")[0] })),
  stars,
  palaces,
  brightness: ["廟", "旺", "得", "利", "平", "不", "陷"],
  brightnessLevels: Object.fromEntries(BRIGHTNESS_LEVELS),
  palaceSemantics: palaceSpecs,
  scoring: {
    dimensions: [...DIMENSIONS, "綜合"],
    starRules: STAR_RULES.length,
    contextRules: CONTEXT_RULES.length,
    configuration: DIMENSION_CONFIG,
    thresholds: RANK_THRESHOLDS,
    formula: "base + sum(baseEffect × nature/polarity-specific brightnessFactor) + contextual transformations/synergies; clamp 0..100; annual percentile",
  },
};
fs.writeFileSync(path.join(dataDir, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(JSON.stringify({ year, rowCount, columns: columns.length, tables: Object.keys(metadata.tables).length, stars: stars.length, palaces: palaces.length, starRules: STAR_RULES.length, contextRules: CONTEXT_RULES.length, sqliteBytes: bytes.byteLength, gzipBytes: gzip.byteLength, hash }, null, 2));
