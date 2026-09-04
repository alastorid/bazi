/* global initSqlJs */
let db;
let metadata;

function sendStatus(phase, message, progress) {
  self.postMessage({ type: "status", phase, message, progress });
}

async function gunzip(bytes) {
  if (!("DecompressionStream" in self)) throw new Error("此瀏覽器不支援 DecompressionStream");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function init() {
  sendStatus("metadata", "讀取資料規格…", 0.08);
  const metaResponse = await fetch("data/metadata.json", { cache: "no-cache" });
  if (!metaResponse.ok) throw new Error(`metadata HTTP ${metaResponse.status}`);
  metadata = await metaResponse.json();
  sendStatus("wasm", "載入 SQLite WASM…", 0.18);
  importScripts("vendor/sqljs/sql-wasm.js");
  const SQL = await initSqlJs({ locateFile: (file) => `vendor/sqljs/${file}` });
  sendStatus("download", `下載 ${(metadata.compressedBytes / 1048576).toFixed(1)} MB 資料庫…`, 0.28);
  const response = await fetch(`${metadata.sqlite}?h=${metadata.hash}`, { cache: "force-cache" });
  if (!response.ok) throw new Error(`database HTTP ${response.status}`);
  const compressed = new Uint8Array(await response.arrayBuffer());
  sendStatus("decompress", "解壓縮命盤資料…", 0.68);
  const bytes = await gunzip(compressed);
  db = new SQL.Database(bytes);
  sendStatus("ready", `${metadata.rowCount.toLocaleString()} 筆命盤已就緒`, 1);
  return metadata;
}

function isReadOnly(sql) {
  const cleaned = String(sql).replace(/--.*$/gm, "").trim();
  return /^(select|with|explain|pragma)\b/i.test(cleaned) && !/\b(insert|update|delete|drop|alter|create|replace|attach|detach|vacuum)\b/i.test(cleaned);
}

function query(sql, params = [], maxRows = 1000) {
  if (!db) throw new Error("database not ready");
  if (!isReadOnly(sql)) throw new Error("Web SQL Terminal 僅允許 SELECT / WITH / EXPLAIN / PRAGMA 唯讀查詢");
  const started = performance.now();
  const statement = db.prepare(sql);
  statement.bind(params);
  const columns = statement.getColumnNames();
  const rows = [];
  let truncated = false;
  while (statement.step()) {
    if (rows.length >= maxRows) { truncated = true; break; }
    rows.push(statement.getAsObject());
  }
  statement.free();
  return { columns, rows, truncated, elapsedMs: Math.round(performance.now() - started) };
}

self.addEventListener("message", async (event) => {
  const { id, type, payload = {} } = event.data || {};
  try {
    const result = type === "init" ? await init() : type === "query" ? query(payload.sql, payload.params, payload.maxRows) : null;
    if (result === null) throw new Error(`unknown worker action: ${type}`);
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error?.message || String(error) });
  }
});
