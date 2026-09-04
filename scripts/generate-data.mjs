import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import initSqlJs from "sql.js";
import { fileURLToPath } from "node:url";
import { generateChart, HOURS, GENDERS } from "../src/ziwei-algorithm.mjs";

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

const baseColumns = [
  ["KEY", "TEXT PRIMARY KEY"], ["公曆日期", "TEXT NOT NULL"], ["年", "INTEGER NOT NULL"],
  ["月", "INTEGER NOT NULL"], ["日", "INTEGER NOT NULL"], ["時辰", "TEXT NOT NULL"],
  ["時辰序號", "INTEGER NOT NULL"], ["性別", "TEXT NOT NULL"], ["農曆日期", "TEXT NOT NULL"],
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
const columns = [...baseColumns, ...starColumns, ...palaceColumns];

const SQL = await initSqlJs({ locateFile: (file) => path.join(sqlDist, file) });
const db = new SQL.Database();
db.run(`CREATE TABLE 命盤 (${columns.map(([name, type]) => `${quoteIdent(name)} ${type}`).join(", ")})`);
db.run('CREATE INDEX "idx_日期性別" ON "命盤"("公曆日期", "性別", "時辰序號")');
for (const name of ["化祿宮位", "化權宮位", "化科宮位", "化忌宮位", "命宮", "身宮"]) {
  db.run(`CREATE INDEX ${quoteIdent(`idx_${name}`)} ON "命盤"(${quoteIdent(name)})`);
}

const insert = db.prepare(`INSERT INTO 命盤 (${columns.map(([name]) => quoteIdent(name)).join(",")}) VALUES (${columns.map(() => "?").join(",")})`);
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
      insert.run(columns.map(([name]) => values[name] ?? ""));
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

const bytes = Buffer.from(db.export());
db.close();
const gzip = zlib.gzipSync(bytes, { level: 9 });
const hash = crypto.createHash("sha256").update(gzip).digest("hex");
fs.writeFileSync(path.join(dataDir, `ziwei-${year}.sqlite`), bytes);
fs.writeFileSync(path.join(dataDir, `ziwei-${year}.sqlite.gz`), gzip);
const metadata = {
  version: 1,
  generatedAt: new Date().toISOString(),
  algorithm: "ziwei-doushu/lib/ziwei/algorithm.ts (iztro bySolar, zh-TW)",
  year,
  rowCount,
  keyFormat: "YYYYMMDD-時辰-性別",
  table: "命盤",
  sqlite: `data/ziwei-${year}.sqlite.gz`,
  hash,
  uncompressedBytes: bytes.byteLength,
  compressedBytes: gzip.byteLength,
  columns: columns.map(([name, type]) => ({ name, type: type.split(" ")[0] })),
  stars,
  palaces,
  brightness: ["廟", "旺", "得", "利", "平", "不", "陷"],
};
fs.writeFileSync(path.join(dataDir, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(JSON.stringify({ year, rowCount, columns: columns.length, stars: stars.length, palaces: palaces.length, sqliteBytes: bytes.byteLength, gzipBytes: gzip.byteLength, hash }, null, 2));
