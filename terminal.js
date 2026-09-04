const state = {
  metadata: null,
  result: { columns: [], rows: [] },
  suggestions: [],
  suggestionIndex: 0,
};

const worker = new Worker("sqlWorker.js?v=6");
const pending = new Map();
let nextId = 1;
const el = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

const SAMPLE_QUERIES = {
  ssr_all: `SELECT TOP 1000
  "KEY", "性別", "命宮主星", "財帛主星", "官祿主星", "田宅主星",
  "化祿星", "化祿宮位", "化權星", "化權宮位", "化科星", "化科宮位", "化忌宮位"
FROM "命盤"
WHERE "化忌宮位" NOT IN ('命宮', '財帛', '官祿', '田宅')
  AND "化祿宮位" IN ('命宮', '財帛', '官祿', '田宅')
  AND (("武曲宮位" IN ('財帛', '官祿', '田宅') AND "武曲星等" IN ('廟', '旺'))
    OR ("天府宮位" IN ('財帛', '官祿', '田宅') AND "天府星等" IN ('廟', '旺'))
    OR ("太陰宮位" IN ('財帛', '官祿', '田宅') AND "太陰星等" IN ('廟', '旺')))
  AND ("財帛全部星" LIKE '%祿存%' OR "官祿全部星" LIKE '%祿存%'
    OR "田宅全部星" LIKE '%祿存%' OR "化權宮位" IN ('命宮', '財帛', '官祿', '田宅')
    OR "化科宮位" IN ('命宮', '財帛', '官祿', '田宅'))
ORDER BY "公曆日期", "時辰序號", "性別";`,
  ssr_noble: `SELECT TOP 1000
  "KEY", "性別", "命宮主星", "命宮全部星", "官祿主星", "官祿全部星",
  "化祿星", "化祿宮位", "化權星", "化權宮位", "化科星", "化科宮位", "化忌宮位"
FROM "命盤"
WHERE ("命宮主星" LIKE '%紫微%' OR "命宮主星" LIKE '%天府%' OR "命宮主星" LIKE '%武曲%' OR "命宮主星" LIKE '%天相%')
  AND ("官祿主星" LIKE '%紫微%' OR "官祿主星" LIKE '%天府%' OR "官祿主星" LIKE '%武曲%' OR "官祿主星" LIKE '%天相%')
  AND "化忌宮位" NOT IN ('命宮', '官祿', '財帛')
  AND ("命宮全部星" LIKE '%左輔%' OR "命宮全部星" LIKE '%右弼%'
    OR "命宮全部星" LIKE '%天魁%' OR "命宮全部星" LIKE '%天鉞%'
    OR "官祿全部星" LIKE '%左輔%' OR "官祿全部星" LIKE '%右弼%'
    OR "官祿全部星" LIKE '%天魁%' OR "官祿全部星" LIKE '%天鉞%')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  sr_income: `SELECT TOP 1000
  "KEY", "性別", "財帛主星", "財帛全部星", "官祿主星", "田宅主星",
  "武曲星等", "天府星等", "化祿星", "化祿宮位", "化忌宮位"
FROM "命盤"
WHERE (("武曲宮位" = '財帛' AND "武曲星等" IN ('廟', '旺'))
    OR ("天府宮位" = '財帛' AND "天府星等" IN ('廟', '旺')))
  AND ("財帛全部星" LIKE '%祿存%' OR "化祿宮位" = '財帛')
  AND "化忌宮位" <> '財帛'
ORDER BY "公曆日期", "時辰序號", "性別";`,
  sr_asset: `SELECT TOP 1000
  "KEY", "性別", "財帛主星", "財帛全部星", "田宅主星", "田宅全部星",
  "天府星等", "太陰星等", "武曲星等", "化祿星", "化祿宮位", "化忌宮位"
FROM "命盤"
WHERE ("田宅主星" LIKE '%天府%' OR "田宅主星" LIKE '%太陰%' OR "田宅主星" LIKE '%武曲%')
  AND ("財帛主星" LIKE '%天府%' OR "財帛主星" LIKE '%太陰%' OR "財帛主星" LIKE '%武曲%')
  AND "化祿宮位" IN ('財帛', '田宅')
  AND "化忌宮位" NOT IN ('財帛', '田宅')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  sr_windfall: `SELECT TOP 1000
  "KEY", "性別", "財帛主星", "財帛全部星", "遷移主星", "遷移全部星",
  "貪狼星等", "破軍星等", "七殺星等", "化祿星", "化祿宮位", "化權星", "化權宮位"
FROM "命盤"
WHERE ("財帛主星" LIKE '%貪狼%' OR "財帛主星" LIKE '%破軍%' OR "財帛主星" LIKE '%七殺%')
  AND ("財帛全部星" LIKE '%火星%' OR "財帛全部星" LIKE '%鈴星%'
    OR "遷移全部星" LIKE '%火星%' OR "遷移全部星" LIKE '%鈴星%')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  sr_business: `SELECT TOP 1000
  "KEY", "性別", "財帛主星", "財帛全部星", "遷移主星", "遷移全部星",
  "貪狼星等", "巨門星等", "武曲星等", "化祿星", "化祿宮位", "化權星", "化權宮位"
FROM "命盤"
WHERE ("財帛主星" LIKE '%貪狼%' OR "財帛主星" LIKE '%巨門%' OR "財帛主星" LIKE '%武曲%')
  AND ("化祿宮位" IN ('財帛', '遷移') OR "化權宮位" IN ('財帛', '遷移'))
  AND ("財帛全部星" LIKE '%文昌%' OR "財帛全部星" LIKE '%文曲%' OR "財帛全部星" LIKE '%左輔%' OR "財帛全部星" LIKE '%右弼%'
    OR "遷移全部星" LIKE '%文昌%' OR "遷移全部星" LIKE '%文曲%' OR "遷移全部星" LIKE '%左輔%' OR "遷移全部星" LIKE '%右弼%')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  s_smart: `SELECT TOP 1000
  "KEY", "性別", "命宮主星", "官祿主星", "命宮全部星", "官祿全部星",
  "天機星等", "巨門星等", "太陽星等", "化科星", "化科宮位", "化祿星", "化祿宮位"
FROM "命盤"
WHERE ("命宮主星" LIKE '%天機%' OR "命宮主星" LIKE '%巨門%' OR "命宮主星" LIKE '%太陽%'
    OR "官祿主星" LIKE '%天機%' OR "官祿主星" LIKE '%巨門%' OR "官祿主星" LIKE '%太陽%')
  AND ("化科宮位" IN ('命宮', '官祿') OR "化祿宮位" IN ('命宮', '官祿'))
  AND ("命宮全部星" LIKE '%文昌%' OR "命宮全部星" LIKE '%文曲%' OR "命宮全部星" LIKE '%天魁%' OR "命宮全部星" LIKE '%天鉞%'
    OR "官祿全部星" LIKE '%文昌%' OR "官祿全部星" LIKE '%文曲%' OR "官祿全部星" LIKE '%天魁%' OR "官祿全部星" LIKE '%天鉞%')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  s_parents: `SELECT TOP 1000
  "KEY", "性別", "父母主星", "父母全部星", "田宅主星", "田宅全部星",
  "紫微星等", "天府星等", "太陽星等", "太陰星等", "化祿星", "化祿宮位", "化忌宮位"
FROM "命盤"
WHERE ("父母主星" LIKE '%紫微%' OR "父母主星" LIKE '%天府%' OR "父母主星" LIKE '%太陽%' OR "父母主星" LIKE '%太陰%')
  AND ("化祿宮位" = '父母' OR "父母全部星" LIKE '%祿存%')
  AND "化忌宮位" <> '父母'
  AND ("田宅主星" <> '' OR "化祿宮位" = '田宅')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  s_family: `SELECT TOP 1000
  "KEY", "性別", "命宮主星", "父母主星", "田宅主星",
  "命宮全部星", "父母全部星", "田宅全部星", "化祿宮位", "化權宮位", "化科宮位", "化忌宮位"
FROM "命盤"
WHERE ("命宮主星" LIKE '%紫微%' OR "命宮主星" LIKE '%天府%' OR "命宮主星" LIKE '%武曲%' OR "命宮主星" LIKE '%天相%')
  AND ("父母主星" LIKE '%紫微%' OR "父母主星" LIKE '%天府%' OR "父母主星" LIKE '%太陽%' OR "父母主星" LIKE '%太陰%')
  AND ("田宅主星" LIKE '%天府%' OR "田宅主星" LIKE '%太陰%' OR "田宅主星" LIKE '%武曲%')
  AND "化祿宮位" IN ('命宮', '父母', '田宅')
  AND "化忌宮位" NOT IN ('命宮', '父母', '田宅')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  top: `SELECT TOP 1000 *\nFROM "命盤";`,
  sihua: `SELECT TOP 1000\n  "KEY", "化祿星", "化祿宮位", "化權星", "化權宮位",\n  "化科星", "化科宮位", "化忌星", "化忌宮位"\nFROM "命盤"\nWHERE "化忌宮位" = '命宮'\nORDER BY "公曆日期", "時辰序號", "性別";`,
  daxian: `SELECT TOP 1000\n  "KEY", "命宮大限", "兄弟大限", "夫妻大限", "子女大限",\n  "財帛大限", "疾厄大限", "遷移大限", "僕役大限",\n  "官祿大限", "田宅大限", "福德大限", "父母大限"\nFROM "命盤";`,
  key: `SELECT *\nFROM "命盤"\nWHERE "KEY" = '20270810-子時-女';`,
  count: `SELECT COUNT(*) AS "資料筆數", COUNT(DISTINCT "KEY") AS "唯一KEY"\nFROM "命盤";`,
};

function call(type, payload = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload });
  });
}

worker.addEventListener("message", (event) => {
  if (event.data?.type === "status") {
    el("#statusText").textContent = event.data.message;
    return;
  }
  const request = pending.get(event.data.id);
  if (!request) return;
  pending.delete(event.data.id);
  event.data.ok ? request.resolve(event.data.result) : request.reject(new Error(event.data.error));
});

function renderLineNumbers() {
  const count = el("#sqlEditor").value.split("\n").length;
  el("#lineNumbers").textContent = Array.from({ length: count }, (_, index) => index + 1).join("\n");
}

function renderResult() {
  const { columns, rows } = state.result;
  el("#gridHead").innerHTML = columns.length
    ? `<tr><th class="row-number"></th>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>`
    : "";
  el("#gridRows").innerHTML = rows.map((row, index) => `<tr><th class="row-number">${index + 1}</th>${columns.map((column) => {
    const value = row[column];
    const className = value === null ? "null" : typeof value === "number" ? "number" : "";
    return `<td class="${className}" title="${escapeHtml(value)}">${value === null ? "NULL" : escapeHtml(value)}</td>`;
  }).join("")}</tr>`).join("");
  requestAnimationFrame(() => {
    const table = el("#dataGrid table");
    el("#horizontalScrollInner").style.width = `${table.scrollWidth}px`;
    el("#horizontalScroll").scrollLeft = el("#dataGrid").scrollLeft;
  });
}

function showResultTab(name) {
  document.querySelectorAll(".result-tab").forEach((button) => button.classList.toggle("active", button.dataset.resultTab === name));
  el("#resultsView").classList.toggle("active", name === "results");
  el("#messagesView").classList.toggle("active", name === "messages");
}

async function executeSql() {
  const sql = el("#sqlEditor").value.trim();
  if (!sql) return;
  hideAutocomplete();
  el("#runSql").disabled = true;
  el("#queryState").textContent = "Executing…";
  el("#statusText").textContent = "Executing query…";
  try {
    const result = await call("query", { sql });
    state.result = result;
    renderResult();
    const rowLabel = `${result.rows.length.toLocaleString()} row${result.rows.length === 1 ? "" : "s"}`;
    el("#resultMeta").textContent = `${rowLabel} · ${result.elapsedMs} ms`;
    el("#queryState").textContent = "Executed";
    el("#statusText").textContent = `${rowLabel} returned`;
    el("#messagesView").textContent = `Commands completed successfully.\n\n${rowLabel} returned in ${result.elapsedMs} ms.`;
    el("#exportCsv").disabled = !result.columns.length;
    showResultTab("results");
  } catch (error) {
    el("#queryState").textContent = "Error";
    el("#statusText").textContent = "Query failed";
    el("#resultMeta").textContent = "Error";
    el("#messagesView").textContent = error.message;
    showResultTab("messages");
  } finally {
    el("#runSql").disabled = false;
  }
}

function currentToken() {
  const editor = el("#sqlEditor");
  const before = editor.value.slice(0, editor.selectionStart);
  const match = before.match(/"?[\p{L}\p{N}_]+$/u);
  return { text: match?.[0] ?? "", start: editor.selectionStart - (match?.[0]?.length ?? 0) };
}

function completionCatalog() {
  const keywords = ["SELECT", "TOP", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN", "IS", "NULL", "AS", "DISTINCT", "ORDER BY", "GROUP BY", "HAVING", "ASC", "DESC", "LIMIT", "OFFSET", "COUNT", "AVG", "MIN", "MAX", "SUM", "CASE", "WHEN", "THEN", "ELSE", "END"];
  const columns = (state.metadata?.columns ?? []).map(({ name }) => `"${name.replaceAll('"', '""')}"`);
  return ["\"KEY\"", "\"命盤\"", ...keywords, ...columns.filter((name) => name !== '"KEY"')];
}

