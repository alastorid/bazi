import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import initSqlJs from "sql.js";
import { fileURLToPath } from "node:url";
import { generateChart, HOURS, GENDERS } from "../src/ziwei-algorithm.mjs";
import {
  BRIGHTNESS_LEVELS, DIMENSIONS, DIMENSION_CONFIG,
  FORMATION_EFFECTS, FORMATION_RULES, RANK_THRESHOLDS, STAR_NATURE, STAR_RULES,
  TRANSFORM_RULES, scoreChart,
} from "../src/scoring-model.mjs";
import { FAMILY_CONFIG, FAMILY_PERCENTILE_COMPONENTS } from "../src/scoring/config.mjs";
import { scoreFamily } from "../src/scoring/family-scoring.mjs";

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
const familyScoreFields = [
  ["父母分","parents"],["父母財富分","parentsWealth"],["父母負向分","parentsNegative"],["父母品質分","parentsQuality"],
  ["穩定財富分","stableWealth"],["爆發財富分","explosiveWealth"],["自身財富分","selfWealth"],["外貌分","appearance"],
  ["戀愛分","romance"],["婚姻分","marriage"],["婚姻時機分","marriageTiming"],["子女分","children"],
  ["真子女宮強度分","childrenPalaceStrength"],["子女時機分","childrenTiming"],["家庭時機分","familyTiming"],
  ["家庭品質原始分","familyRaw"],["家庭品質分","familyQuality"],["家庭平衡分","familyBalance"],
];
const familyPercentileScore = new Map(FAMILY_PERCENTILE_COMPONENTS.map((name) => [name, `${name}分`]));

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
  [`${label}地支`, "TEXT NOT NULL"],
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

