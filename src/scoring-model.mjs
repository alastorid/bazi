// 倪海廈《天紀》紫微斗數評分模型。
// 什麼是好、什麼是壞，完全依《天紀》紫微斗數課程（星辰篇、十二宮實批）的明確標準：
//   1. 先看四化（科權祿忌）所在宮；化忌所在宮或對沖的宮，十年事倍功半。
//   2. 命宮三方四正（命、財帛、官祿、遷移）論總格；成格者貴，破格者凶。
//   3. 星得正位：官星入官祿最好，財星入財帛最好。
//   4. 亮度：廟旺為吉，得稍弱於旺，利為小吉，平閒主無用，陷主凶；殺星落陷大凶。
//   5. 吉處藏凶必凶；凶處藏吉平安。
//   6. 夫妻宮必須與福德宮一起看；疾厄宮只做參考。
// 本檔案是唯一版本控制來源；資料庫的 評分規則／命盤評分明細／命盤格局 都由此生成。

export const DIMENSIONS = ["格局", "財富", "事業", "婚姻", "六親", "科甲", "健康"];

export const DIMENSION_CONFIG = {
  格局: { baseScore: 50, overallWeight: 0.22 },
  財富: { baseScore: 50, overallWeight: 0.20 },
  事業: { baseScore: 50, overallWeight: 0.20 },
  婚姻: { baseScore: 50, overallWeight: 0.16 },
  六親: { baseScore: 50, overallWeight: 0.08 },
  科甲: { baseScore: 50, overallWeight: 0.08 },
  健康: { baseScore: 50, overallWeight: 0.06 },
};

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

// 星性質依倪師定義：紫微系善星與六吉為 benefic；武曲（財星王兼武官）、
// 廉貞、貪狼、巨門（凶星但廟旺口才好、巨富）為 mixed；殺破狼與六殺（擎羊、
// 陀羅、火星、鈴星、天空、地劫）及天刑（是非官司刑剋）為 challenging。
export const STAR_NATURE = {
  紫微: "benefic", 天機: "benefic", 太陽: "benefic", 天同: "benefic", 天府: "benefic",
  太陰: "benefic", 天相: "benefic", 天梁: "benefic", 左輔: "benefic", 右弼: "benefic",
  文昌: "benefic", 文曲: "benefic", 天魁: "benefic", 天鉞: "benefic", 祿存: "benefic",
  武曲: "mixed", 廉貞: "mixed", 貪狼: "mixed", 巨門: "mixed",
  天馬: "mixed", 紅鸞: "mixed", 天喜: "mixed", 天姚: "mixed", 咸池: "mixed",
  七殺: "challenging", 破軍: "challenging",
  擎羊: "challenging", 陀羅: "challenging", 火星: "challenging", 鈴星: "challenging",
  地空: "challenging", 地劫: "challenging", 天刑: "challenging",
};

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

const rule = (id, dimension, star, palaces, base, description) => ({ id, dimension, star, palaces, base, description });

