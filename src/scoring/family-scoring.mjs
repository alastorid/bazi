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

// 倪師女命標準：女命武官星（殺破狼武曲）坐命主孤獨；福德宮最重，福德凶沖夫妻
// 主生離死別；子女宮空宮對宮化忌主無子。
const FEMALE_WARLORD_STARS = ["七殺", "破軍", "貪狼", "武曲"];

export function scoreFamily(chart, gender = "男") {
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
  const samePalace = (...names) => names.every((name) => byName.get(name)?.palace && byName.get(name)?.palace === byName.get(names[0])?.palace);
  const inThreeWay = (name) => ["命宮", "財帛", "官祿", "遷移"].includes(byName.get(name)?.palace);

  let parents = 38;
  for (const [star, base] of [["紫微",8],["天府",9],["太陽",7],["太陰",7],["天梁",7],["天相",6]]) parents += applyStar("父母", `FP-${star}`, star, ["父母"], base, `${star}在父母宮的支持作用`);
  for (const star of SUPPORT_STARS) if (palaceStars("父母").some((item) => item.name === star)) { parents += 3; addEvidence("父母",`FP-S-${star}`,"吉曜",3,3,`${star}在父母宮`); }
  if (mutation("祿")?.palace === "父母") { parents += 10; addEvidence("父母","FP-H-LU","四化",10,10,"化祿進父母宮，有祖產財祿",mutation("祿")); }
  if (mutation("科")?.palace === "父母") { parents += 5; addEvidence("父母","FP-H-KE","四化",5,5,"化科進父母宮",mutation("科")); }
  if (mutation("忌")?.palace === "父母") { parents -= 10; addEvidence("父母","FP-H-JI","四化",-10,-10,"化忌進父母宮，父母不在身邊",mutation("忌")); }
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

  // 欄名為了資料庫相容仍保留「爆發財富」，內容則完全改用《天紀》明示的
  // 橫財／巨富條件；不再把舊模型的財帛火貪、鈴貪或殺破狼當成爆發財。
  let explosiveWealth = 25;
  explosiveWealth += applyStar("爆發財富","FEW-SUN","太陽",["財帛"],7,"太陽在財帛主橫財（非固定收入）");
  const sun=byName.get("太陽"),giant=byName.get("巨門"),horse=byName.get("天馬"),lu=byName.get("祿存");
  if(inThreeWay("太陽")&&inThreeWay("巨門")&&brightnessOrder.get(sun?.brightness)>=6&&brightnessOrder.get(giant?.brightness)>=6){
    explosiveWealth+=18;addEvidence("爆發財富","FEW-JURI","倪師具名格局",18,18,"巨日廟旺會命：大生意人、巨富",giant);
  }
  if(horse?.palace&&(horse.palace===lu?.palace||horse.palace===mutation("祿")?.palace)){
    explosiveWealth+=12;addEvidence("爆發財富","FEW-LUMA","倪師具名格局",12,12,"祿存或化祿與天馬同宮：祿馬交馳，辛苦賺大錢",horse);
  }
  const powerPalace=mutation("權")?.palace;
  if(["命宮","財帛","官祿"].includes(powerPalace)&&(mutation("祿")?.palace===powerPalace||lu?.palace===powerPalace)){
    explosiveWealth+=10;addEvidence("爆發財富","FEW-QUANLU","倪師具名格局",10,10,"權祿相逢於命財官：自己做事業當老闆",mutation("權"));
  }
  explosiveWealth = clamp(explosiveWealth);
  const selfWealth = clamp(stableWealth*FAMILY_CONFIG.selfWealthWeights.stable + explosiveWealth*FAMILY_CONFIG.selfWealthWeights.explosive);

  // 外貌：倪師「太陰坐命女子漂亮」等星象，外貌不再是核心維度，只在家庭評分內部計算。
  let appearance = 40;
  const mingStars = palaceStars("命宮");
  for (const [star, base] of [["太陰",8],["天同",6],["天相",6],["紫微",5],["貪狼",5],["廉貞",4],["文昌",3],["文曲",3]]) {
    appearance += applyStar("外貌",`FA-${star}`,star,["命宮"],base,`${star}在命宮的清秀／氣質作用`);
  }
  const bodyPalace = chart.bodyPalaceName;
  for (const star of APPEARANCE_STARS) appearance += applyStar("外貌",`FA-BODY-${star}`,star,[bodyPalace],2.5,`${star}在身宮宮位的外貌／氣質輔助`);
  for (const star of mingStars) {
    if (CHALLENGING_STARS.includes(star.name) && ["不","陷"].includes(star.brightness)) {
      appearance -= 4; addEvidence("外貌","FA-SHA-FALLEN","煞星落陷",-4,-4,`${star.name}${star.brightness}在命宮折損氣質`,star);
    }
  }
  appearance = clamp(appearance);

  let romance = 34;
  for (const star of ROMANCE_STARS) {
    const item=byName.get(star); if(!item || !["命宮","夫妻","福德","遷移"].includes(item.palace)) continue;
    const base=["紅鸞","天喜"].includes(star)?9:5;
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
  if(mutation("忌")?.palace==="夫妻"){marriageNatal-=13;addEvidence("婚姻","FM-JI","四化",-13,-13,"化忌進夫妻宮，為婚姻重大不利訊號",mutation("忌"));}
  // 福德宮與夫妻宮一起看：福德凶（化忌／廉破／廉貪）主夫妻不能長久。
  if(mutation("忌")?.palace==="福德"){marriageNatal-=10;addEvidence("婚姻","FM-FUDE-JI","四化",-10,-10,"化忌進福德宮：福德與婚姻不利，須與命運、陽宅及面相同參",mutation("忌"));}
  const fudeNames=palaceStars("福德").filter((s)=>s.type==="major").map((s)=>s.name);
  if(fudeNames.includes("廉貞")&&(fudeNames.includes("破軍")||fudeNames.includes("貪狼"))){
    marriageNatal-=9;addEvidence("婚姻","FM-FUDE-LIANX","凶格",-9,-9,"福德宮廉貞破軍／廉貞貪狼：婚姻重大不利訊號，須與命運、陽宅及面相同參");
  }
  // 倪師：女命武官星（殺破狼武曲）坐命，女身男命，婚姻孤獨訊號。
  const mingMajorNames=palaceStars("命宮").filter((s)=>s.type==="major").map((s)=>s.name);
  if(gender==="女"&&mingMajorNames.some((name)=>FEMALE_WARLORD_STARS.includes(name))){
    marriageNatal-=8;addEvidence("婚姻","FM-NV-WUGUAN","女命武官",-8,-8,"女命武官星坐命：女身男命，婚姻孤獨訊號");
  }
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
  if(mutation("祿")?.palace==="子女"){childStrength+=8;addEvidence("真子女宮強度","FC-LU","四化",8,8,"化祿進子女宮：兒子優秀",mutation("祿"));}
  if(mutation("忌")?.palace==="子女"){childStrength-=10;addEvidence("真子女宮強度","FC-JI","四化",-10,-10,"化忌進子女宮：與子女衝突大",mutation("忌"));}
  if(borrowed&&mutation("忌")?.palace==="田宅"){childStrength-=8;addEvidence("真子女宮強度","FC-WUZI","凶格",-8,-8,"子女宮空宮且對宮化忌：代表無子");}
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
