// 倪海廈《天紀》紫微斗數評分模型。
// 什麼是好、什麼是壞，完全依《天紀》紫微斗數課程（星辰篇、十二宮實批）的明確標準：
//   1. 先看四化（科權祿忌）所在宮；化忌所在宮或對沖的宮，十年事倍功半。
//   2. 命宮三方四正（命、財帛、官祿、遷移）論總格；成格者貴，破格者凶。
//   3. 星得正位：官星入官祿最好，財星入財帛最好。
//   4. 亮度：廟旺為吉，得稍弱於旺，利為小吉，平閒主無用，陷主凶；殺星落陷大凶。
//   5. 吉處藏凶必凶；凶處藏吉平安。
//   6. 夫妻宮必須與福德宮一起看；疾厄宮只做參考。
// 本檔案是唯一版本控制來源；資料庫的 評分規則／命盤評分明細／命盤格局 都由此生成。

export const DIMENSIONS = ["幸運", "財富", "經商", "社交", "事業", "官運", "專業", "科甲", "才藝", "外貌", "魅力", "桃花", "婚姻"];

export const DIMENSION_CONFIG = Object.fromEntries(DIMENSIONS.map((name) => [name, { baseScore: 0, overallWeight: 1 }]));

// This is an ordinal query scale, not a score. Contribution strength is
// determined separately by star nature, rule polarity, palace, and dignity.
export const BRIGHTNESS_LEVELS = [
  ["陷", 1], ["不", 2], ["平", 3], ["利", 4],
  ["得", 5], ["旺", 6], ["廟", 7],
];

export const RANK_THRESHOLDS = [
  ["SSS", 99], ["SSR", 96], ["SS", 90], ["S", 80], ["A", 60],
  ["B", 35], ["C", 20], ["D", 10], ["E", 4], ["F", 0],
];

import { EXPLAINED_STAR_SET } from "./explained-stars.mjs";

// 星性質依倪師定義：紫微系善星與六吉為 benefic；武曲（財星王兼武官）、
// 廉貞、貪狼、巨門（凶星但廟旺口才好、巨富）為 mixed；殺破狼與六殺（擎羊、
// 陀羅、火星、鈴星、天空、地劫）及天刑（是非官司刑剋）為 challenging。
export const STAR_NATURE = {
  紫微: "benefic", 天機: "benefic", 太陽: "benefic", 天同: "benefic", 天府: "benefic",
  太陰: "benefic", 天相: "benefic", 天梁: "benefic", 左輔: "benefic", 右弼: "benefic",
  文昌: "benefic", 文曲: "benefic", 天魁: "benefic", 天鉞: "benefic", 祿存: "benefic",
  武曲: "mixed", 廉貞: "mixed", 貪狼: "mixed", 巨門: "mixed",
  天馬: "mixed", 紅鸞: "mixed", 天喜: "mixed",
  七殺: "challenging", 破軍: "challenging",
  擎羊: "challenging", 陀羅: "challenging", 火星: "challenging", 鈴星: "challenging",
  天空: "challenging", 地空: "challenging", 地劫: "challenging", 天刑: "challenging",
  三台: "benefic", 八座: "benefic", 天巫: "benefic", 解神: "benefic",
};

for (const star of Object.keys(STAR_NATURE)) {
  if (!EXPLAINED_STAR_SET.has(star)) throw new Error(`未解釋星曜不得進入星性表：${star}`);
}

// 倪師亮度法：吉星廟旺吉；平閒無用（吉星陷近乎無力）；殺星廟旺為凶處藏吉
// （可控），殺星落陷大凶；巨門等 mixed 星廟旺成格、落陷主牢獄。
const RESPONSE = {
  benefic: {
    positive: { 陷: 0.30, 不: 0.45, 平: 0.62, 利: 0.82, 得: 1.00, 旺: 1.15, 廟: 1.25 },
    negative: { 陷: 1.15, 不: 1.08, 平: 1.00, 利: 0.95, 得: 0.90, 旺: 0.85, 廟: 0.80 },
  },
  mixed: {
    positive: { 陷: 0.25, 不: 0.40, 平: 0.60, 利: 0.85, 得: 1.05, 旺: 1.20, 廟: 1.30 },
    negative: { 陷: 1.35, 不: 1.22, 平: 1.05, 利: 0.95, 得: 0.88, 旺: 0.82, 廟: 0.78 },
  },
  challenging: {
    positive: { 陷: 0.20, 不: 0.35, 平: 0.55, 利: 0.75, 得: 0.95, 旺: 1.05, 廟: 1.10 },
    negative: { 陷: 1.40, 不: 1.25, 平: 1.05, 利: 0.95, 得: 0.85, 旺: 0.78, 廟: 0.72 },
  },
};

const brightnessOrder = new Map(BRIGHTNESS_LEVELS);

export function brightnessFactor(star, brightness, signedBase) {
  const nature = STAR_NATURE[star] ?? "mixed";
  const polarity = signedBase >= 0 ? "positive" : "negative";
  return RESPONSE[nature][polarity][brightness] ?? 1;
}

const rule = (id, dimension, star, palaces, base, description, options = {}) => ({ id, dimension, star, palaces, base, description, ...options });

