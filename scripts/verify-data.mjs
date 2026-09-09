import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import initSqlJs from "sql.js";
import { fileURLToPath } from "node:url";
import { BRIGHTNESS_LEVELS, DIMENSIONS, DIMENSION_CONFIG, FORMATION_RULES } from "../src/scoring-model.mjs";
import { FAMILY_CONFIG, FAMILY_PERCENTILE_COMPONENTS } from "../src/scoring/config.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const metadata=JSON.parse(fs.readFileSync(path.join(root,"data","metadata.json"),"utf8"));
const SQL=await initSqlJs({locateFile:(file)=>path.join(root,"node_modules","sql.js","dist",file)});
const db=new SQL.Database(zlib.gunzipSync(fs.readFileSync(path.join(root,metadata.sqlite))));
const rows=(sql)=>{const result=db.exec(sql)[0];return result?result.values.map((values)=>Object.fromEntries(result.columns.map((column,i)=>[column,values[i]]))):[]};
const scalar=(sql)=>rows(sql)[0]?.n??0;

const count=rows('SELECT COUNT(*) AS n,COUNT(DISTINCT "KEY") AS keys FROM "命盤"')[0];
if(count.n!==metadata.rowCount||count.keys!==metadata.rowCount)throw new Error(`row/key mismatch: ${JSON.stringify(count)}`);
const objects=new Set(rows("SELECT name FROM sqlite_master WHERE type IN ('table','view')").map((item)=>item.name));
for(const name of ["命盤","星曜亮度","亮度等級","命盤評分","命盤評分明細","評分規則","評分維度","排名門檻","格局規則","命盤格局","命盤家庭評分","命盤家庭評分明細","命盤婚育時機","family_scores"])if(!objects.has(name))throw new Error(`missing database object: ${name}`);

const schemaNames=new Set(rows('PRAGMA table_info("命盤")').map((column)=>column.name));
const specs=metadata.palaceSemantics;
if(!Array.isArray(specs)||specs.length!==12)throw new Error(`expected 12 palace semantics, got ${specs?.length}`);
const byLabel=new Map(specs.map((spec)=>[spec.label,spec]));
const expectedOpposites={命宮:"遷移宮",兄弟宮:"交友宮",夫妻宮:"官祿宮",子女宮:"田宅宮",財帛宮:"福德宮",疾厄宮:"父母宮",遷移宮:"命宮",交友宮:"兄弟宮",官祿宮:"夫妻宮",田宅宮:"子女宮",福德宮:"財帛宮",父母宮:"疾厄宮"};
for(const spec of specs){
  if(spec.opposite!==expectedOpposites[spec.label])throw new Error(`wrong opposite mapping for ${spec.label}`);
  const opposite=byLabel.get(spec.opposite);
  for(const column of [`${spec.label}是否空宮`,`${spec.label}對宮`,`${spec.label}對宮主星`,`${spec.label}對宮全部星`,`真${spec.label}`,`真${spec.label}主星`,`真${spec.label}全部星`,`真${spec.label}來源`])if(!schemaNames.has(column))throw new Error(`missing semantic column: ${column}`);
  if(scalar(`SELECT COUNT(*) AS n FROM "命盤" WHERE "${spec.label}是否空宮"<>CASE WHEN "${spec.raw}主星"='' THEN 1 ELSE 0 END`))throw new Error(`incorrect empty flags for ${spec.label}`);
  if(scalar(`SELECT COUNT(*) AS n FROM "命盤" WHERE "${spec.label}對宮"<>'${spec.opposite}' OR "${spec.label}對宮主星"<>"${opposite.raw}主星" OR "${spec.label}對宮全部星"<>"${opposite.raw}全部星"`))throw new Error(`incorrect opposite rows for ${spec.label}`);
  if(scalar(`SELECT COUNT(*) AS n FROM "命盤" WHERE "真${spec.label}主星"<>CASE WHEN "${spec.label}是否空宮"=1 THEN "${opposite.raw}主星" ELSE "${spec.raw}主星" END OR "真${spec.label}來源"<>CASE WHEN "${spec.label}是否空宮"=1 THEN '借對宮' ELSE '本宮' END`))throw new Error(`incorrect effective rows for ${spec.label}`);
}
if(scalar(`SELECT COUNT(*) AS n FROM "命盤" WHERE "空宮數"<>${specs.map((spec)=>`"${spec.label}是否空宮"`).join("+")}`))throw new Error("incorrect 空宮數");
const missingRaw=scalar('SELECT COUNT(*) AS n FROM "命盤" WHERE "化祿宮位"=\'\' OR "化權宮位"=\'\' OR "化科宮位"=\'\' OR "化忌宮位"=\'\' OR "命宮"=\'\' OR "身宮"=\'\' OR "身宮宮位"=\'\'');
if(missingRaw)throw new Error(`${missingRaw} rows have missing required raw fields`);
const invalidLinks=scalar(`SELECT COUNT(*) AS n FROM "命盤" WHERE "命盤連結" NOT LIKE 'https://metisziwei.com/chart?y=${metadata.year}&m=%&d=%&h=%&mi=0&g=%'`);
if(invalidLinks)throw new Error(`${invalidLinks} rows have invalid chart links`);
const daXianColumns=metadata.palaces.map((palace)=>`${palace}大限`);
for(const column of daXianColumns)if(!schemaNames.has(column))throw new Error(`missing da-xian column: ${column}`);
const missingDaXian=scalar(`SELECT COUNT(*) AS n FROM "命盤" WHERE ${daXianColumns.map((column)=>`"${column}"=''`).join(" OR ")}`);
if(missingDaXian)throw new Error(`${missingDaXian} rows have missing da-xian ranges`);

