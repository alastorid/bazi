/**
 * Persist the comparator's complete inputs, palace contributions and annual ranks.
 * Uses raw wide columns: 星曜亮度 alone omits stars without a dignity value.
 * Production execution belongs to the Actions runner.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import initSqlJs from 'sql.js';
import { chartProfile, mergeSortResults, assignRanks, PALACE_WEIGHT } from '../src/bazi-comparator.mjs';
const meta=JSON.parse(fs.readFileSync('data/metadata.json','utf8'));
const SQL=await initSqlJs({locateFile:file=>'node_modules/sql.js/dist/'+file});
const db=new SQL.Database(zlib.gunzipSync(fs.readFileSync(meta.sqlite)));
const schemas={
  命盤排名:[['KEY','TEXT PRIMARY KEY'],['總序','INTEGER'],['排名序','INTEGER'],['百分位','REAL'],['PR','REAL'],['加權分','REAL']],
  命盤比較宮位:[['KEY','TEXT'],['宮位','TEXT'],['星曜作用','REAL'],['主星補償','REAL'],['原始作用','REAL'],['宮位權重','REAL'],['加權作用','REAL'],['主星數','INTEGER']],
  命盤比較星曜:[['KEY','TEXT'],['宮位','TEXT'],['星曜','TEXT'],['星曜類型','TEXT'],['亮度','TEXT'],['四化','TEXT'],['星性質','TEXT'],['單星作用','REAL'],['原因','TEXT']],
};
for(const [name,fields] of Object.entries(schemas)){
  db.run('DROP TABLE IF EXISTS "'+name+'"');
  db.run('CREATE TABLE "'+name+'" ('+fields.map(([n,t])=>'"'+n+'" '+t).join(',')+')');
  meta.tables[name]=fields.map(([name,type])=>({name,type:type.split(' ')[0]}));
}
db.run('BEGIN');
const pInsert=db.prepare('INSERT INTO "命盤比較宮位" VALUES (?,?,?,?,?,?,?,?)');
const sInsert=db.prepare('INSERT INTO "命盤比較星曜" VALUES (?,?,?,?,?,?,?,?,?)');
const scan=db.prepare('SELECT * FROM "命盤" ORDER BY "KEY"');
const results=[];
while(scan.step()){
  const row=scan.getAsObject();
  const palaces=meta.palaces.map(name=>({name,stars:[]}));
  for(const name of meta.stars){
    const palace=palaces.find(p=>p.name===row[name+'宮位']);
    if(!palace)continue;
    const siHua=['祿','權','科','忌'].find(h=>row['化'+h+'星']===name)??'';
    palace.stars.push({name,brightness:row[name+'星等']??'',siHua,type:String(row[palace.name+'主星']).split('、').includes(name)?'major':'minor'});
  }
  const profile=chartProfile({palaces});
  for(const p of profile){
    pInsert.run([row.KEY,p.name,p.starTotal,p.presence,p.raw,p.weight,p.weighted,p.majorCount]);
    for(const s of p.stars)sInsert.run([row.KEY,p.name,s.name,s.type,s.brightness,s.siHua,s.nature,s.strength,s.reason]);
  }
  results.push({key:row.KEY,weightedScore:Math.round(profile.reduce((n,p)=>n+p.weighted,0)*1000000)/1000000});
}
scan.free();pInsert.free();sInsert.free();
const reference=results[Math.floor(results.length/2)];
const referencePotential=reference.weightedScore;
const ranked=assignRanks(mergeSortResults(results));
const insert=db.prepare('INSERT INTO "命盤排名" VALUES (?,?,?,?,?,?)');
for(const r of ranked)insert.run([r.key,r.strictIndex,r.rankIndex,r.rankPercentile,r.prRatio,Math.round((r.weightedScore-referencePotential)*1000000)/1000000]);
insert.free();
for(const name of ['命盤比較宮位','命盤比較星曜'])db.run('CREATE INDEX "idx_'+name+'_KEY" ON "'+name+'"("KEY")');
db.run('CREATE UNIQUE INDEX "idx_排名_總序" ON "命盤排名"("總序")');
db.run('COMMIT');
meta.ranking={refereeKey:reference.key,method:'逐星、逐宮作用差；可分解勢值的精確總序。並列共享名次，KEY 僅決定顯示總序。',rankedCount:ranked.length,palaceWeights:PALACE_WEIGHT,prDefinition:'百分位=100×(1−(競賽名次−1)/(樣本數−1))；單筆=100；PR=百分位/100。高者居前。',scope:'當前資料範圍',referenceIndependent:true,weightsAreModelParameters:true};
const raw=Buffer.from(db.export());db.close();
const gzip=zlib.gzipSync(raw,{level:9});
fs.writeFileSync(meta.sqlite.replace(/\.gz$/,''),raw);fs.writeFileSync(meta.sqlite,gzip);
meta.hash=crypto.createHash('sha256').update(gzip).digest('hex');meta.compressedBytes=gzip.length;meta.uncompressedBytes=raw.length;
fs.writeFileSync('data/metadata.json',JSON.stringify(meta,null,2)+'\n');
console.log('Persisted complete comparison profiles and ranks:',ranked.length);