db.run('CREATE TABLE "格局規則" ("規則ID" TEXT PRIMARY KEY, "名稱" TEXT NOT NULL, "吉凶" TEXT NOT NULL, "相關星曜" TEXT NOT NULL, "條件說明" TEXT NOT NULL)');
const formationRuleInsert = db.prepare('INSERT INTO "格局規則" VALUES (?, ?, ?, ?, ?)');
for (const item of FORMATION_RULES) formationRuleInsert.run([item.id, item.name, item.polarity, item.stars, item.description]);
formationRuleInsert.free();
db.run('CREATE TABLE "格局規則作用" ("規則ID" TEXT NOT NULL REFERENCES "格局規則"("規則ID"), "維度" TEXT NOT NULL, "適用性別" TEXT NOT NULL, "基礎作用" REAL NOT NULL, PRIMARY KEY ("規則ID", "維度", "適用性別"))');
const formationEffectInsert = db.prepare('INSERT INTO "格局規則作用" VALUES (?, ?, ?, ?)');
for (const item of FORMATION_RULES) for (const [dimension, configured] of Object.entries(FORMATION_EFFECTS[item.id] ?? {})) {
  if (typeof configured === "number") formationEffectInsert.run([item.id, dimension, "全部", configured]);
  else for (const [gender, value] of Object.entries(configured)) formationEffectInsert.run([item.id, dimension, gender, value]);
}
formationEffectInsert.free();
db.run(`CREATE TABLE "命盤格局" ("KEY" TEXT PRIMARY KEY REFERENCES "命盤"("KEY"), ${FORMATION_RULES.map((item) => `${quoteIdent(item.name)} INTEGER NOT NULL`).join(", ")}, "成格數" INTEGER NOT NULL, "凶格數" INTEGER NOT NULL)`);
db.run('CREATE INDEX "idx_命盤格局_成格數" ON "命盤格局"("成格數" DESC)');

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
for (const item of TRANSFORM_RULES) scoringRuleInsert.run([item.id, item.dimension, "四化", `化${item.mutagen}`, item.palace, item.base, item.description]);
for (const item of FORMATION_RULES) for (const [dimension, configured] of Object.entries(FORMATION_EFFECTS[item.id] ?? {})) {
  const values = typeof configured === "number" ? [configured] : Object.values(configured);
  scoringRuleInsert.run([`${item.id}-${dimension}`, dimension, "格局", item.stars, "實際落宮", values[0], item.description]);
}
scoringRuleInsert.free();
db.run('CREATE TABLE "命盤評分明細" ("KEY" TEXT NOT NULL REFERENCES "命盤"("KEY"), "規則ID" TEXT NOT NULL REFERENCES "評分規則"("規則ID"), "維度" TEXT NOT NULL, "類型" TEXT NOT NULL, "星曜" TEXT NOT NULL, "宮位" TEXT NOT NULL, "亮度" TEXT NOT NULL, "亮度序" INTEGER, "亮度倍率" REAL NOT NULL, "基礎作用" REAL NOT NULL, "實際貢獻" REAL NOT NULL, "說明" TEXT NOT NULL)');
db.run('CREATE INDEX "idx_評分明細_KEY" ON "命盤評分明細"("KEY", "維度")');
db.run('CREATE INDEX "idx_評分明細_星曜" ON "命盤評分明細"("星曜", "宮位", "亮度序")');
const scoreSchema = [...DIMENSIONS, "綜合"].map((dimension) => `${quoteIdent(`${dimension}分`)} REAL NOT NULL`).join(", ");
db.run(`CREATE TEMP TABLE "_命盤原始評分" ("KEY" TEXT PRIMARY KEY, ${scoreSchema})`);
const familyRawSchema = familyScoreFields.map(([name]) => `${quoteIdent(name)} REAL NOT NULL`).join(", ");
db.run(`CREATE TEMP TABLE "_命盤家庭原始評分" (
  "KEY" TEXT PRIMARY KEY, "出生時間" TEXT NOT NULL, "時辰代表小時" INTEGER NOT NULL,
  ${familyRawSchema}, "真子女宮有主星" INTEGER NOT NULL, "真子女宮來源" TEXT NOT NULL,
  "最佳婚姻年齡" INTEGER, "最佳婚姻年份" INTEGER, "婚姻窗口起始年齡" INTEGER, "婚姻窗口結束年齡" INTEGER,
  "最佳子女年齡" INTEGER, "最佳子女年份" INTEGER, "婚姻觸發數" INTEGER NOT NULL,
  "大限紅鸞" INTEGER NOT NULL, "大限天喜" INTEGER NOT NULL, "小限紅鸞" INTEGER NOT NULL, "小限天喜" INTEGER NOT NULL,
  "流年紅鸞" INTEGER NOT NULL, "流年天喜" INTEGER NOT NULL, "婚姻主要原因" TEXT NOT NULL, "子女主要原因" TEXT NOT NULL
)`);
db.run('CREATE TABLE "命盤婚育時機" ("KEY" TEXT NOT NULL REFERENCES "命盤"("KEY"), "年齡" INTEGER NOT NULL, "年份" INTEGER NOT NULL, "大限範圍" TEXT NOT NULL, "大限本命宮位" TEXT NOT NULL, "小限本命宮位" TEXT NOT NULL, "大限紅鸞" INTEGER NOT NULL, "大限天喜" INTEGER NOT NULL, "小限紅鸞" INTEGER NOT NULL, "小限天喜" INTEGER NOT NULL, "流年紅鸞" INTEGER NOT NULL, "流年天喜" INTEGER NOT NULL, "婚姻觸發數" INTEGER NOT NULL, "婚姻觸發分" REAL NOT NULL, "子女觸發分" REAL NOT NULL, "家庭時機分" REAL NOT NULL, "婚姻原因" TEXT NOT NULL, "子女原因" TEXT NOT NULL, PRIMARY KEY("KEY","年齡"))');
db.run('CREATE INDEX "idx_婚育時機_KEY分數" ON "命盤婚育時機"("KEY","家庭時機分" DESC)');
db.run('CREATE TABLE "命盤家庭評分明細" ("KEY" TEXT NOT NULL REFERENCES "命盤"("KEY"), "規則ID" TEXT NOT NULL, "組件" TEXT NOT NULL, "類型" TEXT NOT NULL, "星曜" TEXT NOT NULL, "宮位" TEXT NOT NULL, "亮度" TEXT NOT NULL, "亮度序" INTEGER, "亮度倍率" REAL NOT NULL, "基礎作用" REAL NOT NULL, "實際貢獻" REAL NOT NULL, "年齡" INTEGER, "年份" INTEGER, "說明" TEXT NOT NULL)');
db.run('CREATE INDEX "idx_家庭明細_KEY組件" ON "命盤家庭評分明細"("KEY","組件")');

