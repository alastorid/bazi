import { generateChart } from "../src/ziwei-algorithm.mjs";
import { FORMATION_RULES, brightnessFactor, scoreChart } from "../src/scoring-model.mjs";

const duplicate = (items) => items.find((item, index) => items.indexOf(item) !== index);
const duplicateId = duplicate(FORMATION_RULES.map((item) => item.id));
const duplicateName = duplicate(FORMATION_RULES.map((item) => item.name));
if (duplicateId || duplicateName) throw new Error(`duplicate formation: ${duplicateId ?? duplicateName}`);

const forbidden = new Set(["F-HUTAN-CAI", "F-LINGTAN-CAI", "FEW-FIRE-GREED", "FEW-BELL-GREED"]);
const legacy = FORMATION_RULES.filter((item) => forbidden.has(item.id) || /火貪財格|鈴貪財格/.test(item.name));
if (legacy.length) throw new Error(`legacy non-source wealth formation returned: ${legacy.map((item) => item.id).join(",")}`);

const regressions = [
  [{ year: 2027, month: 3, day: 1, hour: 4, gender: "male" }, "男", "日月並明"],
  [{ year: 2027, month: 2, day: 15, hour: 7, gender: "male" }, "男", "明珠出海"],
  [{ year: 2027, month: 1, day: 8, hour: 6, gender: "male" }, "男", "火貴格"],
  [{ year: 2027, month: 1, day: 1, hour: 3, gender: "male" }, "男", "殺破狼會命"],
  [{ year: 2027, month: 2, day: 1, hour: 6, gender: "male" }, "男", "巨日同宮"],
];

const results = [];
for (const [input, label, expected] of regressions) {
  const chart = generateChart(input);
  const scored = scoreChart(chart, label);
  const names = scored.formations.map((item) => item.name);
  if (!names.includes(expected)) throw new Error(`${expected} regression failed for ${JSON.stringify(input)}`);
  if (expected === "殺破狼會命") {
    const locations = Object.fromEntries(chart.palaces.flatMap((palace) => palace.stars.map((star) => [star.name, palace.name])));
    if (!["七殺", "破軍", "貪狼"].every((star) => ["命宮", "財帛", "官祿", "遷移"].includes(locations[star]))) {
      throw new Error("殺破狼 regression did not contain all three stars in 命宮三方四正");
    }
  }
  results.push({ expected, input });
}

if (!(brightnessFactor("太陰", "廟", 8) > brightnessFactor("太陰", "陷", 8))) throw new Error("benefic brightness response reversed");
if (!(brightnessFactor("擎羊", "陷", -6) > brightnessFactor("擎羊", "廟", -6))) throw new Error("challenging negative brightness response reversed");

console.log(JSON.stringify({ ok: true, formationRules: FORMATION_RULES.length, regressions: results }, null, 2));