// ─── 星得正位（倪師：官星入官祿最好、財星入財帛最好；化權入官祿最好）───
export const STAR_RULES = [
  // 財富：財星正位於財帛田宅；破星、空劫、煞性破財。
  rule("W-WU", "財富", "武曲", ["財帛"], 10, "武曲財星王正位入財帛"),
  rule("W-WU-TIAN", "財富", "武曲", ["田宅"], 8, "武曲入田宅為財庫"),
  rule("W-WU-GUAN", "財富", "武曲", ["官祿"], 5, "武曲入官祿掌財權（權星財星同宮另算）"),
  rule("W-FU", "財富", "天府", ["財帛", "田宅"], 9, "天府財庫正位，善守成"),
  rule("W-YIN", "財富", "太陰", ["財帛"], 8, "太陰正財入財帛，積蓄之財"),
  rule("W-YIN-TIAN", "財富", "太陰", ["田宅"], 7, "太陰入田宅，置產累積"),
  rule("W-TAN", "財富", "貪狼", ["財帛"], 5, "貪狼機會財入財帛（落陷則無力）"),
  rule("W-LU", "財富", "祿存", ["財帛"], 8, "祿存入財帛善於理財（慳吝）"),
  rule("W-LU-MING", "財富", "祿存", ["命宮"], 6, "命宮帶祿存，一生財祿不缺"),
  rule("W-ZI", "財富", "紫微", ["財帛"], 4, "紫微在財帛，私企做主管或自己做事"),
  rule("W-SUN", "財富", "太陽", ["財帛"], 3, "太陽在財帛主橫財（非固定收入）"),
  rule("W-PO", "財富", "破軍", ["財帛"], -4, "破星入財帛主破財"),
  rule("W-JU", "財富", "巨門", ["財帛"], -3, "巨門（殺星）在財帛不可能做生意，廟旺稍緩"),
  rule("W-KONG", "財富", "地空", ["財帛", "田宅"], -8, "地空入財田，落空波動"),
  rule("W-JIE", "財富", "地劫", ["財帛", "田宅"], -8, "地劫入財田，耗損"),
  rule("W-HUO", "財富", "火星", ["財帛"], -3, "火星入財帛為煞性波動；不因與貪狼同宮自動改判財格"),
  rule("W-LING", "財富", "鈴星", ["財帛"], -3, "鈴星入財帛為煞性波動；不因與貪狼同宮自動改判財格"),
  rule("W-FUZUO", "財富", "左輔", ["交友"], 3, "吉星入朋友宮，合夥大吉"),
  rule("W-YOUB", "財富", "右弼", ["交友"], 3, "吉星入朋友宮，合夥大吉"),
  rule("W-KUI", "財富", "天魁", ["交友"], 3, "貴星入朋友宮，合夥大吉"),
  rule("W-YUE", "財富", "天鉞", ["交友"], 3, "貴星入朋友宮，合夥大吉"),
  rule("W-PO-YOU", "財富", "破軍", ["交友"], -4, "破星入朋友宮，合夥必敗"),
  rule("W-MA-YOU", "財富", "天馬", ["交友"], -3, "天馬在朋友宮，為朋友奔波勞多功少"),

  // 事業：官祿宮最喜化權；官星正位；六殺入官祿做官辛苦。
  rule("C-ZI", "事業", "紫微", ["官祿"], 9, "帝星正位入官祿，官帶越大官越大"),
  rule("C-ZI-MING", "事業", "紫微", ["命宮"], 6, "帝星坐命統御領導"),
  rule("C-FU", "事業", "天府", ["官祿"], 7, "天府官星入官祿"),
  rule("C-SUN", "事業", "太陽", ["官祿"], 6, "太陽官祿主入官祿，武官帶"),
  rule("C-SUN-MING", "事業", "太陽", ["命宮"], 4, "太陽坐命武官帶"),
  rule("C-WU-MING", "事業", "武曲", ["命宮"], 5, "武曲坐命執行剛決"),
  rule("C-XIANG", "事業", "天相", ["官祿"], 5, "天相佐才入官祿"),
  rule("C-JI", "事業", "天機", ["官祿"], 3, "天機文官帶入官祿"),
  rule("C-LIANG", "事業", "天梁", ["官祿"], 3, "天梁文武雙全官帶"),
  rule("C-TONG", "事業", "天同", ["官祿"], 2, "天同人和入官祿"),
  rule("C-LIAN", "事業", "廉貞", ["官祿"], 2, "廉貞武官帶入官祿，主清廉"),
  rule("C-SHA", "事業", "七殺", ["官祿"], -3, "只有七殺獨守官祿當官不好（會紫微成權另算）"),
  rule("C-PO", "事業", "破軍", ["官祿"], -3, "破軍入官祿勞耗"),
  rule("C-JU", "事業", "巨門", ["官祿"], -2, "巨門入官祿是非口舌，廟旺稍緩"),
  rule("C-YANG", "事業", "擎羊", ["官祿"], -4, "六殺入官祿做官辛苦"),
  rule("C-TUO", "事業", "陀羅", ["官祿"], -4, "六殺入官祿做官辛苦"),
  rule("C-HUO", "事業", "火星", ["官祿"], -3, "六殺入官祿做官辛苦"),
  rule("C-LING", "事業", "鈴星", ["官祿"], -3, "六殺入官祿做官辛苦"),
  rule("C-KONG", "事業", "地空", ["官祿"], -5, "空劫入官祿反覆"),
  rule("C-JIE", "事業", "地劫", ["官祿"], -5, "空劫入官祿耗損"),

  // 婚姻：夫妻宮與福德宮一起看；紫府天同配偶好；巨門口角；破軍刑剋。
  rule("M-ZI", "婚姻", "紫微", ["夫妻"], 8, "紫微在夫妻配偶優秀"),
  rule("M-FU", "婚姻", "天府", ["夫妻"], 7, "天府在夫妻配偶溫和厚道"),
  rule("M-XIANG", "婚姻", "天相", ["夫妻"], 5, "天相在夫妻配偶端正"),
  rule("M-TONG", "婚姻", "天同", ["夫妻"], 6, "天同在夫妻感情好"),
  rule("M-LIANG", "婚姻", "天梁", ["夫妻"], 4, "天梁在夫妻配偶穩重"),
  rule("M-YIN", "婚姻", "太陰", ["夫妻"], 5, "太陰在夫妻的柔和持家作用；男命妻象尤直接"),
  rule("M-SUN", "婚姻", "太陽", ["夫妻"], 4, "太陽在夫妻的光明扶助作用；女命夫象尤直接"),
  rule("M-JU", "婚姻", "巨門", ["夫妻"], -4, "巨門在夫妻有口角（天同同宮不離另算）"),
  rule("M-PO", "婚姻", "破軍", ["夫妻"], -6, "破軍在夫妻婚姻不美"),
  rule("M-YANG", "婚姻", "擎羊", ["夫妻"], -5, "擎羊在夫妻刑剋爭執"),
  rule("M-TUO", "婚姻", "陀羅", ["夫妻"], -5, "陀羅在夫妻拖磨糾纏"),
  rule("M-HUO", "婚姻", "火星", ["夫妻"], -4, "火星在夫妻衝突"),
  rule("M-LING", "婚姻", "鈴星", ["夫妻"], -4, "鈴星在夫妻暗耗"),
  rule("M-KONG", "婚姻", "地空", ["夫妻"], -4, "地空在夫妻情緣落空"),
  rule("M-JIE", "婚姻", "地劫", ["夫妻"], -4, "地劫在夫妻情緣耗損"),
  rule("M-HONG", "婚姻", "紅鸞", ["命宮"], 4, "紅鸞坐命男招美妻、女有貴夫"),
  rule("M-TIANXI", "婚姻", "天喜", ["命宮"], 3, "天喜坐命婚姻有喜"),
  rule("M-TONG-FD", "婚姻", "天同", ["福德"], 4, "天同在福德一生福順"),
  rule("M-LIANG-FD", "婚姻", "天梁", ["福德"], 4, "天梁在福德有庇蔭"),

  // 六親：父母兄弟子女；化忌所在六親宮主剋；吉星主助力。
  rule("K-SUN-FU", "六親", "太陽", ["父母"], 3, "太陽旺在父母旺父親"),
  rule("K-YIN-FU", "六親", "太陰", ["父母"], 3, "太陰旺在父母旺母親"),
  rule("K-TONG", "六親", "天同", ["父母"], 3, "天同在父母與父母感情好"),
  rule("K-WU-FU", "六親", "武曲", ["父母"], 2, "武曲在父母父母出武貴"),
  rule("K-WU-X", "六親", "武曲", ["兄弟"], 2, "武曲在兄弟兄弟貴"),
  rule("K-ZI-X", "六親", "紫微", ["兄弟"], 3, "紫微在兄弟兄弟得力"),
  rule("K-FU-X", "六親", "天府", ["兄弟"], 3, "天府在兄弟兄弟得力"),
  rule("K-XIANG-X", "六親", "天相", ["兄弟"], 3, "天相在兄弟兄弟相助"),
  rule("K-LIANG-X", "六親", "天梁", ["兄弟"], 2, "天梁在兄弟兄弟有蔭"),
  rule("K-FUZUO-X", "六親", "左輔", ["兄弟"], 2, "輔弼在兄弟助力"),
  rule("K-YOUB-X", "六親", "右弼", ["兄弟"], 2, "輔弼在兄弟助力"),
  rule("K-KUI", "六親", "天魁", ["父母", "兄弟"], 2, "魁鉞在六親宮得長輩貴人"),
  rule("K-YUE", "六親", "天鉞", ["父母", "兄弟"], 2, "魁鉞在六親宮得長輩貴人"),
  rule("K-LIANG-SUN", "六親", "天梁", ["子女"], 3, "天梁（陽星）在子女兒子有成"),
  rule("K-JU-FU", "六親", "巨門", ["父母"], -2, "巨門在父母口舌是非"),
  rule("K-YANG", "六親", "擎羊", ["父母", "兄弟", "子女"], -3, "煞星入六親宮主剋，犯小人"),
  rule("K-TUO", "六親", "陀羅", ["父母", "兄弟", "子女"], -3, "煞星入六親宮主剋"),
  rule("K-HUO", "六親", "火星", ["父母", "兄弟", "子女"], -3, "煞星入六親宮主剋"),
  rule("K-LING", "六親", "鈴星", ["父母", "兄弟", "子女"], -3, "煞星入六親宮主剋"),
  rule("K-KONG", "六親", "地空", ["父母", "兄弟", "子女"], -3, "空劫入六親宮六親無靠"),
  rule("K-JIE", "六親", "地劫", ["父母", "兄弟", "子女"], -3, "空劫入六親宮六親無靠"),

  // 科甲：昌曲魁鉞主科甲；命會昌曲魁鉞，讀書奇才。
  rule("E-CHANG", "科甲", "文昌", ["命宮"], 7, "文昌坐命主科甲讀書考試"),
  rule("E-QU", "科甲", "文曲", ["命宮"], 5, "文曲坐命主才藝博學"),
  rule("E-KUI", "科甲", "天魁", ["命宮"], 6, "天魁科甲星坐命"),
  rule("E-YUE", "科甲", "天鉞", ["命宮"], 6, "天鉞科甲星坐命"),
  rule("E-CHANG-GUAN", "科甲", "文昌", ["官祿"], 3, "文昌入官祿利考試任職"),

  // 健康：疾厄宮只做參考；煞星在哪個宮，就知道那方面的疾病。
  rule("H-TONG", "健康", "天同", ["疾厄", "福德"], 3, "天同福星平和少病"),
  rule("H-LIANG", "健康", "天梁", ["疾厄"], 4, "天梁蔭星入疾厄有解厄之意"),
  rule("H-XIANG", "健康", "天相", ["疾厄"], 3, "天相入疾厄平和"),
  rule("H-YIN", "健康", "太陰", ["疾厄"], 2, "太陰入疾厄陰分調養"),
  rule("H-YANG", "健康", "擎羊", ["疾厄", "命宮"], -6, "擎羊主開刀見血光"),
  rule("H-TUO", "健康", "陀羅", ["疾厄", "命宮"], -6, "陀羅主暗疾拖延"),
  rule("H-HUO", "健康", "火星", ["疾厄", "命宮"], -5, "火星主急性之疾"),
  rule("H-LING", "健康", "鈴星", ["疾厄", "命宮"], -5, "鈴星主隱性之疾"),
  rule("H-KONG", "健康", "地空", ["疾厄"], -4, "地空入疾厄耗散"),
  rule("H-JIE", "健康", "地劫", ["疾厄"], -4, "地劫入疾厄耗損"),
  rule("H-SHA", "健康", "七殺", ["疾厄"], -4, "七殺獨坐疾厄，對應部位注意"),
  rule("H-PO", "健康", "破軍", ["疾厄"], -3, "破軍入疾厄耗損"),
  rule("H-LIAN", "健康", "廉貞", ["疾厄"], -3, "廉貞入疾厄血光之象"),

  // 格局：命宮吉星基礎。
  rule("G-FUZUO", "格局", "左輔", ["命宮"], 4, "輔星坐命助力"),
  rule("G-YOUB", "格局", "右弼", ["命宮"], 4, "弼星坐命助力"),
  rule("G-FU", "格局", "天府", ["命宮"], 4, "天府坐命溫和統籌"),
  rule("G-XIANG", "格局", "天相", ["命宮"], 3, "天相坐命厚道"),
  rule("G-LIANG", "格局", "天梁", ["命宮"], 3, "天梁坐命有蔭"),
  rule("G-TONG", "格局", "天同", ["命宮"], 3, "天同坐命人和福厚"),
  rule("G-YIN", "格局", "太陰", ["命宮"], 3, "太陰坐命（女命尤美）"),
  rule("G-JU", "格局", "巨門", ["命宮"], -2, "巨門坐命口舌是非，廟旺口才好稍緩"),
];