const levels=rows('SELECT "亮度","亮度序" FROM "亮度等級" ORDER BY "亮度序"').map((row)=>[row.亮度,row.亮度序]);
if(JSON.stringify(levels)!==JSON.stringify(BRIGHTNESS_LEVELS))throw new Error(`brightness lookup mismatch: ${JSON.stringify(levels)}`);
const brightnessCount=scalar('SELECT COUNT(*) AS n FROM "星曜亮度"');
if(!brightnessCount)throw new Error("星曜亮度 is empty");
for(const star of metadata.stars){
  const safe=star.replaceAll("'","''");
  const bad=scalar(`SELECT COUNT(*) AS n FROM "星曜亮度" b JOIN "命盤" m ON m."KEY"=b."KEY" WHERE b."星曜"='${safe}' AND (b."亮度"<>m."${star}星等" OR b."宮位"<>m."${star}宮位")`);
  if(bad)throw new Error(`${bad} normalized brightness mismatches for ${star}`);
}
if(scalar('SELECT COUNT(*) AS n FROM "星曜亮度" b LEFT JOIN "亮度等級" l ON l."亮度"=b."亮度" AND l."亮度序"=b."亮度序" WHERE l."亮度" IS NULL'))throw new Error("invalid normalized brightness order");

const scoreCount=scalar('SELECT COUNT(*) AS n FROM "命盤評分"');
if(scoreCount!==metadata.rowCount)throw new Error(`rating row mismatch: ${scoreCount}`);
for(const dimension of DIMENSIONS){
  const invalid=scalar(`WITH s AS (SELECT "KEY",SUM("實際貢獻") AS delta FROM "命盤評分明細" WHERE "維度"='${dimension}' GROUP BY "KEY") SELECT COUNT(*) AS n FROM "命盤評分" r LEFT JOIN s ON s."KEY"=r."KEY" WHERE ABS(r."${dimension}分"-ROUND(MAX(0,MIN(100,${DIMENSION_CONFIG[dimension].baseScore}+COALESCE(s.delta,0))),2))>0.011`);
  if(invalid)throw new Error(`${invalid} ${dimension} scores do not reconcile to details`);
  const sss=scalar(`SELECT COUNT(*) AS n FROM "命盤評分" WHERE "${dimension}排名"='SSS'`);
  if(sss>Math.ceil(metadata.rowCount*0.03))throw new Error(`${dimension} SSS inflated: ${sss}`);
}
const overallExpr=DIMENSIONS.map((dimension)=>`"${dimension}分"*${DIMENSION_CONFIG[dimension].overallWeight}`).join("+");
if(scalar(`SELECT COUNT(*) AS n FROM "命盤評分" WHERE ABS("綜合分"-ROUND(${overallExpr},2))>0.011`))throw new Error("overall score mismatch");

