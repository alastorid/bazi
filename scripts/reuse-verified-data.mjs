import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dataFingerprint, nativeFingerprint } from './data-fingerprint.mjs';
const range=process.argv[2];
if(!/^\d{4}(?:-\d{4})?$/.test(range))throw new Error('Invalid year range');
const base='https://alastorid.github.io/bazi/';
const response=await fetch(`${base}data/metadata.json?build=${Date.now()}`,{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error('No deployed metadata available');
const metadata=await response.json();
if(String(metadata.year)!==range)throw new Error('Different range; full generation required');
// The migration snapshot was produced and verified by Actions run 34675528189.
// Both its compressed bytes and every algorithm input must match before reuse.
const migration=metadata.hash==='5ed17a10da7e3ecb88b0f0645513f75b3bdce58b08cfbcfa3e9821054e429851'
  && dataFingerprint==='032b812b0cdbcc60c059581dd06351e88a892ae4eebbe8bdfcc46602325523f5'
  && metadata.sqlite===`data/ziwei-${range}.sqlite.gz`;
const native=metadata.engine==='duckdb'&&metadata.dataFingerprint===nativeFingerprint
  && metadata.duckdb===`data/ziwei-${range}.duckdb.gz`;
if(!migration&&!native)throw new Error('Data source or converter changed; full generation required');
const name=native?metadata.duckdb:metadata.sqlite;
const download=await fetch(`${base}${name}?hash=${metadata.hash}`,{signal:AbortSignal.timeout(120000)});
if(!download.ok)throw new Error('Cannot download verified dataset');
const bytes=Buffer.from(await download.arrayBuffer());
if(crypto.createHash('sha256').update(bytes).digest('hex')!==metadata.hash)throw new Error('Dataset hash mismatch');
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(path.join('data',path.basename(name)),bytes);
fs.writeFileSync('data/metadata.json',JSON.stringify(metadata,null,2)+'\n');
const steps=migration?['verify-scoring-model.mjs','verify-data.mjs','verify-queries.mjs','build-duckdb.mjs']:[];
for(const script of [...steps,'prepare-pages.mjs']) {
  const result=spawnSync(process.execPath,['scripts/'+script,...(script==='prepare-pages.mjs'?[range]:[])],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
}
console.log(migration?'Verified runner-produced charts migrated to DuckDB.':'Reused matching, hash-verified runner-produced DuckDB.');