// ─── 星得正位（倪師：官星入官祿最好、財星入財帛最好；化權入官祿最好）───
export const STAR_RULES = [
  rule("財-祿存財帛", "財富", "祿存", ["財帛"], 99, "祿存入財帛：大財星得位"),
  rule("財-武曲財帛", "財富", "武曲", ["財帛"], 99, "武曲入財帛：大財星得位"),
  rule("財-貪狼財帛", "財富", "貪狼", ["財帛"], 99, "貪狼入財帛：大財星得位"),
  rule("商-巨門財帛", "經商", "巨門", ["財帛"], -500, "巨門入財帛：不利自行經商"),
  rule("婚-天府夫妻", "婚姻", "天府", ["夫妻"], 100, "天府入夫妻：溫和持家"),
  rule("婚-天馬夫妻", "婚姻", "天馬", ["夫妻"], 100, "天馬入夫妻：吃苦耐勞"),
  rule("婚-巨門夫妻", "婚姻", "巨門", ["夫妻"], -100, "巨門入夫妻：口角嘮叨"),
  rule("婚-破軍夫妻", "婚姻", "破軍", ["夫妻"], -500, "破軍入夫妻：婚姻重大不利"),
  rule("科-文昌命", "科甲", "文昌", ["命宮"], 100, "文昌入命：科甲、讀書考試"),
  rule("藝-文曲命", "才藝", "文曲", ["命宮"], 100, "文曲入命：才藝、博學、斯文"),
  rule("貌-太陰女命", "外貌", "太陰", ["命宮"], 300, "女命太陰入命：漂亮", { genders: ["女"] }),
  rule("貌-紅鸞命", "外貌", "紅鸞", ["命宮"], 100, "紅鸞入命：外貌加分"),
  rule("桃-紅鸞命", "桃花", "紅鸞", ["命宮"], 150, "紅鸞入命：桃花與婚緣"),
  rule("婚-紅鸞男命", "婚姻", "紅鸞", ["命宮"], 300, "男命紅鸞入命：配偶外貌加分", { genders: ["男"] }),
  rule("婚-紅鸞女命", "婚姻", "紅鸞", ["命宮"], 300, "女命紅鸞入命：配偶品質加分", { genders: ["女"] }),
  rule("桃-天喜命", "桃花", "天喜", ["命宮"], 100, "天喜入命：桃花與喜慶"),
  rule("桃-廉貞命", "桃花", "廉貞", ["命宮"], 50, "廉貞入命：次桃花"),
  rule("桃-貪狼命", "桃花", "貪狼", ["命宮"], 100, "貪狼入命：桃花、酒色財氣；正桃花另限亥子"),
];

// ─── 具名格局（倪師《天紀》明確定義的成格／破格條件）───
// check(ctx, gender) 回傳 true 表示成格；旗標寫入 命盤格局 表（結構成立即為 1，
// 含性別條件的格局只在符合性別的列上為 1），評分貢獻另計入命盤評分明細。
// 中間兩個參數保留現有格局宣告的可讀分組位置，但不參與評分；
// 真正的多維度作用只由 FORMATION_EFFECTS 定義。
const formation = (id, name, polarity, _group, _legacyBase, stars, description, check) =>
  ({ id, name, polarity, stars, description, check });

const BRANCH_ORDER = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

function buildContext(chart) {
  const palaces = chart.palaces;
  const friendName = palaces.some((p) => p.name === "僕役") ? "僕役" : "交友";
  const byPalace = new Map(palaces.map((p) => [p.name, p]));
  const byBranch = new Map(palaces.map((p) => [p.branch, p]));
  const stars = palaces.flatMap((p) => p.stars.map((s) => ({ ...s, palace: p.name })));
  const byStar = new Map(stars.map((s) => [s.name, s]));
  const siHua = new Map(stars.filter((s) => ["祿", "權", "科", "忌"].includes(s.siHua)).map((s) => [s.siHua, s]));
  const mingPalace = byPalace.get("命宮");
  const mingBranch = mingPalace?.branch ?? chart.soulBranch;
  const at = (star) => byStar.get(star);
  const inPalace = (star, palace) => at(star)?.palace === palace;
  const inBranch = (star, branch) => byPalace.get(at(star)?.palace)?.branch === branch;
  const orderOf = (star) => brightnessOrder.get(at(star)?.brightness ?? "") ?? 0;
  const isFallen = (star) => orderOf(star) > 0 && orderOf(star) <= 2;
  const samePalace = (...names) => {
    const palace = at(names[0])?.palace;
    return Boolean(palace) && names.every((name) => at(name)?.palace === palace);
  };
  const threeWay = ["命宮", "財帛", "官祿", "遷移"];
  const inThreeWay = (star) => threeWay.includes(at(star)?.palace);
  const neighbors = [BRANCH_ORDER[(BRANCH_ORDER.indexOf(mingBranch) + 11) % 12], BRANCH_ORDER[(BRANCH_ORDER.indexOf(mingBranch) + 1) % 12]]
    .map((branch) => byBranch.get(branch)?.name).filter(Boolean);
  const majorNames = (palace) => (byPalace.get(palace)?.stars ?? []).filter((s) => s.type === "major").map((s) => s.name);
  // 夾命：兩顆星必須分踞命宮兩側（同宮不成立）。
  const straddle = (a, b) => {
    const pa = at(a)?.palace, pb = at(b)?.palace;
    return Boolean(pa && pb && pa !== pb && neighbors.length === 2 && neighbors.includes(pa) && neighbors.includes(pb));
  };
  const auxStars = ["左輔", "右弼", "天魁", "天鉞", "文昌", "文曲", "祿存"];
  const shaStars = ["擎羊", "陀羅", "火星", "鈴星", "天空", "地劫"];
  return {
    chart, palaces, byPalace, byBranch, stars, at, inPalace, inBranch, orderOf, isFallen, samePalace,
    siHua, mutagenPalace: (m) => siHua.get(m)?.palace ?? "", mutagenStar: (m) => siHua.get(m)?.name ?? "",
    mingBranch, neighbors, majorNames, straddle, threeWay, inThreeWay, friendName,
    auxStars, shaStars,
    threeWayAux: auxStars.filter((s) => inThreeWay(s)),
    threeWaySha: shaStars.filter((s) => inThreeWay(s)),
    bodyPalace: chart.bodyPalaceName ?? "",
  };
}