// ─── 具名格局（倪師《天紀》明確定義的成格／破格條件）───
// check(ctx, gender) 回傳 true 表示成格；旗標寫入 命盤格局 表（結構成立即為 1，
// 含性別條件的格局只在符合性別的列上為 1），評分貢獻另計入命盤評分明細。
const formation = (id, name, polarity, dimension, base, stars, description, check) =>
  ({ id, name, polarity, dimension, base, stars, description, check });

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
  const shaStars = ["擎羊", "陀羅", "火星", "鈴星", "地空", "地劫"];
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
    "命宮在寅或申，紫微天府同入廟坐命：位列三台，將相之格，爵祿榮昌",
    (c) => (c.mingBranch === "寅" || c.mingBranch === "申") && c.samePalace("紫微", "天府")
      && c.inPalace("紫微", "命宮") && c.orderOf("紫微") >= 6 && c.orderOf("天府") >= 6),
  formation("F-SHA-CHAO", "七殺朝斗", "吉", "格局", 12, "七殺",
    "七殺獨坐入廟於寅申命宮：將星入命，威震邊疆，爵祿榮昌",
    (c) => c.inPalace("七殺", "命宮") && (c.mingBranch === "寅" || c.mingBranch === "申")
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
    "巨門太陽均廟旺同宮坐命：腰纏黃金大富；女命主偏房（評分反轉為 −6）",
    (c) => c.samePalace("巨門", "太陽") && c.inPalace("巨門", "命宮")
      && c.orderOf("巨門") >= 6 && c.orderOf("太陽") >= 6),
  formation("F-JURI-HUI", "巨日會命", "吉", "財富", 8, "巨門、太陽",
    "巨門太陽均廟旺會入命宮三方：先天命中帶財，從商大利；女命主偏房（評分反轉為 −4）",
    (c) => c.inThreeWay("巨門") && c.inThreeWay("太陽") && c.at("巨門")?.palace !== c.at("太陽")?.palace
      && c.orderOf("巨門") >= 6 && c.orderOf("太陽") >= 6),
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
  formation("F-LIANPO", "廉破入夫妻福德", "凶", "婚姻", -12, "廉貞、破軍",
    "廉貞破軍同入夫妻或福德，為婚姻重大不利訊號；倪師案例明言仍須命運、陽宅與面相同參",
    (c) => c.samePalace("廉貞", "破軍") && ["夫妻", "福德"].includes(c.at("廉貞")?.palace)),
  formation("F-LIANTAN-MARR", "廉貪入夫妻福德", "凶", "婚姻", -12, "廉貞、貪狼",
    "廉貞貪狼同入夫妻或福德，為婚姻重大不利訊號；不得由單一條件直接斷生離死別",
    (c) => c.samePalace("廉貞", "貪狼") && ["夫妻", "福德"].includes(c.at("廉貞")?.palace)),
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

