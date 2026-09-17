import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import initSqlJs from 'sql.js';
import zlib from 'node:zlib';
globalThis.window = {};
await import('../queryLibrary.js');
await import('../visualization.js');
const meta = JSON.parse(fs.readFileSync('data/metadata.json', 'utf8'));
const SQL = await initSqlJs();
const staging = new SQL.Database(zlib.gunzipSync(fs.readFileSync(meta.sqlite)));
const rows = staging.exec(`SELECT "名稱","吉凶" FROM "格局規則" WHERE "可計算"=1 AND "完整解釋"=1 AND "吉凶" IN ('吉','凶') AND "結構稀有度" BETWEEN 1 AND 5`)[0];
const rules = rows.values.map(v => Object.fromEntries(rows.columns.map((c,i)=>[c,v[i]])));
const { translateTop } = await import('../src/query-sql.mjs');
const queries = window.BAZI_QUERY_LIBRARY.definitions.map(q=>({name:q.key,sql:translateTop(q.sql)}));
for (const gender of ['女','男','女＋男']) {
  window.BAZI_VISUALIZATION.buildOverviewQueries(meta,gender,rules,'duckdb').forEach((sql,i)=>queries.push({name:`時間軸-${gender}-${i}`,sql}));
}
fs.writeFileSync('data/duckdb-checks.json', JSON.stringify(queries));
staging.close();
const result = spawnSync('python3', ['scripts/build-duckdb.py','data/duckdb-checks.json'], {stdio:'inherit'});
if (result.status !== 0) process.exit(result.status ?? 1);