// ── 命盤格局：每一個具名格局旗標都必須與 命盤 原始欄位的 SQL 謂詞完全一致 ──
// 命宮兩側一定是兄弟宮與父母宮（十二宮布名相對於命宮固定），所以夾命可直接用宮位名判斷。
const straddle=(starA,starB)=>`((m."${starA}宮位"='兄弟' AND m."${starB}宮位"='父母') OR (m."${starA}宮位"='父母' AND m."${starB}宮位"='兄弟'))`;
const TW="('命宮','財帛','官祿','遷移')";
const BRIGHT=["'旺','廟'"],FALLEN=["'不','陷'"];
const inPalace=(star,palace)=>`m."${star}宮位"='${palace}'`;
const brightIn=(star,palace,list)=>`${inPalace(star,palace)} AND m."${star}星等" IN (${list.join(",")})`;
const samePalace=(a,b)=>`m."${a}宮位"=m."${b}宮位"`;
const palaceBranchColumns={命宮:"命宮地支",兄弟:"兄弟宮地支",夫妻:"夫妻宮地支",子女:"子女宮地支",財帛:"財帛宮地支",疾厄:"疾厄宮地支",遷移:"遷移宮地支",僕役:"交友宮地支",交友:"交友宮地支",官祿:"官祿宮地支",田宅:"田宅宮地支",福德:"福德宮地支",父母:"父母宮地支"};
const inBranch=(star,branch)=>`(CASE m."${star}宮位" ${Object.entries(palaceBranchColumns).map(([palace,column])=>`WHEN '${palace}' THEN m."${column}"`).join(" ")} ELSE '' END)='${branch}'`;
const auxNotInTW=["左輔","右弼","天魁","天鉞","文昌","文曲","祿存"].map((star)=>`m."${star}宮位" NOT IN ${TW}`).join(" AND ");
const huaNotInTW=["祿","權","科"].map((mutagen)=>`m."化${mutagen}宮位" NOT IN ${TW}`).join(" AND ");
const warlordInMing=(gender,bright)=>`${gender} AND (${["七殺","破軍","貪狼","武曲"].map((star)=>bright?brightIn(star,"命宮",BRIGHT):inPalace(star,"命宮")).join(" OR ")})`;
const lianPair=(pair,bright)=>`${samePalace(...pair)} AND ${pair.map((star)=>bright?`m."${star}星等" IN (${BRIGHT})`:`m."${star}星等" IN (${FALLEN})`).join(" AND ")}`;