export const FORMATION_RULES = [
  // ── 吉格 ──
  formation("F-ZIFU-YAN", "紫府坐垣", "吉", "格局", 14, "紫微、天府",
    "命宮在寅，紫微天府同入廟坐命：位列三台，將相之格，爵祿榮昌",
    (c) => c.mingBranch === "寅" && c.samePalace("紫微", "天府")
      && c.inPalace("紫微", "命宮") && c.orderOf("紫微") >= 6 && c.orderOf("天府") >= 6),
  formation("F-SHA-CHAO", "七殺朝斗", "吉", "格局", 12, "七殺",
    "七殺獨坐入廟於申宮命宮：將星入命，威震邊疆，爵祿榮昌",
    (c) => c.inPalace("七殺", "命宮") && c.mingBranch === "申"
      && c.orderOf("七殺") >= 6 && c.majorNames("命宮").join("、") === "七殺"),
  formation("F-RIYUE-BING", "日月並明", "吉", "格局", 12, "太陽、太陰",
    "太陽旺辰、太陰旺戌而命在辰戌，或命在丑而太陽旺巳、太陰旺酉：主一世榮華",
    (c) => ((c.mingBranch === "辰" || c.mingBranch === "戌") && c.inBranch("太陽", "辰") && c.inBranch("太陰", "戌")
      && c.orderOf("太陽") >= 6 && c.orderOf("太陰") >= 6)
      || (c.mingBranch === "丑" && c.inBranch("太陽", "巳") && c.inBranch("太陰", "酉")
        && c.orderOf("太陽") >= 6 && c.orderOf("太陰") >= 6)),
  formation("F-YUE-LANG", "月朗天門", "吉", "格局", 12, "太陰",
    "太陰入廟坐命亥宮：女命最吉，十年大運逢之大好",
    (c) => c.inPalace("太陰", "命宮") && c.mingBranch === "亥" && c.orderOf("太陰") >= 6),
  formation("F-RI-ZHAO", "日照雷門", "吉", "格局", 12, "太陽",
    "太陽入廟坐命卯宮：男命最吉，十年大運逢之大好",
    (c) => c.inPalace("太陽", "命宮") && c.mingBranch === "卯" && c.orderOf("太陽") >= 6),
  formation("F-RI-LI", "日麗中天", "吉", "格局", 10, "太陽",
    "太陽入廟坐命午宮：武職大利",
    (c) => c.inPalace("太陽", "命宮") && c.mingBranch === "午" && c.orderOf("太陽") >= 6),
  formation("F-MINGZHU", "明珠出海", "吉", "格局", 10, "太陽、太陰",
    "命宮在未，太陰廟亥、太陽廟卯：父母雙全，個性公正清明，逢科權祿主事業大利",
    (c) => c.mingBranch === "未" && c.inBranch("太陰", "亥") && c.inBranch("太陽", "卯")
      && c.orderOf("太陰") >= 6 && c.orderOf("太陽") >= 6),
  formation("F-RIYUE-JIA", "日月夾命", "吉", "格局", 14, "太陽、太陰",
    "太陽太陰均廟旺夾命宮兩側，命宮有主星：一世財祿無缺，一世榮華",
    (c) => c.majorNames("命宮").length > 0 && c.straddle("太陽", "太陰")
      && c.orderOf("太陽") >= 6 && c.orderOf("太陰") >= 6),
  formation("F-ZIFU-JIA", "紫府夾權", "吉", "格局", 10, "紫微、天府",
    "紫微天府夾命宮兩側：主有權勢",
    (c) => c.straddle("紫微", "天府")),
  formation("F-KUIYUE-JIA", "魁鉞夾貴", "吉", "格局", 8, "天魁、天鉞",
    "天魁天鉞夾命宮兩側：貴人夾命",
    (c) => c.straddle("天魁", "天鉞")),
  formation("F-KEQUANLU", "科權祿三會命", "吉", "格局", 16, "化祿、化權、化科",
    "化祿化權化科同會命宮三方四正：一方之主，若科在官祿、祿在財帛更是天子命",
    (c) => ["祿", "權", "科"].every((m) => c.threeWay.includes(c.mutagenPalace(m)))),
  formation("F-QUANLU", "權祿相逢", "吉", "財富", 8, "化權、化祿／祿存",
    "化權與化祿或祿存同宮於命財官：權祿相逢，一定自己做事業當老闆",
    (c) => {
      const palace = c.mutagenPalace("權");
      return Boolean(palace) && ["命宮", "財帛", "官祿"].includes(palace)
        && (c.mutagenPalace("祿") === palace || c.at("祿存")?.palace === palace);
    }),
  formation("F-LUMA", "祿馬交馳", "吉", "財富", 8, "化祿／祿存、天馬",
    "祿存或化祿與天馬同宮：辛苦賺大錢，巨富",
    (c) => {
      const palace = c.at("天馬")?.palace;
      return Boolean(palace) && (c.mutagenPalace("祿") === palace || c.at("祿存")?.palace === palace);
    }),
  formation("F-FUXIANG", "府相朝垣", "吉", "格局", 6, "天府、天相",
    "天府天相分踞財帛官祿與命宮三足鼎立：天生輔佐之才",
    (c) => (c.inPalace("天府", "財帛") && c.inPalace("天相", "官祿"))
      || (c.inPalace("天府", "官祿") && c.inPalace("天相", "財帛"))),
  formation("F-HUOGUI", "火貴格", "吉", "事業", 10, "火星、貪狼",
    "火星貪狼同宮坐命：火貴格，武貴，作武官",
    (c) => c.samePalace("火星", "貪狼") && c.inPalace("貪狼", "命宮") && c.orderOf("貪狼") >= 3),
  formation("F-LINGGUI", "鈴貴格", "吉", "事業", 8, "鈴星、貪狼",
    "鈴星貪狼同宮坐命：武貴之格",
    (c) => c.samePalace("鈴星", "貪狼") && c.inPalace("貪狼", "命宮") && c.orderOf("貪狼") >= 3),
  formation("F-YINGXING", "英星入廟", "吉", "事業", 10, "破軍",
    "破軍廟坐命子午：英星入廟，男命利武官威震邊疆；女命主孤獨孤僻（評分反轉為 −6）",
    (c) => c.inPalace("破軍", "命宮") && (c.mingBranch === "子" || c.mingBranch === "午") && c.orderOf("破軍") >= 6),
  formation("F-SHUICHENG", "水澄桂萼", "吉", "事業", 8, "太陰",
    "太陰入廟坐命子宮：清官之格，對當官的人利",
    (c) => c.inPalace("太陰", "命宮") && c.mingBranch === "子" && c.orderOf("太陰") >= 6),
  formation("F-JURI", "巨日同宮", "吉", "財富", 10, "巨門、太陽",
    "巨門太陽均廟旺同宮：巨日格，腰纏黃金大富",
    (c) => c.samePalace("巨門", "太陽") && c.orderOf("巨門") >= 6 && c.orderOf("太陽") >= 6),
  formation("F-JURI-HUI", "巨日會命", "吉", "財富", 8, "巨門、太陽",
    "命在寅、太陽廟旺在午、巨門廟旺在戌：巨日會命，先天帶財",
    (c) => c.mingBranch === "寅" && c.inBranch("太陽", "午") && c.inBranch("巨門", "戌")
      && c.orderOf("太陽") >= 6 && c.orderOf("巨門") >= 6),
  formation("F-MINGLU", "命帶祿", "吉", "財富", 6, "化祿／祿存",
    "化祿或祿存坐命：命宮帶祿，一輩子用不完的錢",
    (c) => c.mutagenPalace("祿") === "命宮" || c.inPalace("祿存", "命宮")),
  formation("F-ZIFU-DEFU", "紫微得輔", "吉", "格局", 8, "紫微、左輔／右弼",
    "紫微坐命得左輔右弼同宮或會照：大貴；本地發展比外地好",
    (c) => c.inPalace("紫微", "命宮")
      && (c.inPalace("左輔", "命宮") || c.inPalace("右弼", "命宮")
        || ["財帛", "官祿", "遷移"].some((p) => c.inPalace("左輔", p) || c.inPalace("右弼", p)))),
  formation("F-JIYUE", "機月同梁", "吉", "事業", 4, "天機、天梁、太陰、天同",
    "機月同梁會命宮三方四正：定為吏也，宜公家單位工作",
    (c) => ["天機", "天梁", "太陰", "天同"].every((s) => c.inThreeWay(s))),
  formation("F-ZISHA-GUAN", "紫微七殺官祿", "吉", "事業", 8, "紫微、七殺",
    "紫微七殺同宮於官祿：官權壓重，代表權",
    (c) => c.samePalace("紫微", "七殺") && c.inPalace("紫微", "官祿")),
  formation("F-RIYUE-CAI", "日月夾財", "吉", "財富", 10, "太陽、太陰",
    "太陽太陰均廟旺夾命，即使命宮無主星也一世財運",
    (c) => c.majorNames("命宮").length === 0 && c.straddle("太陽", "太陰")
      && c.orderOf("太陽") >= 6 && c.orderOf("太陰") >= 6),
  formation("F-XIONG-CHU-JI", "凶處藏吉", "吉", "格局", 4, "吉星入廟",
    "三方四正煞星未落陷且吉星入廟坐命：平安",
    (c) => c.threeWaySha.length >= 1 && c.threeWaySha.every((s) => c.orderOf(s) >= 3)
      && c.majorNames("命宮").some((name) => ["紫微", "天府", "太陽", "太陰", "天同", "天梁", "天相"].includes(name) && c.orderOf(name) >= 6)),
  formation("F-LIANSHA-WANG", "廉殺廟旺", "吉", "財富", 8, "廉貞、七殺",
    "廉貞七殺同宮均廟旺：代表積富；殺星廟旺凶處藏吉",
    (c) => c.samePalace("廉貞", "七殺") && c.orderOf("廉貞") >= 6 && c.orderOf("七殺") >= 6),
  formation("F-CHANGQU", "昌曲會命", "吉", "科甲", 6, "文昌、文曲",
    "文昌文曲同會命宮三方四正：讀書奇才，科甲旺",
    (c) => c.inThreeWay("文昌") && c.inThreeWay("文曲")),
  formation("F-KUIYUE-HUI", "魁鉞會命", "吉", "科甲", 5, "天魁、天鉞",
    "天魁天鉞同會命宮三方四正：科甲貴人，讀書考試很棒",
    (c) => c.inThreeWay("天魁") && c.inThreeWay("天鉞")),
  formation("F-FU-BIYU", "紫輔同夫", "吉", "婚姻", 6, "紫微、左輔、右弼",
    "紫微左輔右弼同在夫妻宮：對象很優秀",
    (c) => c.inPalace("紫微", "夫妻") && c.inPalace("左輔", "夫妻") && c.inPalace("右弼", "夫妻")),
  formation("F-FU-TIANMA", "天府天馬同夫", "吉", "婚姻", 6, "天府、天馬",
    "夫妻宮天府天馬同宮最好：吃苦耐勞，持家理財",
    (c) => c.inPalace("天府", "夫妻") && c.inPalace("天馬", "夫妻")),
  formation("F-TONGJU-FU", "天同巨門同夫", "吉", "婚姻", 2, "天同、巨門",
    "天同巨門同在夫妻：雖常拌嘴，但感情好不會生離",
    (c) => c.samePalace("天同", "巨門") && c.inPalace("天同", "夫妻")),
  formation("F-NAN-WUGUAN", "男命武官坐命", "吉", "事業", 6, "七殺／破軍／貪狼／武曲",
    "男命武官星（殺破狼武曲）入廟坐命：武職大利，性格剛強擇善固執",
    (c, gender) => gender === "男" && c.majorNames("命宮").some((name) => ["七殺", "破軍", "貪狼", "武曲"].includes(name) && c.orderOf(name) >= 6)),
  formation("F-SHEN-CAI", "身在財帛", "吉", "財富", 3, "身宮",
    "身宮在財帛：後天在私人企業或自己做老闆",
    (c) => c.bodyPalace === "財帛"),
  formation("F-SHEN-GUAN", "身在官祿", "吉", "事業", 4, "身宮",
    "身宮在官祿：後天從政做官",
    (c) => c.bodyPalace === "官祿"),

  // ── 新評分稿所列的複合條件；組合加分遠高於單星加分 ──
  formation("F-QUANLU-CAI", "權祿同財帛", "吉", "財富", 300, "化權、祿存",
    "化權與祿存同在財帛：權祿相逢，自己做事業或當老闆",
    (c) => c.mutagenPalace("權") === "財帛" && c.inPalace("祿存", "財帛")),
  formation("F-WUTAN-QUANLU-MING", "武貪權祿坐命", "吉", "財富", 999, "武曲、貪狼、化權、化祿",
    "武曲、貪狼、化權、化祿同入命宮：巨富",
    (c) => c.inPalace("武曲", "命宮") && c.inPalace("貪狼", "命宮")
      && c.mutagenPalace("權") === "命宮" && c.mutagenPalace("祿") === "命宮"),
  formation("F-MING-QUANLU", "權祿會命", "吉", "財富", 500, "化權、化祿",
    "命宮三方四正同會化權與化祿：財富與創業能力",
    (c) => c.threeWay.includes(c.mutagenPalace("權")) && c.threeWay.includes(c.mutagenPalace("祿"))),
  formation("F-GUAN-QUANCAI", "官祿權財", "吉", "官運", 250, "化權、大財星",
    "官祿宮同見權星與財星：財經行業主管",
    (c) => c.mutagenPalace("權") === "官祿" && (["祿存", "武曲", "貪狼"].some((s) => c.inPalace(s, "官祿")) || c.mutagenPalace("祿") === "官祿")),
  formation("F-GUAN-KONG", "官祿空宮", "凶", "官運", -300, "官祿宮空宮",
    "官祿宮無主星：不利官運",
    (c) => c.majorNames("官祿").length === 0),
  formation("F-LIUSHA-GUAN", "六煞入官祿", "凶", "事業", -200, "擎羊、陀羅、火星、鈴星、天空、地劫",
    "六煞星任一入官祿宮：事業受阻",
    (c) => c.shaStars.some((s) => c.inPalace(s, "官祿"))),
  formation("F-WUGUAN-KE-MING", "武官化科坐命", "吉", "專業", 500, "武官星、化科",
    "武官星與化科入命：醫師、律師、會計、工程、建築等專業自由業",
    (c) => ["七殺", "破軍", "貪狼", "武曲"].some((s) => c.inPalace(s, "命宮")) && c.mutagenPalace("科") === "命宮"),
  formation("F-KEQUAN-MING", "科權會命", "吉", "專業", 500, "化科、化權",
    "命宮三方四正會化科與化權：專業主管、院長、校長、法官",
    (c) => c.threeWay.includes(c.mutagenPalace("科")) && c.threeWay.includes(c.mutagenPalace("權"))),
  formation("F-KUIYUE-KE-MING", "魁鉞化科會命", "吉", "科甲", 500, "天魁、天鉞、化科",
    "魁鉞與化科同會命宮三方四正：科甲大幅加分",
    (c) => c.inThreeWay("天魁") && c.inThreeWay("天鉞") && c.threeWay.includes(c.mutagenPalace("科"))),
  formation("F-CHANGQU-MING", "昌曲同命", "吉", "科甲", 250, "文昌、文曲",
    "文昌文曲同入命宮：科甲與才藝兼備",
    (c) => c.inPalace("文昌", "命宮") && c.inPalace("文曲", "命宮")),
  formation("F-YIN-CHANGQU-MING", "太陰昌曲同命", "吉", "魅力", 999, "太陰、文昌、文曲",
    "太陰、文昌、文曲同入命宮：才藝過人、桃花命",
    (c) => c.inPalace("太陰", "命宮") && c.inPalace("文昌", "命宮") && c.inPalace("文曲", "命宮")),
  formation("F-HONGXI-MING", "紅喜同命", "吉", "桃花", 300, "紅鸞、天喜",
    "紅鸞天喜同入命宮：桃花與婚緣",
    (c) => c.inPalace("紅鸞", "命宮") && c.inPalace("天喜", "命宮")),
  formation("F-HONGXI-FU", "紅喜同夫妻", "吉", "婚姻", 300, "紅鸞、天喜",
    "紅鸞天喜同會夫妻宮：婚姻加分",
    (c) => c.inPalace("紅鸞", "夫妻") && c.inPalace("天喜", "夫妻")),
  formation("F-QUANLU-FU", "權祿同夫妻", "吉", "婚姻", 300, "化權、化祿",
    "化權化祿同入夫妻宮：配偶能力強",
    (c) => c.mutagenPalace("權") === "夫妻" && c.mutagenPalace("祿") === "夫妻"),
  formation("F-LIANFU-FU", "廉府同夫妻", "吉", "婚姻", 250, "廉貞、天府",
    "廉貞天府同在夫妻宮：溫和、清秀、正派厚道",
    (c) => c.inPalace("廉貞", "夫妻") && c.inPalace("天府", "夫妻")),
  formation("F-LIANPO-CAI", "廉破同財帛", "凶", "經商", -500, "廉貞、破軍",
    "廉貞破軍同在財帛宮：不利自行經商",
    (c) => c.inPalace("廉貞", "財帛") && c.inPalace("破軍", "財帛")),

  // ── 凶格 ──
  formation("F-BANKONG", "半空折翅", "凶", "格局", -18, "化忌沖命",
    "化忌在遷移對沖命宮而命宮三方四正無吉星：半空折翅，大限在中年（三十歲上下）",
    (c) => c.mutagenPalace("忌") === "遷移" && c.threeWayAux.length === 0
      && !["紫微", "天府", "太陽", "太陰", "天同", "天梁", "天相"].some((s) => c.inThreeWay(s) && c.orderOf(s) >= 5)
      && !["祿", "權", "科"].some((m) => c.threeWay.includes(c.mutagenPalace(m)))),
  formation("F-LIANTAN-CHONG", "廉貪陷沖命", "凶", "格局", -16, "廉貞、貪狼",
    "命宮在巳或亥，廉貞貪狼落陷同宮對沖：天羅地網，半空折翅，大限在中年",
    (c) => (c.mingBranch === "巳" || c.mingBranch === "亥") && c.samePalace("廉貞", "貪狼")
      && c.inPalace("廉貞", "遷移") && c.orderOf("廉貞") <= 2 && c.orderOf("貪狼") <= 2),
  formation("F-FANBEI", "日月反背", "凶", "格局", -8, "太陽、太陰",
    "太陽太陰均落陷：工作披星戴月，六親不靠，性情剛燥，夫妻聚少離多",
    (c) => c.orderOf("太陽") <= 2 && c.orderOf("太陰") <= 2),
  formation("F-FANBEI-JIA", "日月反背夾命", "凶", "格局", -12, "太陽、太陰",
    "太陽太陰落陷夾命宮兩側：一世辛勞",
    (c) => c.straddle("太陽", "太陰") && c.orderOf("太陽") <= 2 && c.orderOf("太陰") <= 2),
  formation("F-YANGTUO-JIA", "羊陀夾命", "凶", "格局", -12, "擎羊、陀羅",
    "擎羊陀羅夾命宮兩側：犯小人，容易被人影響",
    (c) => c.straddle("擎羊", "陀羅")),
  formation("F-LIANSHA-XIAN", "廉殺落陷", "凶", "格局", -14, "廉貞、七殺",
    "廉貞七殺同宮落陷：半路埋屍，橫死之格；殺星落陷在劫難逃",
    (c) => c.samePalace("廉貞", "七殺") && c.orderOf("廉貞") <= 2 && c.orderOf("七殺") <= 2),
  formation("F-LIANPO", "廉破同夫妻", "凶", "婚姻", -999, "廉貞、破軍",
    "廉貞破軍同入夫妻宮：婚姻重大不利；重大斷語仍須命運、陽宅與面相同參",
    (c) => c.samePalace("廉貞", "破軍") && c.inPalace("廉貞", "夫妻")),
  formation("F-LIANTAN-MARR", "廉貪同夫妻", "凶", "婚姻", -999, "廉貞、貪狼",
    "廉貞貪狼同入夫妻宮：婚姻重大不利；不得由單一條件直接斷生離死別",
    (c) => c.samePalace("廉貞", "貪狼") && c.inPalace("廉貞", "夫妻")),
  formation("F-LIANTAN-XIAN", "廉貪落陷", "凶", "格局", -14, "廉貞、貪狼",
    "廉貞貪狼同宮落陷：自殺格，主橫夭（先天疾病或自殺）",
    (c) => c.samePalace("廉貞", "貪狼") && c.orderOf("廉貞") <= 2 && c.orderOf("貪狼") <= 2),
  formation("F-WUSHA-XIAN", "武殺落陷", "凶", "格局", -12, "武曲、七殺",
    "武曲七殺同宮落陷：主兵陣死亡",
    (c) => c.samePalace("武曲", "七殺") && c.orderOf("武曲") <= 2 && c.orderOf("七殺") <= 2),
  formation("F-JICHU-XIONG", "吉處藏凶", "凶", "格局", -10, "吉星叢中煞星落陷",
    "命宮三方四正吉星成叢卻有煞星落陷：吉處藏凶，必凶",
    (c) => c.threeWayAux.length >= 2 && c.threeWaySha.some((s) => c.isFallen(s))),
  formation("F-GUXING", "輔弼孤星", "凶", "格局", -6, "左輔／右弼",
    "左輔或右弼單星獨守命宮：主孤獨，輔助之才",
    (c) => !c.inPalace("紫微", "命宮") && (c.inPalace("左輔", "命宮") !== c.inPalace("右弼", "命宮"))),
  formation("F-ZI-LONELY", "紫微無輔", "凶", "格局", -4, "紫微",
    "紫微坐命而無左輔右弼同宮會照：為僧道，或人厚道性情孤獨",
    (c) => c.inPalace("紫微", "命宮")
      && !["命宮", "財帛", "官祿", "遷移"].some((p) => c.inPalace("左輔", p) || c.inPalace("右弼", p))),
  formation("F-SHAPOLANG", "殺破狼會命", "凶", "格局", -4, "七殺、破軍、貪狼",
    "七殺、破軍、貪狼三顆全在命宮三方四正會齊：剛愎自用，易被人利用；女命加重為 −6",
    (c, gender) => ["七殺", "破軍", "貪狼"].every((name) => c.inThreeWay(name))),
  formation("F-SHA-SHEN", "七殺臨身", "凶", "事業", -6, "七殺",
    "七殺臨身宮：終不美，一輩子多敗少成",
    (c) => Boolean(c.bodyPalace) && c.at("七殺")?.palace === c.bodyPalace),
  formation("F-WUZI", "子女無子", "凶", "六親", -10, "子女宮空宮借對宮",
    "子女宮無主星而對宮（田宅）化忌：代表無子",
    (c) => c.majorNames("子女").length === 0 && c.mutagenPalace("忌") === "田宅"),
  formation("F-NV-WUGUAN", "女命武官坐命", "凶", "婚姻", -8, "七殺／破軍／貪狼／武曲",
    "女命武官星坐命：女身男命，個性剛硬獨立，一世孤獨辛勞",
    (c, gender) => gender === "女" && c.majorNames("命宮").some((name) => ["七殺", "破軍", "貪狼", "武曲"].includes(name))),
  formation("F-SHA-XIAN-MING", "命宮殺星落陷", "凶", "格局", -8, "廉貞貪狼擎羊陀羅",
    "廉貞貪狼落陷或擎羊陀羅落陷在命宮：容易犯偷竊罪，個性偏差",
    (c) => c.majorNames("命宮").some((name) => ["廉貞", "貪狼"].includes(name) && c.isFallen(name))
      || ["擎羊", "陀羅"].some((name) => c.inPalace(name, "命宮") && c.isFallen(name))),
  formation("F-FANSHUI", "泛水桃花", "凶", "格局", -4, "貪狼",
    "貪狼居亥子入命：桃花命；貪狼落陷主殺",
    (c) => c.inPalace("貪狼", "命宮") && (c.mingBranch === "亥" || c.mingBranch === "子")),
  formation("F-NV-RILUO", "女命太陽陷", "凶", "婚姻", -6, "太陽",
    "女命太陽落陷在命或夫妻：婚配對象大七歲以上或二婚夫，正常婚姻反而較凶",
    (c, gender) => gender === "女" && ["命宮", "夫妻"].includes(c.at("太陽")?.palace ?? "") && c.orderOf("太陽") <= 2),
  formation("F-NV-WUSHA-FD", "福德武曲七殺", "凶", "婚姻", -8, "武曲、七殺",
    "女命福德宮武曲七殺同宮：代表孤獨",
    (c, gender) => gender === "女" && c.samePalace("武曲", "七殺") && c.inPalace("武曲", "福德")),
  formation("F-SUN-XIAN-FU", "太陽陷父母", "凶", "六親", -5, "太陽",
    "太陽落陷在父母宮：與父親死別，主父凶",
    (c) => c.inPalace("太陽", "父母") && c.orderOf("太陽") <= 2),
  formation("F-YIN-XIAN-FU", "太陰陷父母", "凶", "六親", -4, "太陰",
    "太陰落陷在父母宮：與母親相剋，母親可能早逝",
    (c) => c.inPalace("太陰", "父母") && c.orderOf("太陰") <= 2),
];

