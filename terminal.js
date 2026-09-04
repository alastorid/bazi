const state = { metadata: null, result: { columns: [], rows: [] }, selectedKey: "", starFilterCount: 0 };
const worker = new Worker("sqlWorker.js?v=1");
const pending = new Map();
let nextId = 1;
const el = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const quoteIdent = (value) => `"${String(value).replaceAll('"', '""')}"`;

function call(type, payload = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload });
  });
}

worker.addEventListener("message", (event) => {
  if (event.data?.type === "status") {
    el("#loadStatusText").textContent = event.data.message;
    el("#loadStatusFill").style.width = `${Math.round((event.data.progress || 0) * 100)}%`;
    document.body.classList.toggle("loading", event.data.phase !== "ready");
    return;
  }
  const request = pending.get(event.data.id);
  if (!request) return;
  pending.delete(event.data.id);
  event.data.ok ? request.resolve(event.data.result) : request.reject(new Error(event.data.error));
});

function optionList(items, blank = "全部") {
  return `<option value="">${blank}</option>${items.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join("")}`;
}

function addStarFilter(initial = {}) {
  const id = ++state.starFilterCount;
  const row = document.createElement("div");
  row.className = "star-filter";
  row.dataset.starFilter = id;
  row.innerHTML = `<select data-role="star" aria-label="星曜">${optionList(state.metadata.stars, "選星曜")}</select>
    <select data-role="brightness" aria-label="星等">${optionList(state.metadata.brightness, "任意星等")}<option value="__present">在命盤</option></select>
    <select data-role="palace" aria-label="宮位">${optionList(state.metadata.palaces, "任意宮位")}</select>
    <button data-remove-star="${id}" type="button" title="移除">×</button>`;
  row.querySelector('[data-role="star"]').value = initial.star || "";
  row.querySelector('[data-role="brightness"]').value = initial.brightness || "";
  row.querySelector('[data-role="palace"]').value = initial.palace || "";
  el("#starFilters").append(row);
}

function selected(selector) { return el(selector).value; }

function buildFilterQuery() {
  const clauses = [];
  const params = [];
  const add = (column, operator, value) => {
    if (!value) return;
    clauses.push(`${quoteIdent(column)} ${operator} ?`);
    params.push(value);
  };
  add("公曆日期", ">=", selected("#dateFrom"));
  add("公曆日期", "<=", selected("#dateTo"));
  add("性別", "=", selected("#gender"));
  add("時辰", "=", selected("#hour"));
  add("命宮", "=", selected("#soul"));
  add("身宮", "=", selected("#body"));
  add("化祿宮位", "=", selected("#huaLu"));
  add("化權宮位", "=", selected("#huaQuan"));
  add("化科宮位", "=", selected("#huaKe"));
  add("化忌宮位", "=", selected("#huaJi"));
  for (const row of document.querySelectorAll("[data-star-filter]")) {
    const star = row.querySelector('[data-role="star"]').value;
    if (!star) continue;
    const brightness = row.querySelector('[data-role="brightness"]').value;
    const palace = row.querySelector('[data-role="palace"]').value;
    if (brightness === "__present") clauses.push(`${quoteIdent(`${star}宮位`)} <> ''`);
    else add(`${star}星等`, "=", brightness);
    add(`${star}宮位`, "=", palace);
  }
  const visible = ["KEY", "公曆日期", "時辰", "性別", "命宮", "身宮", "身宮宮位", "化祿星", "化祿宮位", "化權星", "化權宮位", "化科星", "化科宮位", "化忌星", "化忌宮位"];
  const sql = `SELECT ${visible.map(quoteIdent).join(", ")} FROM "命盤"${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY "公曆日期", "時辰序號", "性別"`;
  return { sql, params };
}

async function runQuery(sql, params = []) {
  el("#resultMeta").textContent = "Querying…";
  try {
    const result = await call("query", { sql, params, maxRows: 1000 });
    state.result = result;
    renderGrid();
    el("#resultMeta").textContent = `${result.rows.length.toLocaleString()} rows · ${result.elapsedMs} ms${result.truncated ? " · truncated" : ""}`;
    el("#perfBadge").textContent = `${result.elapsedMs} ms`;
    showTab("results");
  } catch (error) {
    el("#resultMeta").textContent = `ERROR: ${error.message}`;
  }
}

function renderGrid() {
  const { columns, rows } = state.result;
  el("#gridHead").innerHTML = `<tr>${columns.map((column) => `<th title="${esc(column)}">${esc(column)}</th>`).join("")}</tr>`;
  el("#gridRows").innerHTML = rows.map((row) => `<tr data-key="${esc(row.KEY || "")}"${row.KEY === state.selectedKey ? ' class="active"' : ""}>${columns.map((column) => `<td title="${esc(row[column])}">${esc(row[column])}</td>`).join("")}</tr>`).join("");
}