function updateAutocomplete(force = false) {
  if (!state.metadata) return;
  const token = currentToken();
  if (!force && token.text.length < 1) return hideAutocomplete();
  const needle = token.text.replace(/^"/, "").toLocaleLowerCase("zh-Hant");
  state.suggestions = completionCatalog()
    .filter((item) => force && !needle || item.replaceAll('"', "").toLocaleLowerCase("zh-Hant").startsWith(needle))
    .slice(0, 14);
  state.suggestionIndex = 0;
  renderAutocomplete();
}

function renderAutocomplete() {
  const popup = el("#autocomplete");
  if (!state.suggestions.length) return hideAutocomplete();
  popup.innerHTML = state.suggestions.map((item, index) => `<button type="button" data-completion="${index}" class="${index === state.suggestionIndex ? "active" : ""}"><span>${escapeHtml(item)}</span><small>${item.startsWith('"') ? "column" : "keyword"}</small></button>`).join("");
  popup.hidden = false;
}

function hideAutocomplete() {
  el("#autocomplete").hidden = true;
  state.suggestions = [];
}

function applyCompletion(index) {
  const value = state.suggestions[index];
  if (!value) return;
  const editor = el("#sqlEditor");
  const token = currentToken();
  editor.setRangeText(value, token.start, editor.selectionStart, "end");
  editor.focus();
  hideAutocomplete();
  renderLineNumbers();
}

function handleEditorKeydown(event) {
  if (event.key === "F5") {
    event.preventDefault();
    executeSql();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    executeSql();
    return;
  }
  if (event.ctrlKey && event.code === "Space") {
    event.preventDefault();
    updateAutocomplete(true);
    return;
  }
  if (el("#autocomplete").hidden) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    state.suggestionIndex = (state.suggestionIndex + direction + state.suggestions.length) % state.suggestions.length;
    renderAutocomplete();
  } else if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    applyCompletion(state.suggestionIndex);
  } else if (event.key === "Escape") {
    hideAutocomplete();
  }
}