const formationPredicates={
  "紫府坐垣":`m."命宮" IN ('寅','申') AND ${brightIn("紫微","命宮",BRIGHT)} AND ${brightIn("天府","命宮",BRIGHT)}`,
  "七殺朝斗":`m."命宮" IN ('寅','申') AND ${brightIn("七殺","命宮",BRIGHT)} AND m."命宮主星"='七殺'`,
  "日月並明":`((m."命宮" IN ('辰','戌') AND ${inBranch("太陽","辰")} AND ${inBranch("太陰","戌")} AND m."太陽星等" IN (${BRIGHT}) AND m."太陰星等" IN (${BRIGHT})) OR (m."命宮"='丑' AND ${inBranch("太陽","巳")} AND ${inBranch("太陰","酉")} AND m."太陽星等" IN (${BRIGHT}) AND m."太陰星等" IN (${BRIGHT})))`,
  "月朗天門":`m."命宮"='亥' AND ${brightIn("太陰","命宮",BRIGHT)}`,
  "日照雷門":`m."命宮"='卯' AND ${brightIn("太陽","命宮",BRIGHT)}`,
  "日麗中天":`m."命宮"='午' AND ${brightIn("太陽","命宮",BRIGHT)}`,
  "明珠出海":`m."命宮"='未' AND ${inBranch("太陰","亥")} AND ${inBranch("太陽","卯")} AND m."太陰星等" IN (${BRIGHT}) AND m."太陽星等" IN (${BRIGHT})`,
  "日月夾命":`m."命宮主星"<>'' AND ${straddle("太陽","太陰")} AND m."太陽星等" IN (${BRIGHT}) AND m."太陰星等" IN (${BRIGHT})`,
  "紫府夾權":straddle("紫微","天府"),
  "魁鉞夾貴":straddle("天魁","天鉞"),
  "科權祿三會命":`m."化祿宮位" IN ${TW} AND m."化權宮位" IN ${TW} AND m."化科宮位" IN ${TW}`,
  "權祿相逢":`m."化權宮位" IN ('命宮','財帛','官祿') AND (m."化祿宮位"=m."化權宮位" OR m."祿存宮位"=m."化權宮位")`,
  "祿馬交馳":`(m."化祿宮位"=m."天馬宮位" OR m."祿存宮位"=m."天馬宮位")`,
  "府相朝垣":`(${inPalace("天府","財帛")} AND ${inPalace("天相","官祿")}) OR (${inPalace("天府","官祿")} AND ${inPalace("天相","財帛")})`,
  "火貴格":`${inPalace("火星","命宮")} AND m."貪狼星等" NOT IN (${FALLEN}) AND ${inPalace("貪狼","命宮")}`,
  "鈴貴格":`${inPalace("鈴星","命宮")} AND m."貪狼星等" NOT IN (${FALLEN}) AND ${inPalace("貪狼","命宮")}`,
  "英星入廟":`m."命宮" IN ('子','午') AND ${brightIn("破軍","命宮",BRIGHT)}`,
  "水澄桂萼":`m."命宮"='子' AND ${brightIn("太陰","命宮",BRIGHT)}`,
  "巨日同宮":`${inPalace("巨門","命宮")} AND ${inPalace("太陽","命宮")} AND m."巨門星等" IN (${BRIGHT}) AND m."太陽星等" IN (${BRIGHT})`,
  "巨日會命":`m."巨門宮位" IN ${TW} AND m."太陽宮位" IN ${TW} AND m."巨門宮位"<>m."太陽宮位" AND m."巨門星等" IN (${BRIGHT}) AND m."太陽星等" IN (${BRIGHT})`,
  "命帶祿":`m."化祿宮位"='命宮' OR ${inPalace("祿存","命宮")}`,
  "紫微得輔":`${inPalace("紫微","命宮")} AND (m."左輔宮位" IN ${TW} OR m."右弼宮位" IN ${TW})`,
  "機月同梁":`m."天機宮位" IN ${TW} AND m."天梁宮位" IN ${TW} AND m."太陰宮位" IN ${TW} AND m."天同宮位" IN ${TW}`,
  "紫微七殺官祿":`${inPalace("紫微","官祿")} AND ${inPalace("七殺","官祿")}`,
  "日月夾財":`m."命宮主星"='' AND ${straddle("太陽","太陰")} AND m."太陽星等" IN (${BRIGHT}) AND m."太陰星等" IN (${BRIGHT})`,
  "凶處藏吉":`((m."擎羊宮位" IN ${TW}) OR (m."陀羅宮位" IN ${TW}) OR (m."火星宮位" IN ${TW}) OR (m."鈴星宮位" IN ${TW}) OR (m."地空宮位" IN ${TW}) OR (m."地劫宮位" IN ${TW})) AND ${["擎羊","陀羅","火星","鈴星","地空","地劫"].map((star)=>`NOT (m."${star}宮位" IN ${TW}) OR m."${star}星等" IN ('平','利','得','旺','廟')`).join(" AND ")} AND (${["紫微","天府","太陽","太陰","天同","天梁","天相"].map((star)=>brightIn(star,"命宮",BRIGHT)).join(" OR ")})`,
  "廉殺廟旺":lianPair(["廉貞","七殺"],true),
  "昌曲會命":`m."文昌宮位" IN ${TW} AND m."文曲宮位" IN ${TW}`,
  "魁鉞會命":`m."天魁宮位" IN ${TW} AND m."天鉞宮位" IN ${TW}`,
  "紫輔同夫":`${inPalace("紫微","夫妻")} AND ${inPalace("左輔","夫妻")} AND ${inPalace("右弼","夫妻")}`,
  "天府天馬同夫":`${inPalace("天府","夫妻")} AND ${inPalace("天馬","夫妻")}`,
  "天同巨門同夫":`${inPalace("天同","夫妻")} AND ${inPalace("巨門","夫妻")}`,
  "男命武官坐命":warlordInMing("m.\"性別\"='男'",true),
  "身在財帛":`m."身宮宮位"='財帛'`,
  "身在官祿":`m."身宮宮位"='官祿'`,
  "半空折翅":`m."化忌宮位"='遷移' AND ${auxNotInTW} AND ${["紫微","天府","太陽","太陰","天同","天梁","天相"].map((star)=>`NOT (m."${star}宮位" IN ${TW} AND m."${star}星等" IN ('得','旺','廟'))`).join(" AND ")} AND ${huaNotInTW}`,
  "廉貪陷沖命":`m."命宮" IN ('巳','亥') AND ${inPalace("廉貞","遷移")} AND ${inPalace("貪狼","遷移")} AND m."廉貞星等" IN (${FALLEN}) AND m."貪狼星等" IN (${FALLEN})`,
  "日月反背":`m."太陽星等" IN (${FALLEN}) AND m."太陰星等" IN (${FALLEN})`,
  "日月反背夾命":`${straddle("太陽","太陰")} AND m."太陽星等" IN (${FALLEN}) AND m."太陰星等" IN (${FALLEN})`,
  "羊陀夾命":straddle("擎羊","陀羅"),
  "廉殺落陷":lianPair(["廉貞","七殺"],false),
  "廉破入夫妻福德":`${samePalace("廉貞","破軍")} AND m."廉貞宮位" IN ('夫妻','福德')`,
  "廉貪入夫妻福德":`${samePalace("廉貞","貪狼")} AND m."廉貞宮位" IN ('夫妻','福德')`,
  "廉貪落陷":lianPair(["廉貞","貪狼"],false),
  "武殺落陷":lianPair(["武曲","七殺"],false),
  "吉處藏凶":`((${["左輔","右弼","天魁","天鉞","文昌","文曲","祿存"].map((star)=>`m."${star}宮位" IN ${TW}`).join(")+(")}))>=2 AND ((${["擎羊","陀羅","火星","鈴星","地空","地劫"].map((star)=>`(m."${star}宮位" IN ${TW} AND m."${star}星等" IN (${FALLEN}))`).join(" OR ")}))`,
  "輔弼孤星":`m."紫微宮位"<>'命宮' AND ((m."左輔宮位"='命宮')+(m."右弼宮位"='命宮'))=1`,
  "紫微無輔":`${inPalace("紫微","命宮")} AND m."左輔宮位" NOT IN ${TW} AND m."右弼宮位" NOT IN ${TW}`,
  "殺破狼會命":`${["七殺","破軍","貪狼"].map((star)=>`m."${star}宮位" IN ${TW}`).join(" AND ")}`,
  "七殺臨身":`m."身宮宮位"<>'' AND m."七殺宮位"=m."身宮宮位"`,
  "子女無子":`m."子女宮是否空宮"=1 AND m."化忌宮位"='田宅'`,
  "女命武官坐命":warlordInMing("m.\"性別\"='女'",false),
  "命宮殺星落陷":`((${inPalace("廉貞","命宮")} AND m."廉貞星等" IN (${FALLEN})) OR (${inPalace("貪狼","命宮")} AND m."貪狼星等" IN (${FALLEN})) OR (${inPalace("擎羊","命宮")} AND m."擎羊星等" IN (${FALLEN})) OR (${inPalace("陀羅","命宮")} AND m."陀羅星等" IN (${FALLEN})))`,
  "泛水桃花":`${inPalace("貪狼","命宮")} AND m."命宮" IN ('亥','子')`,
  "女命太陽陷":`m."性別"='女' AND m."太陽宮位" IN ('命宮','夫妻') AND m."太陽星等" IN (${FALLEN})`,
  "福德武曲七殺":`m."性別"='女' AND ${inPalace("武曲","福德")} AND ${inPalace("七殺","福德")}`,
  "太陽陷父母":`${inPalace("太陽","父母")} AND m."太陽星等" IN (${FALLEN})`,
  "太陰陷父母":`${inPalace("太陰","父母")} AND m."太陰星等" IN (${FALLEN})`,
};