// 一個格局可以同時作用於多個維度。這是評分唯一來源；格局旗標本身不暗加分。
export const FORMATION_EFFECTS = {
  "F-ZIFU-YAN": { 幸運: 999, 官運: 999, 財富: 500 },
  "F-SHA-CHAO": { 官運: 999, 事業: 500 },
  "F-RIYUE-BING": { 幸運: 999 },
  "F-YUE-LANG": { 幸運: 500, 外貌: { 女: 999 } },
  "F-RI-ZHAO": { 幸運: { 男: 500 } },
  "F-RI-LI": { 官運: 500 },
  "F-RIYUE-JIA": { 財富: 500, 幸運: 500 },
  "F-FANBEI-JIA": { 幸運: -500 },
  "F-JURI": { 財富: 999, 經商: 999 },
  "F-JURI-HUI": { 財富: 999 },
  "F-LUMA": { 財富: 999, 幸運: 500 },
  "F-MINGLU": { 財富: 300 },
  "F-ZISHA-GUAN": { 官運: 500, 事業: 500 },
  "F-QUANLU-CAI": { 財富: 300 },
  "F-WUTAN-QUANLU-MING": { 財富: 999 },
  "F-MING-QUANLU": { 財富: 500, 經商: 500 },
  "F-GUAN-QUANCAI": { 官運: 250, 財富: 150 },
  "F-GUAN-KONG": { 官運: -300 },
  "F-LIUSHA-GUAN": { 事業: -200 },
  "F-WUGUAN-KE-MING": { 專業: 500 },
  "F-KEQUAN-MING": { 專業: 500, 官運: 300 },
  "F-KUIYUE-HUI": { 科甲: 300, 幸運: 200 },
  "F-KUIYUE-KE-MING": { 科甲: 500 },
  "F-CHANGQU-MING": { 科甲: 250, 才藝: 250 },
  "F-YIN-CHANGQU-MING": { 才藝: 500, 魅力: 999 },
  "F-HONGXI-MING": { 桃花: 300 },
  "F-FANSHUI": { 魅力: 999, 桃花: 500 },
  "F-FU-TIANMA": { 婚姻: 500 },
  "F-HONGXI-FU": { 婚姻: 300 },
  "F-QUANLU-FU": { 婚姻: 300 },
  "F-LIANFU-FU": { 婚姻: 250 },
  "F-LIANPO": { 婚姻: -999 },
  "F-LIANTAN-MARR": { 婚姻: -999 },
  "F-LIANPO-CAI": { 經商: -500 },
};

