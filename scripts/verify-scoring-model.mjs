import { generateChart } from "../src/ziwei-algorithm.mjs";
import { FORMATION_EFFECTS, FORMATION_RULES, KNOWN_INCOMPLETE_PATTERNS, PATTERN_DEFINITIONS, RELATIONSHIP_PATTERN_DEFINITIONS, STAR_NATURE, STAR_RULES, brightnessFactor, scoreChart } from "../src/scoring-model.mjs";
import { EXPLAINED_STAR_NAMES, EXPLAINED_STAR_SET, UNEXPLAINED_STAR_NAMES } from "../src/explained-stars.mjs";

const duplicate = (items) => items.find((item, index) => items.indexOf(item) !== index);
const duplicateId = duplicate(FORMATION_RULES.map((item) => item.id));
const duplicateName = duplicate(FORMATION_RULES.map((item) => item.name));
if (duplicateId || duplicateName) throw new Error(`duplicate formation: ${duplicateId ?? duplicateName}`);
const duplicatePatternId = duplicate(PATTERN_DEFINITIONS.map((item) => item.id));
const duplicatePatternName = duplicate(PATTERN_DEFINITIONS.map((item) => item.name));
if (duplicatePatternId || duplicatePatternName) throw new Error(`duplicate pattern catalog row: ${duplicatePatternId ?? duplicatePatternName}`);
for (const item of PATTERN_DEFINITIONS) {
  if (!item.condition || !item.teachingResult || !item.rarityBasis) throw new Error(`pattern catalog text incomplete: ${item.name}`);
}

const forbidden = new Set(["F-HUTAN-CAI", "F-LINGTAN-CAI", "FEW-FIRE-GREED", "FEW-BELL-GREED"]);
const legacy = FORMATION_RULES.filter((item) => forbidden.has(item.id) || /火貪財格|鈴貪財格/.test(item.name));
if (legacy.length) throw new Error(`legacy non-source wealth formation returned: ${legacy.map((item) => item.id).join(",")}`);

if (EXPLAINED_STAR_NAMES.length !== 36) throw new Error(`expected 36 explained stars, got ${EXPLAINED_STAR_NAMES.length}`);
for (const item of STAR_RULES) if (!EXPLAINED_STAR_SET.has(item.star)) throw new Error(`star rule uses unexplained star: ${item.id} -> ${item.star}`);
for (const star of Object.keys(STAR_NATURE)) if (!EXPLAINED_STAR_SET.has(star)) throw new Error(`star nature uses unexplained star: ${star}`);
for (const forbiddenStar of UNEXPLAINED_STAR_NAMES) {
  const formation = FORMATION_RULES.find((item) => item.stars.includes(forbiddenStar));
  if (formation) throw new Error(`formation uses unexplained star: ${formation.id} -> ${forbiddenStar}`);
}
for (const item of KNOWN_INCOMPLETE_PATTERNS) {
  if (FORMATION_RULES.some((rule) => rule.name === item.name) || FORMATION_EFFECTS[item.id]) throw new Error(`incomplete pattern must not be computed or scored: ${item.name}`);
  if (item.fullyExplained || item.computable) throw new Error(`incomplete pattern status is unsafe: ${item.name}`);
}
for (const name of ["紫府坐垣","七殺朝斗","巨日格","火貴格","雄宿朝元格","半空折翅","日月反背","日月反背夾命","命無正曜格","祿馬交馳","府相會命","廉貞七殺同宮","殺破狼三方會命","科權祿三會命","權祿相逢命","財官雙美","昌曲魁鉞來會","武曲七殺同宮","武曲破軍同宮","廉破同夫妻","廉貪同夫妻","殺星獨守大運","紅鸞天喜交會","日月夾財","紫府夾權","魁鉞夾貴","羊陀夾殺"]) {
  if (!PATTERN_DEFINITIONS.some((item) => item.name === name)) throw new Error(`required pattern missing: ${name}`);
}
const expectedCatalog = new Map([
  ["紫府坐垣", ["正式格局", 5]], ["七殺朝斗", ["正式格局", 5]], ["巨日格", ["正式格局", 3]],
  ["火貴格", ["正式格局", 4]], ["雄宿朝元格", ["正式格局", 5]], ["半空折翅", ["正式格局", 4]],
  ["日月反背", ["正式格局", 4]], ["日月反背夾命", ["正式格局", 4]], ["命無正曜格", ["正式格局", 2]],
  ["祿馬交馳", ["正式格局", 3]], ["府相會命", ["正式格局", 3]], ["殺破狼三方會命", ["正式格局", 4]],
  ["科權祿三會命", ["強組合", 4]], ["權祿相逢命", ["強組合", 3]], ["財官雙美", ["強組合", 4]],
  ["昌曲魁鉞來會", ["強組合", 4]], ["廉貞七殺同宮", ["條件組合", 3]], ["武曲七殺同宮", ["條件組合", 3]],
  ["武曲破軍同宮", ["條件組合", 3]], ["廉破同夫妻", ["條件組合", 3]], ["廉貪同夫妻", ["條件組合", 3]],
  ["殺星獨守大運", ["強組合", 2]], ["紅鸞天喜交會", ["強組合", 2]],
]);
for (const [name, [type, rarity]] of expectedCatalog) {
  const item = PATTERN_DEFINITIONS.find((row) => row.name === name);
  if (item?.type !== type || item?.rarity !== rarity) throw new Error(`pattern catalog classification mismatch: ${name}`);
}
if (RELATIONSHIP_PATTERN_DEFINITIONS.length !== 4 || RELATIONSHIP_PATTERN_DEFINITIONS.some((item) => item.scope !== "兩人命盤")) throw new Error("relationship patterns must remain separate from single-chart ranking");

const regressions = [
  [{ year: 2027, month: 3, day: 1, hour: 4, gender: "male" }, "男", "日月並明"],
  [{ year: 2027, month: 2, day: 15, hour: 7, gender: "male" }, "男", "明珠出海"],
  [{ year: 2027, month: 1, day: 8, hour: 6, gender: "male" }, "男", "火貴格"],
  [{ year: 2027, month: 1, day: 1, hour: 3, gender: "male" }, "男", "殺破狼三方會命"],
  [{ year: 2027, month: 1, day: 1, hour: 4, gender: "male" }, "男", "巨日格"],
];

const results = [];
for (const [input, label, expected] of regressions) {
  const chart = generateChart(input);
  const scored = scoreChart(chart, label);
  const names = scored.formations.map((item) => item.name);
  if (!names.includes(expected)) throw new Error(`${expected} regression failed for ${JSON.stringify(input)}`);
  if (expected === "殺破狼三方會命") {
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