const formationCount=scalar('SELECT COUNT(*) AS n FROM "命盤格局"');
if(formationCount!==metadata.rowCount)throw new Error(`formation row mismatch: ${formationCount}`);
const formationChecks={};
for(const item of FORMATION_RULES){
  if(!(item.name in formationPredicates))throw new Error(`missing independent SQL predicate for formation: ${item.name}`);
  const mismatch=scalar(`SELECT COUNT(*) AS n FROM "命盤" m JOIN "命盤格局" g ON g."KEY"=m."KEY" WHERE g."${item.name}"<>CASE WHEN (${formationPredicates[item.name]}) THEN 1 ELSE 0 END`);
  if(mismatch)throw new Error(`formation flag mismatch for ${item.name}: ${mismatch} rows`);
  formationChecks[item.name]=scalar(`SELECT COUNT(*) AS n FROM "命盤格局" WHERE "${item.name}"=1`);
}
if(scalar(`SELECT COUNT(*) AS n FROM "命盤格局" WHERE "成格數"<>${FORMATION_RULES.filter((item)=>item.polarity==="吉").map((item)=>`"${item.name}"`).join("+")} OR "凶格數"<>${FORMATION_RULES.filter((item)=>item.polarity==="凶").map((item)=>`"${item.name}"`).join("+")}`))throw new Error("成格數/凶格數 do not match formation flags");