function exportCsv() {
  const { columns, rows } = state.result;
  const cell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = `\uFEFF${[columns, ...rows.map((row) => columns.map((column) => row[column]))].map((line) => line.map(cell).join(",")).join("\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `bazi-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  el("#runSql").addEventListener("click", executeSql);
  el("#sqlEditor").addEventListener("keydown", handleEditorKeydown);
  el("#sqlEditor").addEventListener("input", () => { renderLineNumbers(); updateAutocomplete(); });
  el("#sqlEditor").addEventListener("scroll", () => { el("#lineNumbers").scrollTop = el("#sqlEditor").scrollTop; });
  el("#autocomplete").addEventListener("mousedown", (event) => {
    event.preventDefault();
    const index = event.target.closest("[data-completion]")?.dataset.completion;
    if (index !== undefined) applyCompletion(Number(index));
  });
  document.addEventListener("mousedown", (event) => { if (!event.target.closest(".editor-wrap")) hideAutocomplete(); });
  document.querySelectorAll(".result-tab").forEach((button) => button.addEventListener("click", () => showResultTab(button.dataset.resultTab)));
  el("#exportCsv").addEventListener("click", exportCsv);
  document.querySelector(".sample-list").addEventListener("click", (event) => {
    const key = event.target.closest("[data-sample]")?.dataset.sample;
    if (!key || !SAMPLE_QUERIES[key]) return;
    el("#sqlEditor").value = SAMPLE_QUERIES[key];
    renderLineNumbers();
    hideAutocomplete();
    el("#sqlEditor").focus();
  });
  el("#horizontalScroll").addEventListener("scroll", () => {
    el("#dataGrid").scrollLeft = el("#horizontalScroll").scrollLeft;
  });
  el("#dataGrid").addEventListener("scroll", () => {
    el("#horizontalScroll").scrollLeft = el("#dataGrid").scrollLeft;
  });
  el("#themeToggle").addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("bazi.theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
  });
}

async function boot() {
  document.documentElement.classList.toggle("dark", localStorage.getItem("bazi.theme") !== "light");
  bindEvents();
  renderLineNumbers();
  try {
    state.metadata = await call("init");
    el("#connectionState").textContent = `SQLite · ${state.metadata.table}`;
    el("#datasetMeta").textContent = `${state.metadata.year} · ${state.metadata.rowCount.toLocaleString()} rows · ${state.metadata.columns.length} columns`;
    el("#runSql").disabled = false;
    await executeSql();
  } catch (error) {
    el("#statusText").textContent = error.message;
    el("#messagesView").textContent = error.message;
    showResultTab("messages");
  }
}

boot();
