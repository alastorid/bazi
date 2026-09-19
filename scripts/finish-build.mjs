import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {nativeFingerprint} from './data-fingerprint.mjs';
const range=process.argv[2];
const merge=spawnSync('python3',['scripts/merge-shards.py',range,...(process.argv[3]?[process.argv[3]]:[])],{stdio:'inherit'});
if(merge.status!==0)process.exit(merge.status??1);
const meta=JSON.parse(fs.readFileSync('data/metadata.json','utf8'));
meta.dataFingerprint=nativeFingerprint;
fs.writeFileSync('data/metadata.json',JSON.stringify(meta,null,2)+'\n');
for(const script of ['verify-ranking.mjs','verify-queries.mjs']){
  const check=spawnSync(process.execPath,['scripts/'+script],{stdio:'inherit',env:{...process.env,MIN_SAMPLE:process.env.MIN_SAMPLE??String(Math.min(10000,meta.rowCount))}});
  if(check.status!==0)process.exit(check.status??1);
}
const result=spawnSync(process.execPath,['scripts/prepare-pages.mjs',range],{stdio:'inherit'});
process.exit(result.status??1);
