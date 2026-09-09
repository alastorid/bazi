import { BRIGHTNESS_LEVELS, brightnessFactor, STAR_NATURE } from "../scoring-model.mjs";
import {
  APPEARANCE_STARS, CHALLENGING_STARS, FAMILY_CONFIG, PARENT_SUPPORT_STARS,
  PARENT_WEALTH_STARS, ROMANCE_STARS, SUPPORT_STARS,
} from "./config.mjs";
import { scoreTiming } from "./timing-scoring.mjs";

const clamp = (value) => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
const round = (value) => Math.round(value * 100) / 100;
const safe = (value) => Math.max(1, value);
const brightnessOrder = new Map(BRIGHTNESS_LEVELS);

export function scoreFamily(chart, coreScores) {
  const palaces = new Map(chart.palaces.map((palace) => [palace.name, palace]));
  const stars = chart.palaces.flatMap((palace) => palace.stars.map((star) => ({ ...star, palace: palace.name })));
  const byName = new Map(stars.map((star) => [star.name, star]));
  const evidence = [];
  const addEvidence = (component, ruleId, type, base, contribution, description, star = null, age = null) => evidence.push({
    component, ruleId, type, star: star?.name ?? "", palace: star?.palace ?? "",
    brightness: star?.brightness ?? "", brightnessOrder: brightnessOrder.get(star?.brightness) ?? null, factor: base ? round(contribution / base) : 1,
    base: round(base), contribution: round(contribution), age: age?.age ?? null, year: age?.year ?? null, description,
  });
  const applyStar = (component, ruleId, starName, targetPalaces, base, description) => {
    const star = byName.get(starName);
    if (!star || !targetPalaces.includes(star.palace)) return 0;
    const factor = brightnessFactor(star.name, star.brightness, base);
    const value = round(base * factor);
    addEvidence(component, ruleId, "星曜宮位亮度", base, value, description, star);
    return value;
  };
  const palaceStars = (name) => palaces.get(name)?.stars ?? [];
  const mutation = (name) => stars.find((star) => star.siHua === name);

  let parents = 38;
  for (const [star, base] of [["紫微",8],["天府",9],["太陽",7],["太陰",7],["天梁",7],["天相",6]]) parents += applyStar("父母", `FP-${star}`, star, ["父母"], base, `${star}在父母宮的支持作用`);
  for (const star of SUPPORT_STARS) if (palaceStars("父母").some((item) => item.name === star)) { parents += 3; addEvidence("父母",`FP-S-${star}`,"吉曜",3,3,`${star}在父母宮`); }
  if (mutation("祿")?.palace === "父母") { parents += 10; addEvidence("父母","FP-H-LU","四化",10,10,"化祿進父母宮",mutation("祿")); }
  if (mutation("科")?.palace === "父母") { parents += 5; addEvidence("父母","FP-H-KE","四化",5,5,"化科進父母宮",mutation("科")); }
  if (mutation("忌")?.palace === "父母") { parents -= 10; addEvidence("父母","FP-H-JI","四化",-10,-10,"化忌進父母宮",mutation("忌")); }
  parents = clamp(parents);

  let parentsWealth = 34;
  for (const [star, base] of [["紫微",7],["天府",10],["武曲",9],["太陰",8],["太陽",6],["祿存",8]]) parentsWealth += applyStar("父母財富",`FPW-${star}`,star,["父母","田宅"],base,`${star}在父母／田宅的財務資源作用`);
  if (["父母","田宅"].includes(mutation("祿")?.palace)) { parentsWealth += 10; addEvidence("父母財富","FPW-H-LU","四化",10,10,`化祿進${mutation("祿").palace}`,mutation("祿")); }
  if (["父母","田宅"].includes(mutation("忌")?.palace)) { parentsWealth -= 11; addEvidence("父母財富","FPW-H-JI","四化",-11,-11,`化忌進${mutation("忌").palace}`,mutation("忌")); }
  parentsWealth = clamp(parentsWealth);

  const parentMajor = palaceStars("父母").filter((star) => star.type === "major");
  const parentTough = palaceStars("父母").filter((star) => CHALLENGING_STARS.includes(star.name));
  const fallenMajor = parentMajor.filter((star) => ["不","陷"].includes(star.brightness));
  let parentsNegative = 0;
  if (parentTough.length) { const value=Math.min(24,parentTough.length*6); parentsNegative+=value; addEvidence("父母負向","FPN-TOUGH","多條負向合成",value,value,`父母宮見${parentTough.map((s)=>s.name).join("、")}`); }
  if (fallenMajor.length) { const value=Math.min(20,fallenMajor.length*9); parentsNegative+=value; addEvidence("父母負向","FPN-FALLEN","主星亮度",value,value,`父母主星${fallenMajor.map((s)=>`${s.name}${s.brightness}`).join("、")}`); }
  if (mutation("忌")?.palace === "父母") { parentsNegative+=18; addEvidence("父母負向","FPN-JI","四化",18,18,"化忌進父母宮",mutation("忌")); }
  if (fallenMajor.length && parentTough.length >= 2) { parentsNegative+=24; addEvidence("父母負向","FPN-COMBO","嚴重組合",24,24,"父母主星不／陷且同見兩顆以上強煞"); }
  if (parentTough.length >= 3) { parentsNegative+=14; addEvidence("父母負向","FPN-MULTI","嚴重組合",14,14,"父母宮三顆以上煞耗同聚"); }
  parentsNegative = clamp(parentsNegative);
  const parentsQuality = clamp(parents*0.55 + parentsWealth*0.45 - parentsNegative*0.55);

  let stableWealth = 33;
  for (const [star, base] of [["武曲",9],["天府",10],["太陰",8],["紫微",6],["太陽",5],["祿存",8]]) stableWealth += applyStar("穩定財富",`FSW-${star}`,star,["命宮","財帛","官祿","田宅"],base,`${star}在命財官田的穩定財務作用`);
  if (["命宮","財帛","官祿","田宅"].includes(mutation("祿")?.palace)) { stableWealth+=10; addEvidence("穩定財富","FSW-LU","四化",10,10,`化祿進${mutation("祿").palace}`,mutation("祿")); }
  if (["財帛","官祿","田宅"].includes(mutation("忌")?.palace)) { stableWealth-=12; addEvidence("穩定財富","FSW-JI","四化",-12,-12,`化忌進${mutation("忌").palace}`,mutation("忌")); }
  stableWealth = clamp(stableWealth);

  let explosiveWealth = 25;
  explosiveWealth += applyStar("爆發財富","FEW-TAN","貪狼",["財帛","官祿","遷移"],7,"貪狼的機會財作用");
  explosiveWealth += applyStar("爆發財富","FEW-PO","破軍",["財帛","官祿"],6,"破軍的重組與爆發作用");
  explosiveWealth += applyStar("爆發財富","FEW-SHA","七殺",["財帛","官祿"],5,"七殺的高風險開創作用");
  const greed=byName.get("貪狼"),fire=byName.get("火星"),bell=byName.get("鈴星");
  if (greed?.palace==="財帛" && fire?.palace==="財帛") { const f=(brightnessFactor("貪狼",greed.brightness,18)+brightnessFactor("火星",fire.brightness,18))/2,v=round(18*f); explosiveWealth+=v; addEvidence("爆發財富","FEW-FIRE-GREED","嚴格同宮組合",18,v,"火貪實際同坐財帛",greed); }
  if (greed?.palace==="財帛" && bell?.palace==="財帛") { const f=(brightnessFactor("貪狼",greed.brightness,16)+brightnessFactor("鈴星",bell.brightness,16))/2,v=round(16*f); explosiveWealth+=v; addEvidence("爆發財富","FEW-BELL-GREED","嚴格同宮組合",16,v,"鈴貪實際同坐財帛",greed); }
  explosiveWealth = clamp(explosiveWealth);
  const selfWealth = clamp(stableWealth*FAMILY_CONFIG.selfWealthWeights.stable + explosiveWealth*FAMILY_CONFIG.selfWealthWeights.explosive);

  let appearance = Number(coreScores.外貌 ?? 50);
  const bodyPalace = chart.bodyPalaceName;
  for (const star of APPEARANCE_STARS) appearance += applyStar("外貌",`FA-BODY-${star}`,star,[bodyPalace],2.5,`${star}在身宮宮位的外貌／氣質輔助`);
  appearance = clamp(appearance);

  let romance = 34;
  for (const star of ROMANCE_STARS) {
    const item=byName.get(star); if(!item || !["命宮","夫妻","福德","遷移"].includes(item.palace)) continue;
    const base=["紅鸞","天喜"].includes(star)?9:["天姚","咸池"].includes(star)?6:5;
    const factor=item.brightness?brightnessFactor(star,item.brightness,base):1;
    const value=round(base*factor); romance+=value; addEvidence("戀愛",`FR-${star}`,"桃花／關係星",base,value,`${star}在${item.palace}`,item);
  }
  if (mutation("忌")?.palace === "夫妻") { romance-=10; addEvidence("戀愛","FR-JI","四化",-10,-10,"化忌進夫妻宮",mutation("忌")); }
  romance=clamp(romance);

  const timing = scoreTiming(chart);
  const bestMarriageTiming = timing.bestMarriage?.marriageTriggerScore ?? 0;
  const bestChildrenTiming = timing.bestChildren?.childrenTriggerScore ?? 0;
  const bestFamilyTiming = timing.bestFamily?.familyTimingScore ?? 0;
  if(timing.bestMarriage) addEvidence("婚姻時機","FT-MARRIAGE","大小限流年",bestMarriageTiming,bestMarriageTiming,timing.bestMarriage.marriageReasons.join("；"),null,timing.bestMarriage);
  if(timing.bestChildren) addEvidence("子女時機","FT-CHILDREN","大小限流年",bestChildrenTiming,bestChildrenTiming,timing.bestChildren.childrenReasons.join("；"),null,timing.bestChildren);

  let marriageNatal=38;
  for(const star of palaceStars("夫妻").filter((s)=>s.type==="major")){
    const nature=STAR_NATURE[star.name]??"mixed",base=nature==="benefic"?7:nature==="mixed"?4:-3;
    const value=round(base*brightnessFactor(star.name,star.brightness,base)); marriageNatal+=value; addEvidence("婚姻",`FM-${star.name}`,"夫妻主星亮度",base,value,`${star.name}在夫妻宮`,{...star,palace:"夫妻"});
  }
  for(const star of SUPPORT_STARS) if(palaceStars("夫妻").some((s)=>s.name===star)){marriageNatal+=3;addEvidence("婚姻",`FM-S-${star}`,"吉曜",3,3,`${star}在夫妻宮`);}
  if(mutation("忌")?.palace==="夫妻"){marriageNatal-=13;addEvidence("婚姻","FM-JI","四化",-13,-13,"化忌進夫妻宮",mutation("忌"));}
  const marriage=clamp(marriageNatal*0.62+bestMarriageTiming*0.38);

  const childPalace=palaces.get("子女");
  const borrowed=!(childPalace?.stars.some((s)=>s.type==="major"));
  const effectiveChildStars=(borrowed?palaces.get("田宅"):childPalace)?.stars.filter((s)=>s.type==="major")??[];
  const childrenHasMajor=effectiveChildStars.length>0;
  let childStrength=childrenHasMajor?40:25;
  for(const star of effectiveChildStars){
    const nature=STAR_NATURE[star.name]??"mixed",base=nature==="benefic"?8:nature==="mixed"?5:2;
    const value=round(base*brightnessFactor(star.name,star.brightness,base)*(borrowed?0.65:1)); childStrength+=value;
    addEvidence("真子女宮強度",`FC-${star.name}`,borrowed?"借對宮主星":"本宮主星",base,value,`${star.name}${star.brightness||""}${borrowed?"由田宅借入":"在子女宮"}`,{...star,palace:borrowed?"真子女宮(借田宅)":"子女"});
  }
  for(const star of SUPPORT_STARS) if(palaceStars("子女").some((s)=>s.name===star)){childStrength+=3;addEvidence("真子女宮強度",`FC-S-${star}`,"吉曜",3,3,`${star}在子女宮`);}
  for(const star of CHALLENGING_STARS) if(palaceStars("子女").some((s)=>s.name===star)){childStrength-=4;addEvidence("真子女宮強度",`FC-N-${star}`,"煞耗",-4,-4,`${star}在子女宮`);}
  if(mutation("祿")?.palace==="子女"){childStrength+=8;addEvidence("真子女宮強度","FC-LU","四化",8,8,"化祿進子女宮",mutation("祿"));}
  if(mutation("忌")?.palace==="子女"){childStrength-=10;addEvidence("真子女宮強度","FC-JI","四化",-10,-10,"化忌進子女宮",mutation("忌"));}
  childStrength=clamp(childStrength);
  const children=clamp(childStrength*0.63+bestChildrenTiming*0.37);

  const positive={parentsWealth,parentsQuality,selfWealth,appearance,romance,marriage,children,familyTiming:bestFamilyTiming};
  const weights=FAMILY_CONFIG.familyWeights;
  const positiveWeight=Object.values(weights).reduce((a,b)=>a+b,0);
  const positiveSum=Object.entries(weights).reduce((sum,[name,weight])=>sum+positive[name]*weight,0);
  const penalty=parentsNegative*FAMILY_CONFIG.parentsNegativePenaltyWeight;
  const familyRaw=round((positiveSum-penalty)/positiveWeight);
  const familyQuality=clamp(familyRaw);
  const harmonic=positiveWeight/Object.entries(weights).reduce((sum,[name,weight])=>sum+weight/safe(positive[name]),0);
  const familyBalance=clamp(harmonic-penalty/positiveWeight);
  addEvidence("家庭品質","FQ-PENALTY","設定權重",-FAMILY_CONFIG.parentsNegativePenaltyWeight,-penalty/positiveWeight,`父母負向 ${parentsNegative} × ${FAMILY_CONFIG.parentsNegativePenaltyWeight}，除以正向權重 ${positiveWeight}`);

  return {
    scores:{parents,parentsWealth,parentsNegative,parentsQuality,stableWealth,explosiveWealth,selfWealth,appearance,romance,marriage,marriageTiming:bestMarriageTiming,children,childrenPalaceStrength:childStrength,childrenTiming:bestChildrenTiming,familyTiming:bestFamilyTiming,familyRaw,familyQuality,familyBalance},
    flags:{childrenPalaceHasMajorStar:childrenHasMajor,childrenPalaceSource:borrowed?"借田宅對宮":"本宮"},
    timing:{...timing,bestMarriageAge:timing.bestMarriage?.age??null,bestMarriageYear:timing.bestMarriage?.year??null,bestChildrenAge:timing.bestChildren?.age??null,bestChildrenYear:timing.bestChildren?.year??null},
    evidence,
  };
}