const familyCount=scalar('SELECT COUNT(*) AS n FROM "命盤家庭評分"');
if(familyCount!==metadata.rowCount)throw new Error(`family rating row mismatch: ${familyCount}`);
if(scalar('SELECT COUNT(*) AS n FROM "family_scores"')!==metadata.rowCount)throw new Error("family_scores view row mismatch");
const timingAgeCount=FAMILY_CONFIG.marriageAgeRange[1]-FAMILY_CONFIG.marriageAgeRange[0]+1;
const timingCount=scalar('SELECT COUNT(*) AS n FROM "命盤婚育時機"');
if(timingCount!==metadata.rowCount*timingAgeCount)throw new Error(`timing row mismatch: ${timingCount}`);
if(scalar(`SELECT COUNT(*) AS n FROM "命盤婚育時機" t JOIN "命盤" m ON m."KEY"=t."KEY" WHERE t."年齡"<${FAMILY_CONFIG.marriageAgeRange[0]} OR t."年齡">${FAMILY_CONFIG.marriageAgeRange[1]} OR t."年份"<m."年"+t."年齡"-2 OR t."年份">m."年"+t."年齡"`))throw new Error("timing nominal-age/calendar-year resolution mismatch");
if(scalar('SELECT COUNT(*) AS n FROM "命盤婚育時機" WHERE "年齡"<CAST(SUBSTR("大限範圍",1,INSTR("大限範圍",\'-\')-1) AS INTEGER) OR "年齡">CAST(SUBSTR("大限範圍",INSTR("大限範圍",\'-\')+1) AS INTEGER)'))throw new Error("age outside generated decadal range");
if(scalar('SELECT COUNT(*) AS n FROM "命盤家庭評分" WHERE "家庭品質全域百分位" IS NOT NULL'))throw new Error("global percentile must remain unavailable for a single-year artifact");
for(const name of FAMILY_PERCENTILE_COMPONENTS)if(scalar(`SELECT COUNT(*) AS n FROM "命盤家庭評分" WHERE "${name}百分位"<0 OR "${name}百分位">100`))throw new Error(`${name} percentile out of range`);
const positiveExpr='"父母財富分"*2+"父母品質分"*2.5+"自身財富分"*2.5+"外貌分"+"戀愛分"+"婚姻分"*2+"子女分"*2+"家庭時機分"*2';
const familyRawExpr=`ROUND((${positiveExpr}-"父母負向分"*${FAMILY_CONFIG.parentsNegativePenaltyWeight})/15,2)`;
if(scalar(`SELECT COUNT(*) AS n FROM "命盤家庭評分" WHERE ABS("家庭品質原始分"-(${familyRawExpr}))>0.011 OR ABS("家庭品質分"-ROUND(MAX(0,MIN(100,${familyRawExpr})),2))>0.011`))throw new Error("family weighted score mismatch");
const harmonicExpr='15.0/(2.0/MAX(1,"父母財富分")+2.5/MAX(1,"父母品質分")+2.5/MAX(1,"自身財富分")+1.0/MAX(1,"外貌分")+1.0/MAX(1,"戀愛分")+2.0/MAX(1,"婚姻分")+2.0/MAX(1,"子女分")+2.0/MAX(1,"家庭時機分"))';
if(scalar(`SELECT COUNT(*) AS n FROM "命盤家庭評分" WHERE ABS("家庭平衡分"-ROUND(MAX(0,MIN(100,${harmonicExpr}-"父母負向分"*${FAMILY_CONFIG.parentsNegativePenaltyWeight}/15.0)),2))>0.011`))throw new Error("family balance score mismatch");
if(scalar(`SELECT COUNT(*) AS n FROM "命盤家庭評分" WHERE ABS("自身財富分"-ROUND("穩定財富分"*${FAMILY_CONFIG.selfWealthWeights.stable}+"爆發財富分"*${FAMILY_CONFIG.selfWealthWeights.explosive},2))>0.011`))throw new Error("self wealth split mismatch");
if(scalar('SELECT COUNT(*) AS n FROM "命盤家庭評分" f WHERE NOT EXISTS (SELECT 1 FROM "命盤婚育時機" t WHERE t."KEY"=f."KEY" AND t."年齡"=f."最佳婚姻年齡" AND t."年份"=f."最佳婚姻年份" AND t."婚姻觸發分"=f."婚姻時機分")'))throw new Error("best marriage timing metadata mismatch");
if(scalar('SELECT COUNT(*) AS n FROM "命盤家庭評分" f WHERE f."父母負向分">=50 AND (SELECT COUNT(DISTINCT d."規則ID") FROM "命盤家庭評分明細" d WHERE d."KEY"=f."KEY" AND d."組件"=\'父母負向\')<2'))throw new Error("severe parent penalty triggered by fewer than two rules");