// 四化一律採新評分稿明列的作用；同一四化可以分別寫入多個維度。
export const TRANSFORM_RULES = [
  { id: "化祿-財帛-財富", mutagen: "祿", palace: "財帛", dimension: "財富", base: 99, description: "化祿入財帛：大財星得位" },
  { id: "化祿-遷移-財富", mutagen: "祿", palace: "遷移", dimension: "財富", base: 150, description: "化祿入遷移：外地經商大利" },
  { id: "化祿-遷移-經商", mutagen: "祿", palace: "遷移", dimension: "經商", base: 150, description: "化祿入遷移：外地經商大利" },
  { id: "化祿-交友-經商", mutagen: "祿", palace: "交友", dimension: "經商", base: 100, description: "化祿入朋友：合夥大利" },
  { id: "化祿-交友-社交", mutagen: "祿", palace: "交友", dimension: "社交", base: 100, description: "化祿入朋友：會做人、社交加分" },
  { id: "化祿-官祿-財富", mutagen: "祿", palace: "官祿", dimension: "財富", base: 100, description: "化祿入官祿：財經主管、手握財權" },
  { id: "化祿-官祿-官運", mutagen: "祿", palace: "官祿", dimension: "官運", base: 100, description: "化祿入官祿：財經主管、手握財權" },
  { id: "化權-官祿-官運", mutagen: "權", palace: "官祿", dimension: "官運", base: 300, description: "化權入官祿：官祿宮最喜權星" },
  { id: "化權-官祿-事業", mutagen: "權", palace: "官祿", dimension: "事業", base: 300, description: "化權入官祿：事業掌權" },
  { id: "化科-命宮-科甲", mutagen: "科", palace: "命宮", dimension: "科甲", base: 300, description: "化科入命：讀書考試、為人師表" },
  { id: "化忌-財帛-經商", mutagen: "忌", palace: "財帛", dimension: "經商", base: -500, description: "化忌入財帛：不會自行經商" },
  { id: "化忌-官祿-事業", mutagen: "忌", palace: "官祿", dimension: "事業", base: -500, description: "化忌入官祿：事業停滯" },
  { id: "化忌-官祿-官運", mutagen: "忌", palace: "官祿", dimension: "官運", base: -500, description: "化忌入官祿：不利官運" },
];

