export const FAMILY_CONFIG = Object.freeze({
  marriageAgeRange: Object.freeze([25, 35]),
  parentsNegativePenaltyWeight: 9,
  selfWealthWeights: Object.freeze({ stable: 0.78, explosive: 0.22 }),
  familyWeights: Object.freeze({
    parentsWealth: 2,
    parentsQuality: 2.5,
    selfWealth: 2.5,
    appearance: 1,
    romance: 1,
    marriage: 2,
    children: 2,
    familyTiming: 2,
  }),
  timing: Object.freeze({
    relevantPalaces: Object.freeze(["命宮", "夫妻", "子女", "福德"]),
    strongTrigger: 65,
  }),
});

export const FAMILY_COMPONENTS = Object.freeze([
  "父母", "父母財富", "父母負向", "父母品質",
  "穩定財富", "爆發財富", "自身財富", "外貌", "戀愛",
  "婚姻", "婚姻時機", "子女", "真子女宮強度", "子女時機",
  "家庭時機", "家庭品質", "家庭平衡",
]);

export const FAMILY_PERCENTILE_COMPONENTS = Object.freeze([
  "父母", "父母財富", "父母品質", "穩定財富", "爆發財富", "自身財富",
  "外貌", "戀愛", "婚姻", "婚姻時機", "子女", "真子女宮強度",
  "子女時機", "家庭時機", "家庭品質", "家庭平衡",
]);

export const PARENT_SUPPORT_STARS = Object.freeze(["紫微", "天府", "太陽", "太陰", "天梁", "天相"]);
export const PARENT_WEALTH_STARS = Object.freeze(["紫微", "天府", "武曲", "太陰", "太陽", "祿存"]);
export const APPEARANCE_STARS = Object.freeze(["太陰", "天相", "天同", "紫微", "貪狼", "廉貞"]);
export const ROMANCE_STARS = Object.freeze(["紅鸞", "天喜", "貪狼", "廉貞"]);
export const SUPPORT_STARS = Object.freeze(["左輔", "右弼", "天魁", "天鉞", "文昌", "文曲", "祿存"]);
export const CHALLENGING_STARS = Object.freeze(["擎羊", "陀羅", "火星", "鈴星", "天空", "地劫"]);