const familySample=(order)=>rows(`SELECT m."KEY",m."公曆日期",m."時辰",m."性別",m."命宮主星",m."父母主星",m."子女主星",m."紫微星等",m."天府星等",m."太陰星等",f."家庭品質百分位",f."家庭平衡百分位",f."父母品質百分位",f."外貌百分位",f."婚姻百分位",f."子女百分位",f."父母負向分",f."最佳婚姻年齡",f."最佳婚姻年份",t."大限範圍",t."大限本命宮位",t."小限本命宮位",f."大限紅鸞",f."大限天喜",f."小限紅鸞",f."小限天喜",f."流年紅鸞",f."流年天喜",(SELECT GROUP_CONCAT(d."說明",'；') FROM "命盤家庭評分明細" d WHERE d."KEY"=m."KEY" AND d."組件" IN ('父母','父母財富','父母負向')) AS "父母宮原因",f."婚姻主要原因",f."子女主要原因" FROM "命盤" m JOIN "命盤家庭評分" f ON f."KEY"=m."KEY" LEFT JOIN "命盤婚育時機" t ON t."KEY"=f."KEY" AND t."年齡"=f."最佳婚姻年齡" ORDER BY ${order} LIMIT 10`);
const regressionExtremes={
  familyTop:familySample('f."家庭品質百分位" DESC'),familyBottom:familySample('f."家庭品質百分位" ASC'),
  balanceTop:familySample('f."家庭平衡百分位" DESC'),balanceBottom:familySample('f."家庭平衡百分位" ASC'),
  parentsTop:familySample('f."父母品質百分位" DESC'),parentsBottom:familySample('f."父母品質百分位" ASC'),
  appearanceTop:familySample('f."外貌百分位" DESC'),appearanceBottom:familySample('f."外貌百分位" ASC'),
  marriageTop:familySample('f."婚姻百分位" DESC'),marriageBottom:familySample('f."婚姻百分位" ASC'),
  childrenTop:familySample('f."子女百分位" DESC'),childrenBottom:familySample('f."子女百分位" ASC'),
};
const parentPenaltyComparisons={
  strongComponentsWeakParents:rows(`SELECT "KEY","家庭品質分","父母負向分","父母品質分","自身財富分","外貌分","婚姻分","子女分" FROM "命盤家庭評分" WHERE "父母負向分">0 ORDER BY ("自身財富分"+"外貌分"+"婚姻分"+"子女分") DESC,"父母負向分" DESC LIMIT 3`),
  midComponentsStrongParents:rows(`SELECT "KEY","家庭品質分","父母負向分","父母品質分","自身財富分","外貌分","婚姻分","子女分" FROM "命盤家庭評分" WHERE "父母品質百分位">=80 ORDER BY ABS("自身財富百分位"-60)+ABS("外貌百分位"-60) LIMIT 3`),
  allRoundTop:rows(`SELECT "KEY","家庭品質分","家庭平衡分","父母負向分","父母品質分","自身財富分","外貌分","婚姻分","子女分" FROM "命盤家庭評分" ORDER BY "家庭平衡百分位" DESC LIMIT 3`),
};

