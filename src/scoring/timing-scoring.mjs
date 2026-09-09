import { FAMILY_CONFIG } from "./config.mjs";

const clamp = (value) => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
const includes = (list, value) => Array.isArray(list) && list.includes(value);

function location(period, name) {
  const index = period?.starLocations?.find((item) => item.name === name)?.index;
  if (!Number.isInteger(index)) return null;
  return {
    natalPalace: period.starLocations.find((item) => item.name === name)?.natalPalace ?? "",
    dynamicPalace: period.palaceNames?.[index] ?? "",
  };
}

export function scoreTiming(chart) {
  const rows = [];
  const relevant = FAMILY_CONFIG.timing.relevantPalaces;
  for (const period of chart.timing ?? []) {
    const majorHong = location(period.decadal, "運鸞");
    const majorXi = location(period.decadal, "運喜");
    const yearlyHong = location(period.yearly, "流鸞");
    const yearlyXi = location(period.yearly, "流喜");
    const majorHongActive = Boolean(majorHong && includes(relevant, majorHong.dynamicPalace));
    const majorXiActive = Boolean(majorXi && includes(relevant, majorXi.dynamicPalace));
    const yearlyHongActive = Boolean(yearlyHong && includes(relevant, yearlyHong.dynamicPalace));
    const yearlyXiActive = Boolean(yearlyXi && includes(relevant, yearlyXi.dynamicPalace));
    const minorHongActive = Boolean(period.age.natalStars?.includes("紅鸞"));
    const minorXiActive = Boolean(period.age.natalStars?.includes("天喜"));
    const decadalTheme = period.decadal.natalPalace;
    const minorTheme = period.age.natalPalace;
    const yearlyMarriageIndex = period.yearly.palaceNames?.indexOf("夫妻");
    const yearlyChildrenIndex = period.yearly.palaceNames?.indexOf("子女");
    const yearlyMarriageStars = period.yearly.starLocations?.filter((item) => item.index === yearlyMarriageIndex).map((item) => item.name) ?? [];
    const yearlyChildrenStars = period.yearly.starLocations?.filter((item) => item.index === yearlyChildrenIndex).map((item) => item.name) ?? [];
    const annualMarriageTough = yearlyMarriageStars.some((name) => ["流羊", "流陀"].includes(name));
    const annualChildrenTough = yearlyChildrenStars.some((name) => ["流羊", "流陀"].includes(name));

    let marriage = 28;
    const marriageReasons = [];
    if (["夫妻", "命宮", "福德"].includes(decadalTheme)) { marriage += 14; marriageReasons.push(`大限落本命${decadalTheme}`); }
    if (["夫妻", "命宮", "福德"].includes(minorTheme)) { marriage += 9; marriageReasons.push(`小限落本命${minorTheme}`); }
    if (majorHongActive) { marriage += 9; marriageReasons.push(`運鸞入${majorHong.dynamicPalace}`); }
    if (majorXiActive) { marriage += 9; marriageReasons.push(`運喜入${majorXi.dynamicPalace}`); }
    if (minorHongActive) { marriage += 8; marriageReasons.push("小限宮見本命紅鸞"); }
    if (minorXiActive) { marriage += 8; marriageReasons.push("小限宮見本命天喜"); }
    if (yearlyHongActive) { marriage += 7; marriageReasons.push(`流鸞入${yearlyHong.dynamicPalace}`); }
    if (yearlyXiActive) { marriage += 7; marriageReasons.push(`流喜入${yearlyXi.dynamicPalace}`); }
    const sameYearPair = (minorHongActive && minorXiActive) || (yearlyHongActive && yearlyXiActive);
    if (sameYearPair) { marriage += 10; marriageReasons.push("同歲鸞喜雙觸發"); }
    if (annualMarriageTough) { marriage -= 9; marriageReasons.push("流羊／流陀入流年夫妻"); }

    let children = 25;
    const childrenReasons = [];
    if (["子女", "夫妻", "田宅", "福德"].includes(decadalTheme)) { children += 15; childrenReasons.push(`大限落本命${decadalTheme}`); }
    if (["子女", "夫妻", "田宅"].includes(minorTheme)) { children += 10; childrenReasons.push(`小限落本命${minorTheme}`); }
    if (majorXiActive || majorHongActive) { children += 8; childrenReasons.push("大限鸞喜進婚育相關宮"); }
    if (minorXiActive || minorHongActive) { children += 7; childrenReasons.push("小限宮見本命鸞喜"); }
    if (yearlyXiActive || yearlyHongActive) { children += 7; childrenReasons.push("流年鸞喜進婚育相關宮"); }
    if (annualChildrenTough) { children -= 9; childrenReasons.push("流羊／流陀入流年子女"); }

    const marriageScore = clamp(marriage);
    const childrenScore = clamp(children);
    const familyTimingScore = clamp(0.58 * marriageScore + 0.42 * childrenScore + (marriageScore >= 65 && childrenScore >= 60 ? 10 : 0));
    rows.push({
      age: period.ageValue, year: period.year, decadalRange: period.decadal.range.join("-"),
      decadalPalace: decadalTheme, minorPalace: minorTheme,
      majorPeriodHongluan: majorHongActive, majorPeriodTianxi: majorXiActive,
      minorPeriodHongluan: minorHongActive, minorPeriodTianxi: minorXiActive,
      yearlyHongluan: yearlyHongActive, yearlyTianxi: yearlyXiActive,
      marriageTriggerCount: [majorHongActive,majorXiActive,minorHongActive,minorXiActive,yearlyHongActive,yearlyXiActive].filter(Boolean).length,
      marriageTriggerScore: marriageScore, childrenTriggerScore: childrenScore, familyTimingScore,
      marriageReasons, childrenReasons,
    });
  }
  const bestMarriage = [...rows].sort((a,b) => b.marriageTriggerScore-a.marriageTriggerScore || a.age-b.age)[0];
  const bestChildren = [...rows].sort((a,b) => b.childrenTriggerScore-a.childrenTriggerScore || a.age-b.age)[0];
  const bestFamily = [...rows].sort((a,b) => b.familyTimingScore-a.familyTimingScore || a.age-b.age)[0];
  const strong = rows.filter((row) => row.marriageTriggerScore >= FAMILY_CONFIG.timing.strongTrigger);
  return {
    rows, bestMarriage, bestChildren, bestFamily,
    windowStartAge: strong[0]?.age ?? bestMarriage?.age ?? null,
    windowEndAge: strong.at(-1)?.age ?? bestMarriage?.age ?? null,
  };
}