const insert = db.prepare(`INSERT INTO 命盤 (${columns.map(([name]) => quoteIdent(name)).join(",")}) VALUES (${columns.map(() => "?").join(",")})`);
const brightnessInsert = db.prepare('INSERT INTO "星曜亮度" VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const scoreInsert = db.prepare(`INSERT INTO "_命盤原始評分" VALUES (${["KEY", ...DIMENSIONS, "綜合"].map(() => "?").join(",")})`);
const scoreDetailInsert = db.prepare('INSERT INTO "命盤評分明細" VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const formationInsert = db.prepare(`INSERT INTO "命盤格局" VALUES (${Array(FORMATION_RULES.length + 3).fill("?").join(",")})`);
const familyInsert = db.prepare(`INSERT INTO "_命盤家庭原始評分" VALUES (${Array(38).fill("?").join(",")})`);
const timingInsert = db.prepare(`INSERT INTO "命盤婚育時機" VALUES (${Array(18).fill("?").join(",")})`);
const familyDetailInsert = db.prepare(`INSERT INTO "命盤家庭評分明細" VALUES (${Array(14).fill("?").join(",")})`);
db.run("BEGIN");
let rowCount = 0;
console.log(`Generating ${dates.length * HOURS.length * GENDERS.length} charts for ${year}…`);
for (const date of dates) {
  for (const hour of HOURS) {
    for (const gender of GENDERS) {
      const chart = generateChart({ ...date, hour: hour.index, gender: gender.code, timingAgeRange: FAMILY_CONFIG.marriageAgeRange });
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
        values[`${spec.label}地支`] = byPalace.get(spec.raw)?.branch ?? "";
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
      const rating = scoreChart(chart, gender.label);
      scoreInsert.run([values.KEY, ...DIMENSIONS.map((dimension) => rating.scores[dimension]), rating.scores.綜合]);
      for (const item of rating.details) {
        scoreDetailInsert.run([
          values.KEY, item.id, item.dimension, item.type, item.star, item.palace,
          item.brightness, item.brightnessOrder, item.factor, item.base, item.contribution, item.description,
        ]);
      }
      const family = scoreFamily(chart, gender.label);
      const bestMarriage = family.timing.bestMarriage ?? {};
      familyInsert.run([
        values.KEY, `${iso} ${String(hour.index * 2).padStart(2,"0")}:00`, hour.index * 2,
        ...familyScoreFields.map(([,property]) => family.scores[property]),
        Number(family.flags.childrenPalaceHasMajorStar), family.flags.childrenPalaceSource,
        family.timing.bestMarriageAge, family.timing.bestMarriageYear, family.timing.windowStartAge, family.timing.windowEndAge,
        family.timing.bestChildrenAge, family.timing.bestChildrenYear, bestMarriage.marriageTriggerCount ?? 0,
        Number(bestMarriage.majorPeriodHongluan), Number(bestMarriage.majorPeriodTianxi),
        Number(bestMarriage.minorPeriodHongluan), Number(bestMarriage.minorPeriodTianxi),
        Number(bestMarriage.yearlyHongluan), Number(bestMarriage.yearlyTianxi),
        (bestMarriage.marriageReasons ?? []).join("；"), (family.timing.bestChildren?.childrenReasons ?? []).join("；"),
      ]);
      const formationCounts = rating.formations.reduce((acc, item) => { acc[item.polarity === "吉" ? "吉" : "凶"] += 1; return acc; }, { 吉: 0, 凶: 0 });
      formationInsert.run([
        values.KEY,
        ...FORMATION_RULES.map((item) => rating.formationFlags[item.name]),
        formationCounts.吉, formationCounts.凶,
      ]);
      for (const period of family.timing.rows) timingInsert.run([
        values.KEY, period.age, period.year, period.decadalRange, period.decadalPalace, period.minorPalace,
        Number(period.majorPeriodHongluan), Number(period.majorPeriodTianxi),
        Number(period.minorPeriodHongluan), Number(period.minorPeriodTianxi),
        Number(period.yearlyHongluan), Number(period.yearlyTianxi), period.marriageTriggerCount,
        period.marriageTriggerScore, period.childrenTriggerScore, period.familyTimingScore,
        period.marriageReasons.join("；"), period.childrenReasons.join("；"),
      ]);
      for (const item of family.evidence) familyDetailInsert.run([
        values.KEY, item.ruleId, item.component, item.type, item.star, item.palace, item.brightness,
        item.brightnessOrder, item.factor, item.base, item.contribution, item.age, item.year, item.description,
      ]);
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
formationInsert.free();
familyInsert.free();
timingInsert.free();
familyDetailInsert.free();

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

const familyPercentileColumns = FAMILY_PERCENTILE_COMPONENTS.map((name) => `ROUND(PERCENT_RANK() OVER (ORDER BY ${quoteIdent(familyPercentileScore.get(name))} ASC) * 100, 2) AS ${quoteIdent(`${name}百分位`)}`);
db.run(`CREATE TEMP TABLE "_家庭含百分位" AS SELECT *, ${familyPercentileColumns.join(", ")} FROM "_命盤家庭原始評分"`);
const percentileRankCase = (column) => `CASE ${RANK_THRESHOLDS.map(([rank, minimum]) => `WHEN ${quoteIdent(column)} >= ${minimum} THEN ${sqlQuote(rank)}`).join(" ")} END`;
db.run(`CREATE TABLE "命盤家庭評分" AS SELECT *,
  ${percentileRankCase("家庭品質百分位")} AS "家庭品質排名",
  ${percentileRankCase("家庭平衡百分位")} AS "家庭平衡排名",
  CAST(NULL AS REAL) AS "家庭品質全域百分位"
FROM "_家庭含百分位"`);
db.run('CREATE UNIQUE INDEX "idx_家庭評分_KEY" ON "命盤家庭評分"("KEY")');
db.run('CREATE INDEX "idx_家庭評分_品質" ON "命盤家庭評分"("家庭品質百分位" DESC)');
db.run('CREATE INDEX "idx_家庭評分_平衡" ON "命盤家庭評分"("家庭平衡百分位" DESC)');
db.run(`CREATE VIEW "family_scores" AS SELECT
  f."KEY" AS "KEY", f."出生時間" AS "birth_datetime", m."命盤連結" AS "metis_url",
  f."父母分" AS "parents_score", f."父母百分位" AS "parents_pr_year",
  f."父母財富分" AS "parents_wealth_score", f."父母財富百分位" AS "parents_wealth_pr_year",
  f."父母負向分" AS "parents_negative_score", f."父母品質分" AS "parents_quality_score", f."父母品質百分位" AS "parents_quality_pr_year",
  f."穩定財富分" AS "stable_wealth_score", f."穩定財富百分位" AS "stable_wealth_pr_year",
  f."爆發財富分" AS "explosive_wealth_score", f."爆發財富百分位" AS "explosive_wealth_pr_year",
  f."自身財富分" AS "self_wealth_score", f."自身財富百分位" AS "self_wealth_pr_year",
  f."外貌分" AS "appearance_score", f."外貌百分位" AS "appearance_pr_year",
  f."戀愛分" AS "romance_score", f."戀愛百分位" AS "romance_pr_year",
  f."婚姻分" AS "marriage_score", f."婚姻百分位" AS "marriage_pr_year", f."婚姻時機分" AS "marriage_timing_score", f."婚姻時機百分位" AS "marriage_timing_pr_year",
  f."子女分" AS "children_score", f."子女百分位" AS "children_pr_year", f."真子女宮強度分" AS "children_palace_strength", f."子女時機分" AS "children_timing_score",
  f."家庭品質原始分" AS "family_quality_raw", f."家庭品質分" AS "family_quality_score", f."家庭品質百分位" AS "family_quality_pr_year", f."家庭品質全域百分位" AS "family_quality_pr_global",
  f."家庭平衡分" AS "family_balance_score", f."家庭平衡百分位" AS "family_balance_pr_year",
  f."真子女宮有主星" AS "children_palace_has_major_star", f."真子女宮來源" AS "children_palace_source",
  f."最佳婚姻年齡" AS "best_marriage_age", f."最佳婚姻年份" AS "best_marriage_year", f."婚姻窗口起始年齡" AS "marriage_window_start_age", f."婚姻窗口結束年齡" AS "marriage_window_end_age",
  f."最佳子女年齡" AS "best_children_age", f."最佳子女年份" AS "best_children_year", f."婚姻觸發數" AS "marriage_trigger_count",
  f."大限紅鸞" AS "major_period_hongluan", f."大限天喜" AS "major_period_tianxi", f."小限紅鸞" AS "minor_period_hongluan", f."小限天喜" AS "minor_period_tianxi"
FROM "命盤家庭評分" f JOIN "命盤" m ON m."KEY"=f."KEY"`);
db.run('DROP TABLE "_家庭含百分位"');
db.run('DROP TABLE "_命盤家庭原始評分"');

const bytes = Buffer.from(db.export());
db.close();
const gzip = zlib.gzipSync(bytes, { level: 9 });
const hash = crypto.createHash("sha256").update(gzip).digest("hex");
fs.writeFileSync(path.join(dataDir, `ziwei-${year}.sqlite`), bytes);
fs.writeFileSync(path.join(dataDir, `ziwei-${year}.sqlite.gz`), gzip);
const ratingMetadata = [{ name:"KEY", type:"TEXT" }, ...[...DIMENSIONS, "綜合"].flatMap((dimension) => [
  { name:`${dimension}分`, type:"REAL" }, { name:`${dimension}排名`, type:"TEXT" }, { name:`${dimension}百分位`, type:"REAL" },
])];
const familyMetadataNames = [
  "KEY","出生時間","時辰代表小時",...familyScoreFields.map(([name])=>name),"真子女宮有主星","真子女宮來源",
  "最佳婚姻年齡","最佳婚姻年份","婚姻窗口起始年齡","婚姻窗口結束年齡","最佳子女年齡","最佳子女年份","婚姻觸發數",
  "大限紅鸞","大限天喜","小限紅鸞","小限天喜","流年紅鸞","流年天喜","婚姻主要原因","子女主要原因",
  ...FAMILY_PERCENTILE_COMPONENTS.map((name)=>`${name}百分位`),"家庭品質排名","家庭平衡排名","家庭品質全域百分位",
];
const familyIntegerNames = new Set(["時辰代表小時","真子女宮有主星","最佳婚姻年齡","最佳婚姻年份","婚姻窗口起始年齡","婚姻窗口結束年齡","最佳子女年齡","最佳子女年份","婚姻觸發數","大限紅鸞","大限天喜","小限紅鸞","小限天喜","流年紅鸞","流年天喜"]);
const familyTextNames = new Set(["KEY","出生時間","真子女宮來源","婚姻主要原因","子女主要原因","家庭品質排名","家庭平衡排名"]);
const familyMetadata = familyMetadataNames.map((name)=>({name,type:familyTextNames.has(name)?"TEXT":familyIntegerNames.has(name)?"INTEGER":"REAL"}));
const familyViewIntegerNames = new Set(["children_palace_has_major_star","best_marriage_age","best_marriage_year","marriage_window_start_age","marriage_window_end_age","best_children_age","best_children_year","marriage_trigger_count","major_period_hongluan","major_period_tianxi","minor_period_hongluan","minor_period_tianxi"]);
const familyViewMetadata = ["KEY","birth_datetime","metis_url","parents_score","parents_pr_year","parents_wealth_score","parents_wealth_pr_year","parents_negative_score","parents_quality_score","parents_quality_pr_year","stable_wealth_score","stable_wealth_pr_year","explosive_wealth_score","explosive_wealth_pr_year","self_wealth_score","self_wealth_pr_year","appearance_score","appearance_pr_year","romance_score","romance_pr_year","marriage_score","marriage_pr_year","marriage_timing_score","marriage_timing_pr_year","children_score","children_pr_year","children_palace_strength","children_timing_score","family_quality_raw","family_quality_score","family_quality_pr_year","family_quality_pr_global","family_balance_score","family_balance_pr_year","children_palace_has_major_star","children_palace_source","best_marriage_age","best_marriage_year","marriage_window_start_age","marriage_window_end_age","best_children_age","best_children_year","marriage_trigger_count","major_period_hongluan","major_period_tianxi","minor_period_hongluan","minor_period_tianxi"].map((name)=>({name,type:["KEY","birth_datetime","metis_url","children_palace_source"].includes(name)?"TEXT":familyViewIntegerNames.has(name)?"INTEGER":"REAL"}));
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
    格局規則: ["規則ID","名稱","吉凶","相關星曜","條件說明"].map((name) => ({ name, type: "TEXT" })),
    格局規則作用: ["規則ID","維度","適用性別","基礎作用"].map((name) => ({ name, type: name === "基礎作用" ? "REAL" : "TEXT" })),
    命盤格局: ["KEY", ...FORMATION_RULES.map((item) => item.name), "成格數","凶格數"].map((name) => ({ name, type: name === "KEY" ? "TEXT" : "INTEGER" })),
    評分規則: ["規則ID","維度","類型","星曜","適用宮位","基礎作用","說明"].map((name) => ({ name, type: name === "基礎作用" ? "REAL" : "TEXT" })),
    評分維度: [{ name:"維度", type:"TEXT" }, { name:"基礎分", type:"REAL" }, { name:"綜合權重", type:"REAL" }],
    排名門檻: [{ name:"排名", type:"TEXT" }, { name:"最低百分位", type:"REAL" }],
    命盤家庭評分: familyMetadata,
    命盤家庭評分明細: ["KEY","規則ID","組件","類型","星曜","宮位","亮度","亮度序","亮度倍率","基礎作用","實際貢獻","年齡","年份","說明"].map((name)=>({name,type:["亮度倍率","基礎作用","實際貢獻"].includes(name)?"REAL":["亮度序","年齡","年份"].includes(name)?"INTEGER":"TEXT"})),
    命盤婚育時機: ["KEY","年齡","年份","大限範圍","大限本命宮位","小限本命宮位","大限紅鸞","大限天喜","小限紅鸞","小限天喜","流年紅鸞","流年天喜","婚姻觸發數","婚姻觸發分","子女觸發分","家庭時機分","婚姻原因","子女原因"].map((name)=>({name,type:["婚姻觸發分","子女觸發分","家庭時機分"].includes(name)?"REAL":["年齡","年份","大限紅鸞","大限天喜","小限紅鸞","小限天喜","流年紅鸞","流年天喜","婚姻觸發數"].includes(name)?"INTEGER":"TEXT"})),
    family_scores: familyViewMetadata,
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
    standard: "倪海廈《天紀》紫微斗數：四化為主、命宮三方四正論總格、星得正位、吉處藏凶必凶",
    sources: ["天纪-天机道.pdf", "紫微斗数案例资料.doc", "天机道听课笔记.doc"],
    starRules: STAR_RULES.length,
    transformRules: TRANSFORM_RULES.length,
    formationRules: FORMATION_RULES.length,
    configuration: DIMENSION_CONFIG,
    thresholds: RANK_THRESHOLDS,
    formula: "單星宮位作用（依星性質與亮度調節）＋四化宮位作用＋高權重複合格局；原始分不截斷，排名以當年百分位計算",
    family: {
      configuration: FAMILY_CONFIG,
      percentileDenominator: rowCount,
      globalPercentile: "unavailable: yearly artifacts are independent",
      balanceMethod: "weighted harmonic mean minus the configured parents-negative penalty",
    },
  },
};
fs.writeFileSync(path.join(dataDir, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(JSON.stringify({ year, rowCount, columns: columns.length, tables: Object.keys(metadata.tables).length, stars: stars.length, palaces: palaces.length, starRules: STAR_RULES.length, transformRules: TRANSFORM_RULES.length, formationRules: FORMATION_RULES.length, sqliteBytes: bytes.byteLength, gzipBytes: gzip.byteLength, hash }, null, 2));
