/**
 * Batch-oriented port of ziwei-doushu/lib/ziwei/algorithm.ts.
 * The source project uses iztro + lunar-javascript; this keeps the same
 * bySolar call and palace/star assembly while preserving iztro's exact
 * brightness label for database filtering.
 */
import { astro } from "iztro";
import lunarPkg from "lunar-javascript";

const { Solar } = lunarPkg;

export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
export const HOURS = BRANCHES.map((branch, index) => ({ index, branch, label: `${branch}時` }));
export const GENDERS = [
  { code: "male", label: "男" },
  { code: "female", label: "女" },
];

function parseWuxingJu(name = "") {
  if (name.includes("二")) return 2;
  if (name.includes("三")) return 3;
  if (name.includes("四")) return 4;
  if (name.includes("五")) return 5;
  if (name.includes("六")) return 6;
  return 3;
}

export function getLunarInfo(year, month, day) {
  const lunar = Solar.fromYmd(year, month, day).getLunar();
  const rawMonth = lunar.getMonth();
  return {
    lunarYear: lunar.getYear(),
    lunarMonth: Math.abs(rawMonth),
    lunarDay: lunar.getDay(),
    yearStem: lunar.getYearGan(),
    yearBranch: lunar.getYearZhi(),
    isLeapMonth: rawMonth < 0,
  };
}

export function generateChart({ year, month, day, hour, gender }) {
  const solarDate = `${year}-${month}-${day}`;
  const astrolabe = astro.bySolar(solarDate, hour, gender === "male" ? "男" : "女", true, "zh-TW");
  const palaces = astrolabe.palaces.map((palace) => {
    const starGroups = [palace.majorStars ?? [], palace.minorStars ?? [], palace.adjectiveStars ?? []];
    const stars = starGroups.flatMap((group, groupIndex) => group.map((star) => ({
      name: String(star.name),
      type: groupIndex === 0 ? "major" : groupIndex === 1 ? "minor" : "adjective",
      brightness: String(star.brightness ?? ""),
      siHua: String(star.mutagen ?? ""),
    })));
    return {
      name: String(palace.name),
      branch: String(palace.earthlyBranch),
      stem: String(palace.heavenlyStem),
      isBodyPalace: Boolean(palace.isBodyPalace),
      daXianRange: Array.isArray(palace.decadal?.range) ? palace.decadal.range.map(Number) : [],
      stars,
    };
  });
  const lunarInfo = getLunarInfo(year, month, day);
  return {
    palaces,
    lunarInfo,
    soulBranch: String(astrolabe.earthlyBranchOfSoulPalace),
    bodyBranch: String(astrolabe.earthlyBranchOfBodyPalace),
    bodyPalaceName: palaces.find((palace) => palace.isBodyPalace)?.name ?? "",
    wuxingJuName: String(astrolabe.fiveElementsClass),
    wuxingJu: parseWuxingJu(String(astrolabe.fiveElementsClass)),
  };
}
