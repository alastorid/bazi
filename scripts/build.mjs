import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const range=process.argv[2];
if(!/^\d{4}(?:-\d{4})?$/.test(range??''))throw new Error('Usage: npm run build -- 2026-2035');
const [start,end=start]=range.split('-').map(Number);
if(start>end||start<1900||end>2200)throw new Error('Invalid range');
const folder='shards/'+range;
for(let year=start;year<=end;year++){
  const step=spawnSync(process.execPath,['scripts/build-shard.mjs',String(year)],{stdio:'inherit'});
  if(step.status!==0)process.exit(step.status??1);
  const meta=JSON.parse(fs.readFileSync('data/metadata.json','utf8'));
  fs.mkdirSync(folder+'/'+year,{recursive:true});
  fs.copyFileSync(meta.duckdb,folder+'/'+year+'/'+meta.duckdb.split('/').at(-1));
  fs.copyFileSync('data/metadata.json',folder+'/'+year+'/metadata.json');
}
const result=spawnSync(process.execPath,['scripts/finish-build.mjs',range,folder],{stdio:'inherit'});
process.exit(result.status??1);
