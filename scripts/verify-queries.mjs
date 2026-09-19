import {spawnSync} from 'node:child_process';
import {translateTop} from '../src/query-sql.mjs';
globalThis.window={};
await import('../queryLibrary.js');
const library=window.BAZI_QUERY_LIBRARY;
const keys=library.definitions.map(q=>q.key);
if(new Set(keys).size!==keys.length)throw new Error('Duplicate sample query');
const grouped=Object.values(library.groups).flat();
if(grouped.length!==keys.length||new Set(grouped).size!==keys.length||grouped.some(k=>!keys.includes(k)))throw new Error('Sample query groups mismatch');
if(library.definitions.some(q=>/命盤評分|家庭評分/.test(q.sql)))throw new Error('Legacy rating queries must not return');
const result=spawnSync('python3',['scripts/verify-native.py','queries'],{
  input:JSON.stringify(library.definitions.map(q=>({name:q.key,sql:translateTop(q.sql)}))),encoding:'utf8',stdio:['pipe','inherit','inherit']});
process.exit(result.status??1);
