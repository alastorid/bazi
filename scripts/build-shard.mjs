import {spawnSync} from 'node:child_process';
const year=process.argv[2];
if(!/^\d{4}$/.test(year))throw new Error('A single year is required');
for(const [file,args] of [['verify-comparator.mjs',[]],['verify-scoring-model.mjs',[]],['generate-data.mjs',[year]],['verify-data.mjs',[]],['rank-bazi.mjs',[]],['build-duckdb.mjs',['--shard']]]){
  const result=spawnSync(process.execPath,['scripts/'+file,...args],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
}
