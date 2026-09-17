import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const sourceFiles=['scripts/generate-data.mjs',...fs.readdirSync(path.join(root,'src'),{recursive:true})
  .filter(file=>file.endsWith('.mjs')&&file!=='query-sql.mjs').map(file=>'src/'+file)].sort();
function hashFiles(files,extra) {
  const hash=crypto.createHash('sha256');
  for(const file of files)hash.update(file+'\0').update(fs.readFileSync(path.join(root,file))).update('\0');
  return hash.update(JSON.stringify(extra)).digest('hex');
}
export const dataFingerprint=hashFiles(sourceFiles,['iztro','lunar-javascript','sql.js'].map(name=>[name,pkg.dependencies[name]]));
export const nativeFingerprint=hashFiles(['scripts/build-duckdb.py','scripts/build-duckdb.mjs','scripts/data-fingerprint.mjs'],[dataFingerprint,pkg.dependencies['@duckdb/duckdb-wasm'],'duckdb=1.3.2','pyarrow=19.0.1']);
