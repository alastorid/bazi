import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import initSqlJs from "sql.js";
import { fileURLToPath } from "node:url";
import { BRIGHTNESS_LEVELS, DIMENSIONS, DIMENSION_CONFIG } from "../src/scoring-model.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const metadata=JSON.parse(fs.readFileSync(path.join(root,"data","metadata.json"),"utf8"));
const SQL=await initSqlJs({locateFile:(file)=>path.join(root,"node_modules","sql.js","dist",file)});
const db=new SQL.Database(zlib.gunzipSync(fs.readFileSync(path.join(root,metadata.sqlite))));
const rows=(sql)=>{const result=db.exec(sql)[0];return result?result.values.map((values)=>Object.fromEntries(result.columns.map((column,i)=>[column,values[i]]))):[]};
const scalar=(sql)=>rows(sql)[0]?.n??0;

const count=rows('SELECT COUNT(*) AS n,COUNT(DISTINCT "KEY") AS keys FROM "命盤"')[0];
if(count.n!==metadata.rowCount||count.keys!==metadata.rowCount)throw new Error(`row/key mismatch: ${JSON.stringify(count)}`);
const objects=new Set(rows("SELECT name FROM sqlite_master WHERE type IN ('table','view')").map((item)=>item.name));
for(const name of ["命盤","星曜亮度","亮度等級","命盤評分","命盤評分明細","評分規則","評分維度","排名門檻"])if(!objects.has(name))throw new Error(`missing database object: ${name}`);

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

const badFire=scalar('SELECT COUNT(*) AS n FROM "命盤評分明細" d JOIN "命盤" m ON m."KEY"=d."KEY" WHERE d."規則ID"=\'SY-FIRE-GREED\' AND (m."貪狼宮位"<>\'財帛\' OR m."火星宮位"<>\'財帛\' OR m."財帛宮是否空宮"<>0 OR m."真財帛宮來源"<>\'本宮\')');
const badBell=scalar('SELECT COUNT(*) AS n FROM "命盤評分明細" d JOIN "命盤" m ON m."KEY"=d."KEY" WHERE d."規則ID"=\'SY-BELL-GREED\' AND (m."貪狼宮位"<>\'財帛\' OR m."鈴星宮位"<>\'財帛\' OR m."財帛宮是否空宮"<>0 OR m."真財帛宮來源"<>\'本宮\')');
if(badFire||badBell)throw new Error(`borrowed palace leaked into strict formations: fire=${badFire}, bell=${badBell}`);

const regression=[];
for(const rule of ["W-WU","W-TAN","A-YIN","C-SHA","H-HUO"]){
  const pair=rows(`SELECT lo."KEY" AS lowKey,lo."星曜" AS star,lo."宮位" AS palace,lo."亮度" AS lowBrightness,lo."亮度序" AS lowOrder,lo."實際貢獻" AS lowContribution,hi."KEY" AS highKey,hi."亮度" AS highBrightness,hi."亮度序" AS highOrder,hi."實際貢獻" AS highContribution FROM "命盤評分明細" lo JOIN "命盤評分明細" hi ON hi."規則ID"=lo."規則ID" AND hi."星曜"=lo."星曜" AND hi."宮位"=lo."宮位" AND hi."亮度序">lo."亮度序" WHERE lo."規則ID"='${rule}' AND hi."實際貢獻"<>lo."實際貢獻" ORDER BY hi."亮度序"-lo."亮度序" DESC LIMIT 1`)[0];
  if(pair)regression.push({rule,...pair});
}
if(regression.length<3)throw new Error(`expected >=3 brightness regression pairs, got ${regression.length}`);

const sampleKey=`${metadata.year}0810-子時-女`;
const sample=rows(`SELECT m."KEY",m."命盤連結",m."命宮",m."身宮",m."空宮數",r."綜合分",r."綜合排名" FROM "命盤" m JOIN "命盤評分" r ON r."KEY"=m."KEY" WHERE m."KEY"='${sampleKey}'`)[0];
if(!sample)throw new Error("required sample key not found");
if(sample.命盤連結!==`https://metisziwei.com/chart?y=${metadata.year}&m=8&d=10&h=0&mi=0&g=f`)throw new Error(`unexpected sample chart link: ${sample.命盤連結}`);
console.log(JSON.stringify({ok:true,...count,columns:schemaNames.size,tables:objects.size,missingRaw,invalidLinks,missingDaXian,brightnessRows:brightnessCount,ratingRows:scoreCount,strictFormationErrors:{fire:badFire,bell:badBell},brightnessRegression:regression,sample},null,2));
db.close();
