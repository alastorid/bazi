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

function translateTop(sql) {
  const trimmed = String(sql).trim().replace(/;+\s*$/, "");
  const match = trimmed.match(/^(\s*SELECT\s+)(DISTINCT\s+)?TOP\s+(\d+)\s+/i);
  if (!match) return trimmed;
  const limit = Number(match[3]);
  const select = `${match[1]}${match[2] || ""}`;
  return `${select}${trimmed.slice(match[0].length)} LIMIT ${limit}`;
}

function query(sql, params = []) {
  if (!db) throw new Error("database not ready");
  if (!isReadOnly(sql)) throw new Error("Web SQL Terminal 僅允許 SELECT / WITH / EXPLAIN / PRAGMA 唯讀查詢");
  const started = performance.now();
  const statement = db.prepare(translateTop(sql));
  statement.bind(params);
  const columns = statement.getColumnNames();
  const rows = [];
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }
  statement.free();
  return { columns, rows, elapsedMs: Math.round(performance.now() - started) };
}

self.addEventListener("message", async (event) => {
  const { id, type, payload = {} } = event.data || {};
  try {
    const result = type === "init" ? await init() : type === "query" ? query(payload.sql, payload.params) : null;
    if (result === null) throw new Error(`unknown worker action: ${type}`);
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error?.message || String(error) });
  }
});
