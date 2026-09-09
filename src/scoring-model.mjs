export const DIMENSIONS = ["財富", "幸運", "外貌", "健康", "事業", "社交", "家庭助力"];

export const DIMENSION_CONFIG = {
  財富: { baseScore: 50, overallWeight: 0.21 },
  幸運: { baseScore: 50, overallWeight: 0.14 },
  外貌: { baseScore: 50, overallWeight: 0.10 },
  健康: { baseScore: 50, overallWeight: 0.14 },
  事業: { baseScore: 50, overallWeight: 0.18 },
  社交: { baseScore: 50, overallWeight: 0.10 },
  家庭助力: { baseScore: 50, overallWeight: 0.13 },
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

export const STAR_NATURE = {
  紫微:"benefic", 天機:"benefic", 太陽:"benefic", 天同:"benefic", 天府:"benefic",
  太陰:"benefic", 天相:"benefic", 天梁:"benefic", 左輔:"benefic", 右弼:"benefic",
  文昌:"benefic", 文曲:"benefic", 天魁:"benefic", 天鉞:"benefic", 祿存:"benefic",
  武曲:"mixed", 廉貞:"mixed", 貪狼:"mixed", 巨門:"mixed",
  七殺:"challenging", 破軍:"challenging", 火星:"challenging", 鈴星:"challenging",
  擎羊:"challenging", 陀羅:"challenging", 地空:"challenging", 地劫:"challenging",
};

const RESPONSE = {
  benefic: {
    positive: { 陷:0.55, 不:0.68, 平:0.84, 利:0.98, 得:1.08, 旺:1.18, 廟:1.28 },
    negative: { 陷:1.25, 不:1.15, 平:1.04, 利:0.98, 得:0.90, 旺:0.82, 廟:0.76 },
  },
  mixed: {
    positive: { 陷:0.64, 不:0.72, 平:0.86, 利:0.98, 得:1.07, 旺:1.16, 廟:1.22 },
    negative: { 陷:1.20, 不:1.14, 平:1.05, 利:1.00, 得:0.96, 旺:0.92, 廟:0.90 },
  },
  challenging: {
    positive: { 陷:0.62, 不:0.68, 平:0.78, 利:0.88, 得:0.96, 旺:1.02, 廟:1.06 },
    negative: { 陷:1.28, 不:1.20, 平:1.08, 利:1.00, 得:0.95, 旺:0.92, 廟:0.90 },
  },
};

const rule = (id, dimension, star, palaces, base, description) => ({ id, dimension, star, palaces, base, description });

// Base effects encode the star's meaning in a specific palace. Brightness only
// modulates this signed effect; it never changes a sha star into a benefic star.
export const STAR_RULES = [
  rule("W-WU", "財富", "武曲", ["財帛","官祿","田宅","命宮"], 8, "武曲在財官田命的財務與執行作用"),
  rule("W-FU", "財富", "天府", ["財帛","田宅","官祿","命宮"], 8, "天府在財官田命的財庫與管理作用"),
  rule("W-YIN", "財富", "太陰", ["財帛","田宅","命宮"], 7, "太陰在財田命的累積與資產作用"),
  rule("W-TAN", "財富", "貪狼", ["財帛","官祿","遷移"], 6, "貪狼在財官遷的機會財作用"),
  rule("W-ZI", "財富", "紫微", ["命宮","官祿","財帛"], 5, "紫微的資源統籌作用"),
  rule("W-LU", "財富", "祿存", ["命宮","財帛","官祿","田宅"], 7, "祿存在核心財富宮"),
  rule("W-KONG", "財富", "地空", ["財帛","田宅"], -7, "財田地空的落空與波動"),
  rule("W-JIE", "財富", "地劫", ["財帛","田宅"], -7, "財田地劫的耗損與波動"),
  rule("W-HUO", "財富", "火星", ["財帛","官祿"], -3, "火星單獨在財官增加波動；火貪另算組合"),
  rule("W-LING", "財富", "鈴星", ["財帛","官祿"], -3, "鈴星單獨在財官增加波動；鈴貪另算組合"),

  rule("L-TONG", "幸運", "天同", ["命宮","福德","遷移"], 7, "天同在命福遷的順遂作用"),
  rule("L-LIANG", "幸運", "天梁", ["命宮","福德","父母","遷移"], 7, "天梁的庇蔭與解厄作用"),
  rule("L-FU", "幸運", "天府", ["命宮","福德","父母"], 6, "天府的穩定資源作用"),
  rule("L-KUI", "幸運", "天魁", ["命宮","福德","遷移","父母"], 6, "天魁貴人助力"),
  rule("L-YUE", "幸運", "天鉞", ["命宮","福德","遷移","父母"], 6, "天鉞貴人助力"),
  rule("L-KONG", "幸運", "地空", ["命宮","福德","遷移"], -5, "空曜削弱順遂"),
  rule("L-JIE", "幸運", "地劫", ["命宮","福德","遷移"], -5, "劫曜削弱順遂"),

  rule("A-YIN", "外貌", "太陰", ["命宮"], 11, "太陰在命宮的柔美與細緻"),
  rule("A-TONG", "外貌", "天同", ["命宮"], 9, "天同在命宮的親和與柔和"),
  rule("A-XIANG", "外貌", "天相", ["命宮"], 8, "天相在命宮的端正與儀態"),
  rule("A-ZI", "外貌", "紫微", ["命宮"], 7, "紫微在命宮的貴氣與存在感"),
  rule("A-TAN", "外貌", "貪狼", ["命宮"], 8, "貪狼在命宮的魅力與表現力"),
  rule("A-LIAN", "外貌", "廉貞", ["命宮"], 6, "廉貞在命宮的鮮明氣質"),
  rule("A-CHANG", "外貌", "文昌", ["命宮"], 5, "文昌在命宮的文氣"),
  rule("A-QU", "外貌", "文曲", ["命宮"], 5, "文曲在命宮的氣質"),
  rule("A-SHA", "外貌", "擎羊", ["命宮"], -5, "擎羊在命宮增加稜角與不穩定"),
  rule("A-TUO", "外貌", "陀羅", ["命宮"], -4, "陀羅在命宮增加阻滯"),

  rule("H-TONG", "健康", "天同", ["命宮","福德","疾厄"], 7, "天同在命福疾的傳統安適傾向"),
  rule("H-LIANG", "健康", "天梁", ["命宮","福德","疾厄"], 8, "天梁在命福疾的傳統庇護傾向"),
  rule("H-FU", "健康", "天府", ["命宮","福德","疾厄"], 6, "天府的穩定與恢復傾向"),
  rule("H-YIN", "健康", "太陰", ["命宮","福德","疾厄"], 5, "太陰的調養與內在穩定傾向"),
  rule("H-HUO", "健康", "火星", ["命宮","疾厄"], -7, "火星在命疾的急性與躁動象意"),
  rule("H-LING", "健康", "鈴星", ["命宮","疾厄"], -7, "鈴星在命疾的隱性波動象意"),
  rule("H-SHA", "健康", "擎羊", ["命宮","疾厄"], -8, "擎羊在命疾的傷損象意"),
  rule("H-TUO", "健康", "陀羅", ["命宮","疾厄"], -7, "陀羅在命疾的拖延象意"),
  rule("H-KONG", "健康", "地空", ["命宮","福德","疾厄"], -5, "地空在命福疾的耗散象意"),
  rule("H-JIE", "健康", "地劫", ["命宮","福德","疾厄"], -5, "地劫在命福疾的耗損象意"),

  rule("C-ZI", "事業", "紫微", ["命宮","官祿"], 10, "紫微在命官的領導統籌"),
  rule("C-WU", "事業", "武曲", ["命宮","官祿"], 9, "武曲在命官的執行管理"),
  rule("C-FU", "事業", "天府", ["命宮","官祿"], 8, "天府在命官的管理守成"),
  rule("C-XIANG", "事業", "天相", ["命宮","官祿"], 7, "天相在命官的行政協調"),
  rule("C-SHA", "事業", "七殺", ["命宮","官祿"], 6, "七殺在命官的決斷開創"),
  rule("C-PO", "事業", "破軍", ["命宮","官祿"], 6, "破軍在命官的改革開創"),
  rule("C-TAN", "事業", "貪狼", ["命宮","官祿"], 6, "貪狼在命官的商業整合"),
  rule("C-SUN", "事業", "太陽", ["命宮","官祿"], 7, "太陽在命官的公開領導"),
  rule("C-JU", "事業", "巨門", ["命宮","官祿"], 5, "巨門在命官的表達與談判"),
  rule("C-KONG", "事業", "地空", ["官祿","遷移"], -6, "官遷地空的反覆"),
  rule("C-JIE", "事業", "地劫", ["官祿","遷移"], -6, "官遷地劫的耗損"),

  rule("S-TAN", "社交", "貪狼", ["命宮","僕役","遷移","夫妻"], 7, "貪狼的人脈與魅力"),
  rule("S-SUN", "社交", "太陽", ["命宮","僕役","遷移"], 7, "太陽的號召與公開性"),
  rule("S-TONG", "社交", "天同", ["命宮","僕役","遷移"], 6, "天同的親和作用"),
  rule("S-JU", "社交", "巨門", ["命宮","僕役","遷移"], 4, "巨門的溝通與談判作用"),
  rule("S-ZUO", "社交", "左輔", ["命宮","僕役","遷移","夫妻"], 5, "左輔的人際協助"),
  rule("S-YOU", "社交", "右弼", ["命宮","僕役","遷移","夫妻"], 5, "右弼的人際協助"),
  rule("S-SHA", "社交", "擎羊", ["僕役","遷移","夫妻"], -5, "擎羊的人際衝突象意"),
  rule("S-TUO", "社交", "陀羅", ["僕役","遷移","夫妻"], -5, "陀羅的人際阻滯象意"),

  rule("F-ZI", "家庭助力", "紫微", ["父母","田宅"], 7, "紫微在父田的資源統籌"),
  rule("F-FU", "家庭助力", "天府", ["父母","田宅"], 8, "天府在父田的資源與資產"),
  rule("F-SUN", "家庭助力", "太陽", ["父母"], 7, "太陽在父母宮的支持象意"),
  rule("F-YIN", "家庭助力", "太陰", ["父母","田宅"], 7, "太陰在父田的照顧與資產"),
  rule("F-KUI", "家庭助力", "天魁", ["父母","田宅"], 5, "父田天魁助力"),
  rule("F-YUE", "家庭助力", "天鉞", ["父母","田宅"], 5, "父田天鉞助力"),
  rule("F-KONG", "家庭助力", "地空", ["父母","田宅"], -6, "父田地空的落空"),
  rule("F-JIE", "家庭助力", "地劫", ["父母","田宅"], -6, "父田地劫的耗損"),
];

export const CONTEXT_RULES = [
  { id:"H-祿-財富", dimension:"財富", type:"四化", description:"化祿進命財官田" },
  { id:"H-祿-幸運", dimension:"幸運", type:"四化", description:"化祿進命福遷父" },
  { id:"H-祿-家庭助力", dimension:"家庭助力", type:"四化", description:"化祿進父母田宅" },
  { id:"H-權-事業", dimension:"事業", type:"四化", description:"化權進命官" },
  { id:"H-權-財富", dimension:"財富", type:"四化", description:"化權進財官" },
  { id:"H-科-事業", dimension:"事業", type:"四化", description:"化科進命官" },
  { id:"H-科-外貌", dimension:"外貌", type:"四化", description:"化科進命宮" },
  { id:"H-科-健康", dimension:"健康", type:"四化", description:"化科進命福疾" },
  { id:"H-忌-財富", dimension:"財富", type:"四化", description:"化忌進財官田" },
  { id:"H-忌-幸運", dimension:"幸運", type:"四化", description:"化忌進命福遷父" },
  { id:"H-忌-外貌", dimension:"外貌", type:"四化", description:"化忌進命宮" },
  { id:"H-忌-健康", dimension:"健康", type:"四化", description:"化忌進命福疾" },
  { id:"H-忌-事業", dimension:"事業", type:"四化", description:"化忌進命官" },
  { id:"H-忌-社交", dimension:"社交", type:"四化", description:"化忌進命僕遷夫" },
  { id:"H-忌-家庭助力", dimension:"家庭助力", type:"四化", description:"化忌進父田" },
  { id:"SY-FIRE-GREED", dimension:"財富", type:"嚴格同宮組合", description:"火貪實際同坐財帛；借對宮不成立" },
  { id:"SY-BELL-GREED", dimension:"財富", type:"嚴格同宮組合", description:"鈴貪實際同坐財帛；借對宮不成立" },
];

const brightnessOrder = new Map(BRIGHTNESS_LEVELS);

export function brightnessFactor(star, brightness, signedBase) {
  const nature = STAR_NATURE[star] ?? "mixed";
  const polarity = signedBase >= 0 ? "positive" : "negative";
  return RESPONSE[nature][polarity][brightness] ?? 1;
}

function detail(id, dimension, type, star, palace, brightness, factor, base, contribution, description) {
  return { id, dimension, type, star, palace, brightness, brightnessOrder: brightnessOrder.get(brightness) ?? null, factor, base, contribution, description };
}

export function scoreChart(chart) {
  const scores = Object.fromEntries(DIMENSIONS.map((name) => [name, DIMENSION_CONFIG[name].baseScore]));
  const details = [];
  const stars = chart.palaces.flatMap((palace) => palace.stars.map((star) => ({ ...star, palace: palace.name })));
  const byName = new Map(stars.map((star) => [star.name, star]));

  for (const item of STAR_RULES) {
    const star = byName.get(item.star);
    if (!star || !item.palaces.includes(star.palace)) continue;
    const factor = brightnessFactor(star.name, star.brightness, item.base);
    const contribution = Math.round(item.base * factor * 100) / 100;
    scores[item.dimension] += contribution;
    details.push(detail(item.id, item.dimension, "星曜宮位", star.name, star.palace, star.brightness, factor, item.base, contribution, item.description));
  }

  const addContext = (id, dimension, base, description, star = "", palace = "", brightness = "", factor = 1, type = "結構") => {
    const contribution = Math.round(base * factor * 100) / 100;
    scores[dimension] += contribution;
    details.push(detail(id, dimension, type, star, palace, brightness, factor, base, contribution, description));
  };
  const siHua = new Map(stars.filter((star) => ["祿","權","科","忌"].includes(star.siHua)).map((star) => [star.siHua, star]));
  const transformations = [
    ["祿", "財富", ["命宮","財帛","官祿","田宅"], 9], ["祿", "幸運", ["命宮","福德","遷移","父母"], 7],
    ["祿", "家庭助力", ["父母","田宅"], 8], ["權", "事業", ["命宮","官祿"], 9],
    ["權", "財富", ["財帛","官祿"], 5], ["科", "事業", ["命宮","官祿"], 6],
    ["科", "外貌", ["命宮"], 5], ["科", "健康", ["命宮","福德","疾厄"], 4],
    ["忌", "財富", ["財帛","官祿","田宅"], -12], ["忌", "幸運", ["命宮","福德","遷移","父母"], -10],
    ["忌", "外貌", ["命宮"], -7], ["忌", "健康", ["命宮","福德","疾厄"], -12],
    ["忌", "事業", ["命宮","官祿"], -12], ["忌", "社交", ["命宮","僕役","遷移","夫妻"], -9],
    ["忌", "家庭助力", ["父母","田宅"], -12],
  ];
  for (const [mutagen, dimension, palaces, base] of transformations) {
    const star = siHua.get(mutagen);
    if (star && palaces.includes(star.palace)) {
      // A transformation is contextual, so brightness moderates rather than
      // wholly determines its force. The underlying star still contributes
      // through its own palace rule above.
      const factor = 0.5 + brightnessFactor(star.name, star.brightness, base) * 0.5;
      addContext(`H-${mutagen}-${dimension}`, dimension, base, `${star.name}化${mutagen}進${star.palace}`, star.name, star.palace, star.brightness, factor, "四化");
    }
  }

  // Named patterns always use original physical locations, never effective or
  // borrowed-palace fields.
  const greed = byName.get("貪狼");
  const fire = byName.get("火星");
  const bell = byName.get("鈴星");
  if (greed?.palace === "財帛" && fire?.palace === "財帛") {
    const factor = (brightnessFactor("貪狼", greed.brightness, 10) + brightnessFactor("火星", fire.brightness, 10)) / 2;
    addContext("SY-FIRE-GREED", "財富", 10, "火星與貪狼實際同坐財帛；亮度調節爆發力，單獨煞性另計", "貪狼+火星", "財帛", `${greed.brightness}/${fire.brightness}`, factor, "嚴格同宮組合");
  }
  if (greed?.palace === "財帛" && bell?.palace === "財帛") {
    const factor = (brightnessFactor("貪狼", greed.brightness, 9) + brightnessFactor("鈴星", bell.brightness, 9)) / 2;
    addContext("SY-BELL-GREED", "財富", 9, "鈴星與貪狼實際同坐財帛；亮度調節爆發力，單獨煞性另計", "貪狼+鈴星", "財帛", `${greed.brightness}/${bell.brightness}`, factor, "嚴格同宮組合");
  }

  for (const dimension of DIMENSIONS) scores[dimension] = Math.round(Math.max(0, Math.min(100, scores[dimension])) * 100) / 100;
  scores.綜合 = Math.round(DIMENSIONS.reduce((sum, dimension) => sum + scores[dimension] * DIMENSION_CONFIG[dimension].overallWeight, 0) * 100) / 100;
  return { scores, details };
}