// 性別會改變基礎作用的格局：主值為男命／一般值，說明中註明反轉值。
const GENDER_FORMATION_BASE = {
  "F-YUE-LANG": { 男: 10, 女: 14 },
  "F-RI-ZHAO": { 男: 14, 女: 10 },
  "F-YINGXING": { 男: 10, 女: -6 },
  "F-JURI": { 男: 10, 女: -6 },
  "F-JURI-HUI": { 男: 8, 女: -4 },
  "F-SHAPOLANG": { 男: -4, 女: -6 },
};

// ─── 四化（倪師：科權祿忌四化為主，無需計算飛星）───
export const TRANSFORM_RULES = [
  { mutagen: "祿", palace: "命宮", dimension: "財富", base: 8, description: "化祿入命：命帶祿，財祿不缺" },
  { mutagen: "祿", palace: "財帛", dimension: "財富", base: 10, description: "化祿入財帛：自己會做生意" },
  { mutagen: "祿", palace: "官祿", dimension: "財富", base: 4, description: "化祿入官祿：貪官或手握財權" },
  { mutagen: "祿", palace: "田宅", dimension: "財富", base: 8, description: "化祿入田宅：不動產財庫" },
  { mutagen: "祿", palace: "父母", dimension: "六親", base: 8, description: "化祿入父母：有祖產財祿，父母從商" },
  { mutagen: "祿", palace: "子女", dimension: "六親", base: 6, description: "化祿入子女：兒子優秀適合做生意" },
  { mutagen: "祿", palace: "交友", dimension: "財富", base: 5, description: "化祿入朋友：合夥大利，自己很會做人" },
  { mutagen: "祿", palace: "遷移", dimension: "財富", base: 5, description: "化祿入遷移：外地經商大利" },
  { mutagen: "權", palace: "官祿", dimension: "事業", base: 12, description: "化權入官祿：官祿宮最喜權星入宮" },
  { mutagen: "權", palace: "命宮", dimension: "事業", base: 8, description: "化權入命：先天領導之才，主見很強" },
  { mutagen: "權", palace: "財帛", dimension: "財富", base: 8, description: "化權入財帛：自己做生意當老闆" },
  { mutagen: "權", palace: "夫妻", dimension: "婚姻", base: 2, description: "化權入夫妻：配偶性剛有主見" },
  { mutagen: "權", palace: "子女", dimension: "六親", base: 4, description: "化權入子女：兒子有武官權" },
  { mutagen: "權", palace: "父母", dimension: "六親", base: 3, description: "化權入父母：父母做官" },
  { mutagen: "科", palace: "命宮", dimension: "科甲", base: 6, description: "化科入命：讀書考試都好，為人師表" },
  { mutagen: "科", palace: "官祿", dimension: "事業", base: 5, description: "化科入官祿：適合考公家單位" },
  { mutagen: "科", palace: "財帛", dimension: "財富", base: 4, description: "化科入財帛：必有技術專長" },
  { mutagen: "科", palace: "父母", dimension: "六親", base: 3, description: "化科入父母：父母有文名" },
  { mutagen: "科", palace: "遷移", dimension: "科甲", base: 4, description: "化科入遷移：去外地讀書拿學位" },
  { mutagen: "忌", palace: "命宮", dimension: "格局", base: -10, description: "化忌入命：早年不順，容易想不開" },
  { mutagen: "忌", palace: "兄弟", dimension: "六親", base: -8, description: "化忌入兄弟：兄弟不和或夭折，合夥破財" },
  { mutagen: "忌", palace: "夫妻", dimension: "婚姻", base: -12, description: "化忌入夫妻：主生離" },
  { mutagen: "忌", palace: "子女", dimension: "六親", base: -8, description: "化忌入子女：與子女緣分或相處不利；無子另須空宮與對宮化忌等複合條件" },
  { mutagen: "忌", palace: "財帛", dimension: "財富", base: -12, description: "化忌入財帛：不會做生意，諸事不順" },
  { mutagen: "忌", palace: "疾厄", dimension: "健康", base: -8, description: "化忌入疾厄：對應部位注意健康" },
  { mutagen: "忌", palace: "遷移", dimension: "格局", base: -6, description: "化忌在遷移沖命：本命沖大凶；無吉星則成半空折翅" },
  { mutagen: "忌", palace: "交友", dimension: "財富", base: -8, description: "化忌入朋友：合夥必敗，朋友變仇人" },
  { mutagen: "忌", palace: "官祿", dimension: "事業", base: -12, description: "化忌入官祿：不利當官，流年逢之事業停擺" },
  { mutagen: "忌", palace: "田宅", dimension: "六親", base: -8, description: "化忌入田宅：破祖業，耗掉父母財產" },
  { mutagen: "忌", palace: "福德", dimension: "婚姻", base: -10, description: "化忌入福德：福德與婚姻不利；重大斷語仍須命運、陽宅與面相同參" },
  { mutagen: "忌", palace: "父母", dimension: "六親", base: -10, description: "化忌入父母：與父母緣分較弱或父母不在身邊；父母雙亡須再見日月反背等複合條件" },
];

