import * as duckdb from './vendor/duckdb/duckdb-bundle.js';
import { translateTop } from './src/query-sql.mjs';
let db, connection;
const status = (message) => self.postMessage({type:'status',message});
function scalar(value,type) {
  // Arrow's 128-bit integers/decimals are typed arrays with a custom prototype.
  // Convert before postMessage strips that prototype; retain large values exactly.
  if(value?.[Symbol.for('isArrowBigNum')]) {
    const raw=value.toString(),scale=type.scale??0;
    const negative=raw.startsWith('-'),digits=raw.replace(/^-/, '').padStart(scale+1,'0');
    const decimal=(negative?'-':'')+(scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits);
    return Number.isSafeInteger(Number(raw))?Number(decimal):decimal;
  }
  if(typeof value==='bigint')return value<=BigInt(Number.MAX_SAFE_INTEGER)&&value>=BigInt(Number.MIN_SAFE_INTEGER)?Number(value):value.toString();
  return value;
}
async function init() {
  status('讀取資料規格…');
  const response = await fetch('data/metadata.json', {cache:'no-cache'});
  if (!response.ok) throw new Error('無法讀取資料規格');
  const metadata = await response.json();
  if (!metadata.duckdb) throw new Error('資料庫尚未完成更新，請稍後重新整理');
  status('啟動查詢引擎…');
  db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(new URL('vendor/duckdb/duckdb-browser-eh.worker.js', import.meta.url)));
  await db.instantiate(new URL('vendor/duckdb/duckdb-eh.wasm', import.meta.url).href);
  status(`下載資料庫 · ${(metadata.compressedBytes/1048576).toFixed(1)} MB`);
  const data = await fetch(`${metadata.duckdb}?h=${metadata.hash}`);
  if (!data.ok) throw new Error(`資料下載失敗（${data.status}）`);
  const compressed = await data.arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', compressed)), x=>x.toString(16).padStart(2,'0')).join('');
  if (digest !== metadata.hash) throw new Error('資料庫完整性驗證失敗，請重新整理');
  status('開啟命盤資料庫…');
  const bytes = new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  await db.registerFileBuffer('bazi.duckdb', bytes);
  await db.open({path:'bazi.duckdb', accessMode:duckdb.DuckDBAccessMode.READ_ONLY});
  connection = await db.connect();
  status(`${metadata.rowCount.toLocaleString()} 筆命盤已就緒`);
  return metadata;
}
async function query(sql, params=[]) {
  if (!connection) throw new Error('資料庫尚未就緒');
  const cleaned = sql.replace(/--.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'').trim();
  if (!/^(select|with|explain|describe|show)\b/i.test(cleaned)) throw new Error('僅支援唯讀查詢');
  const start = performance.now();
  let result, statement;
  try {
    if (params.length) { statement = await connection.prepare(translateTop(sql)); result = await statement.query(...params); }
    else result = await connection.query(translateTop(sql));
    const columns = result.schema.fields.map(f=>f.name);
    const rows = result.toArray().map(row=>Object.fromEntries(result.schema.fields.map(field=>[field.name,scalar(row[field.name],field.type)])));
    return {columns,rows,elapsedMs:Math.round(performance.now()-start)};
  } finally { if (statement) await statement.close(); }
}
let queue = Promise.resolve();
self.addEventListener('message', event=>{
  const {id,type,payload={}}=event.data;
  queue = queue.then(async()=>{
    try {
      const result = type==='init' ? await init() : await query(payload.sql,payload.params);
      self.postMessage({id,ok:true,result});
    } catch(error) { self.postMessage({id,ok:false,error:error.message}); }
  });
});