async function openDetail(key) {
  if (!key) return;
  state.selectedKey = key;
  renderGrid();
  const result = await call("query", { sql: 'SELECT * FROM "命盤" WHERE "KEY" = ?', params: [key], maxRows: 1 });
  const row = result.rows[0];
  if (!row) return;
  el("#detailTitle").textContent = key;
  const base = [["公曆", row.公曆日期], ["農曆", row.農曆日期], ["命宮", row.命宮], ["身宮", `${row.身宮} · ${row.身宮宮位}`], ["五行局", row.五行局]];
  const hua = [["祿", row.化祿星, row.化祿宮位], ["權", row.化權星, row.化權宮位], ["科", row.化科星, row.化科宮位], ["忌", row.化忌星, row.化忌宮位]];
  const palaceCards = state.metadata.palaces.map((name) => `<article class="palace-card"><header><strong>${esc(name)}</strong><span>${esc(row[`${name}主星`]) || "空宮"}</span></header><p>${esc(row[`${name}全部星`]) || "—"}</p></article>`).join("");
  el("#detailBody").innerHTML = `<div class="detail-grid">${base.map(([a, b]) => `<span>${a}</span><strong>${esc(b)}</strong>`).join("")}</div><div class="hua-strip">${hua.map(([kind, star, palace]) => `<div class="${kind === "忌" ? "danger" : ""}"><b>化${kind}</b><span>${esc(star)}</span><small>${esc(palace)}</small></div>`).join("")}</div><div class="palace-list">${palaceCards}</div>`;
}

function showTab(tab) {
  document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  el("#resultsPane").classList.toggle("active", tab === "results");
  el("#sqlPane").classList.toggle("active", tab === "sql");
}

function renderSchema(filter = "") {
  const term = filter.trim().toLowerCase();
  const columns = state.metadata.columns.filter((column) => column.name.toLowerCase().includes(term));
  el("#schemaList").innerHTML = columns.map((column) => `<button type="button" data-schema-column="${esc(column.name)}"><code>${esc(column.name)}</code><span>${esc(column.type)}</span></button>`).join("");
}

function exportCsv() {
  const { columns, rows } = state.result;
  const cell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = `\uFEFF${[columns, ...rows.map((row) => columns.map((column) => row[column]))].map((line) => line.map(cell).join(",")).join("\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = `ziwei-query-${Date.now()}.csv`; link.click(); URL.revokeObjectURL(url);
}

function bindEvents() {
  el("#addStarFilter").addEventListener("click", () => addStarFilter());
  el("#starFilters").addEventListener("click", (event) => event.target.closest("[data-remove-star]")?.closest(".star-filter")?.remove());
  el("#runFilters").addEventListener("click", () => { const { sql, params } = buildFilterQuery(); el("#sqlEditor").value = `${sql};`; runQuery(sql, params); });
  el("#resetFilters").addEventListener("click", () => {
    for (const selector of ["#gender", "#hour", "#soul", "#body", "#huaLu", "#huaQuan", "#huaKe", "#huaJi"]) el(selector).value = "";
    el("#dateFrom").value = `${state.metadata.year}-01-01`; el("#dateTo").value = `${state.metadata.year}-12-31`; el("#starFilters").innerHTML = ""; addStarFilter();
  });
  document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => showTab(button.dataset.tab)));
  el("#runSql").addEventListener("click", () => runQuery(el("#sqlEditor").value));
  el("#sqlEditor").addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); runQuery(el("#sqlEditor").value); } });
  el("#gridRows").addEventListener("click", (event) => openDetail(event.target.closest("tr")?.dataset.key));
  el("#showSchema").addEventListener("click", () => { renderSchema(); el("#schemaDialog").showModal(); el("#schemaSearch").focus(); });
  el("#closeSchema").addEventListener("click", () => el("#schemaDialog").close());
  el("#schemaSearch").addEventListener("input", (event) => renderSchema(event.target.value));
  el("#schemaList").addEventListener("click", (event) => { const name = event.target.closest("[data-schema-column]")?.dataset.schemaColumn; if (name) navigator.clipboard?.writeText(quoteIdent(name)); });
  el("#exportCsv").addEventListener("click", exportCsv);
  el("#themeToggle").addEventListener("click", () => { document.documentElement.classList.toggle("dark"); localStorage.setItem("bazi.theme", document.documentElement.classList.contains("dark") ? "dark" : "light"); });
}

async function boot() {
  document.documentElement.classList.toggle("dark", localStorage.getItem("bazi.theme") !== "light");
  bindEvents();
  try {
    state.metadata = await call("init");
    document.title = "bazi";
    el("#siteBrand").textContent = "bazi";
    el("#datasetMeta").textContent = `${state.metadata.year} · ${state.metadata.rowCount.toLocaleString()} 張 · ${state.metadata.columns.length} 欄`;
    el("#dateFrom").value = `${state.metadata.year}-01-01`; el("#dateTo").value = `${state.metadata.year}-12-31`;
    el("#hour").innerHTML = optionList(["子時", "丑時", "寅時", "卯時", "辰時", "巳時", "午時", "未時", "申時", "酉時", "戌時", "亥時"]);
    for (const selector of ["#soul", "#body"]) el(selector).innerHTML = optionList(["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]);
    for (const selector of ["#huaLu", "#huaQuan", "#huaKe", "#huaJi"]) el(selector).innerHTML = optionList(state.metadata.palaces);
    addStarFilter({ star: "紫微" });
    const { sql, params } = buildFilterQuery();
    await runQuery(sql, params);
    setTimeout(() => document.body.classList.remove("loading"), 600);
  } catch (error) {
    el("#loadStatusText").textContent = `載入失敗：${error.message}`;
  }
}

boot();