// 四化規則目錄（供 評分規則 表與 metadata 使用）。
export const CONTEXT_RULES = TRANSFORM_RULES.map((item) => ({
  id: `H-${item.mutagen}-${item.palace}`,
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
    addContext(`H-${item.mutagen}-${item.palace}`, item.dimension, "四化", transformed.name, transformed.palace, transformed.brightness, factor, item.base, contribution, item.description);
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
    const base = GENDER_FORMATION_BASE[item.id]?.[gender] ?? item.base;
    const involved = item.stars.split("、").map((name) => ctx.at(name)).filter(Boolean);
    const brightness = involved.map((star) => star.brightness || "").join("/") ?? "";
    const palace = involved[0]?.palace ?? "";
    const contribution = Math.round(base * 100) / 100;
    scores[item.dimension] += contribution;
    formations.push({
      id: item.id, name: item.name, polarity: item.polarity, dimension: item.dimension,
      stars: item.stars, palace, brightness, base, contribution, description: item.description,
    });
    details.push(detail(item.id, item.dimension, "格局", item.stars, palace, brightness, 1, base, contribution, item.description));
  }

  for (const dimension of DIMENSIONS) scores[dimension] = Math.round(Math.max(0, Math.min(100, scores[dimension])) * 100) / 100;
  scores.綜合 = Math.round(DIMENSIONS.reduce((sum, dimension) => sum + scores[dimension] * DIMENSION_CONFIG[dimension].overallWeight, 0) * 100) / 100;
  return { scores, details, formations, formationFlags: Object.fromEntries(FORMATION_RULES.map((item) => [item.name, formations.some((f) => f.id === item.id) ? 1 : 0])) };
}