const legacyWealthRules=scalar('SELECT COUNT(*) AS n FROM "評分規則" WHERE "規則ID" IN (\'F-HUTAN-CAI\',\'F-LINGTAN-CAI\',\'FEW-FIRE-GREED\',\'FEW-BELL-GREED\')');
if(legacyWealthRules)throw new Error("legacy 火貪／鈴貪 wealth rules remain in Ni scoring");

const regression=[];
for(const rule of ["W-WU","W-TAN","C-SUN","H-HUO","M-ZI"]){
  const pair=rows(`SELECT lo."KEY" AS lowKey,lo."星曜" AS star,lo."宮位" AS palace,lo."亮度" AS lowBrightness,lo."亮度序" AS lowOrder,lo."實際貢獻" AS lowContribution,hi."KEY" AS highKey,hi."亮度" AS highBrightness,hi."亮度序" AS highOrder,hi."實際貢獻" AS highContribution FROM "命盤評分明細" lo JOIN "命盤評分明細" hi ON hi."規則ID"=lo."規則ID" AND hi."星曜"=lo."星曜" AND hi."宮位"=lo."宮位" AND hi."亮度序">lo."亮度序" WHERE lo."規則ID"='${rule}' AND hi."實際貢獻"<>lo."實際貢獻" ORDER BY hi."亮度序"-lo."亮度序" DESC LIMIT 1`)[0];
  if(pair)regression.push({rule,...pair});
}
if(regression.length<3)throw new Error(`expected >=3 brightness regression pairs, got ${regression.length}`);

const sampleKey=`${metadata.year}0810-子時-女`;
const sample=rows(`SELECT m."KEY",m."命盤連結",m."命宮",m."身宮",m."空宮數",r."綜合分",r."綜合排名",r."格局分",g."成格數",g."凶格數" FROM "命盤" m JOIN "命盤評分" r ON r."KEY"=m."KEY" JOIN "命盤格局" g ON g."KEY"=m."KEY" WHERE m."KEY"='${sampleKey}'`)[0];
if(!sample)throw new Error("required sample key not found");
if(sample.命盤連結!==`https://metisziwei.com/chart?y=${metadata.year}&m=8&d=10&h=0&mi=0&g=f`)throw new Error(`unexpected sample chart link: ${sample.命盤連結}`);
console.log(JSON.stringify({ok:true,...count,columns:schemaNames.size,tables:objects.size,missingRaw,invalidLinks,missingDaXian,brightnessRows:brightnessCount,ratingRows:scoreCount,familyRows:familyCount,timingRows:timingCount,parentsNegativePenaltyWeight:FAMILY_CONFIG.parentsNegativePenaltyWeight,legacyWealthRules,formationChecks,brightnessRegression:regression,parentPenaltyComparisons,regressionExtremes,sample},null,2));
db.close();