// 四化規則目錄（供 評分規則 表與 metadata 使用）。
export const CONTEXT_RULES = TRANSFORM_RULES.map((item) => ({
  id: item.id,
  dimension: item.dimension,
  type: "四化",
  description: item.description,
}));

function detail(id, dimension, type, star, palace, brightness, factor, base, contribution, description) {
  return {
    id, dimension, type, star, palace, brightness,
    brightnessOrder: brightnessOrder.get(brightness) ?? null,
    factor, base, contribution, description,
  };
}

export function scoreChart(chart, gender = "男") {
  const scores = Object.fromEntries(DIMENSIONS.map((name) => [name, DIMENSION_CONFIG[name].baseScore]));
  const details = [];
  const ctx = buildContext(chart);
  const palaces = ctx.palaces.map((palace) => palace.name);
  const resolvePalaces = (list) => list.map((name) => (name === "交友" ? ctx.friendName : name));

  // 星得正位
  for (const item of STAR_RULES) {
    if (item.genders && !item.genders.includes(gender)) continue;
    const star = ctx.at(item.star);
    if (!star || !resolvePalaces(item.palaces).includes(star.palace)) continue;
    const factor = brightnessFactor(star.name, star.brightness, item.base);
    const contribution = Math.round(item.base * factor * 100) / 100;
    scores[item.dimension] += contribution;
    details.push(detail(item.id, item.dimension, "星曜宮位", star.name, star.palace, star.brightness, factor, item.base, contribution, item.description));
  }

  // 四化：轉化本身就是脈絡，亮度作溫和調節（0.5 + bf × 0.5）。
  const addContext = (id, dimension, type, star, palace, brightness, factor, base, contribution, description) => {
    scores[dimension] += contribution;
    details.push(detail(id, dimension, type, star, palace, brightness, factor, base, contribution, description));
  };
  for (const item of TRANSFORM_RULES) {
    const palace = item.palace === "交友" ? ctx.friendName : item.palace;
    const transformed = ctx.siHua.get(item.mutagen);
    if (!transformed || transformed.palace !== palace) continue;
    const factor = 0.5 + brightnessFactor(transformed.name, transformed.brightness, item.base) * 0.5;
    const contribution = Math.round(item.base * factor * 100) / 100;
    addContext(item.id, item.dimension, "四化", transformed.name, transformed.palace, transformed.brightness, factor, item.base, contribution, item.description);
  }

  // 具名格局：實際落宮成立才算，絕不使用借對宮語義。
  const formations = [];
  for (const item of FORMATION_RULES) {
    let formed = false;
    try {
      formed = Boolean(item.check(ctx, gender));
    } catch {
      formed = false;
    }
    if (!formed) continue;
    const involved = item.stars.split("、").map((name) => ctx.at(name)).filter(Boolean);
    const brightness = involved.map((star) => star.brightness || "").join("/") ?? "";
    const palace = involved[0]?.palace ?? "";
    const effects = FORMATION_EFFECTS[item.id] ?? {};
    formations.push({
      id: item.id, name: item.name, polarity: item.polarity,
      stars: item.stars, palace, brightness, effects, description: item.description,
    });
    for (const [dimension, configured] of Object.entries(effects)) {
      const base = typeof configured === "number" ? configured : configured?.[gender];
      if (!Number.isFinite(base) || !DIMENSIONS.includes(dimension)) continue;
      const contribution = Math.round(base * 100) / 100;
      scores[dimension] += contribution;
      details.push(detail(`${item.id}-${dimension}`, dimension, "格局", item.stars, palace, brightness, 1, base, contribution, item.description));
    }
  }

  for (const dimension of DIMENSIONS) scores[dimension] = Math.round(scores[dimension] * 100) / 100;
  scores.綜合 = Math.round(DIMENSIONS.reduce((sum, dimension) => sum + scores[dimension] * DIMENSION_CONFIG[dimension].overallWeight, 0) * 100) / 100;
  return { scores, details, formations, formationFlags: Object.fromEntries(FORMATION_RULES.map((item) => [item.name, formations.some((f) => f.id === item.id) ? 1 : 0])) };
}
