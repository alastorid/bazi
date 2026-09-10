(() => {
  "use strict";

  const CELL_WIDTH = 18;
  const ROW_HEIGHT = 30;
  const TOP = 46;
  const LEFT = 54;
  const HOURS = ["子時", "丑時", "寅時", "卯時", "辰時", "巳時", "午時", "未時", "申時", "酉時", "戌時", "亥時"];
  const COLORS = {
    女吉: [214, 72, 169], 女凶: [183, 46, 67],
    男吉: [42, 143, 214], 男凶: [211, 111, 35],
  };
  const CHUNK_DAYS = 31;
  const state = { metadata: null, query: null, byCell: new Map(), dates: [], ready: false, loadedChunks: new Set(), loadingChunks: new Set(), selected: null, frame: 0 };
  const root = () => document.querySelector("#visualizationView");
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const cellKey = (date, hour, gender) => `${date}|${hour}|${gender}`;
  const alpha = (rarity) => rarity ? 0.24 + Math.min(5, Number(rarity)) * 0.145 : 0;
  const fill = (context, color, rarity, x, y, width, height) => {
    if (!rarity) return;
    context.fillStyle = `rgba(${color.join(",")},${alpha(rarity)})`;
    context.fillRect(x, y, width, height);
  };

  function shell() {
    const years = state.metadata?.years ?? [state.metadata?.year];
    const rangeLabel = years.length > 1 ? `${years[0]}—${years.at(-1)}` : `${years[0]}`;
    root().innerHTML = `<div class="viz-shell">
      <header class="viz-header">
        <div><strong>${esc(rangeLabel)} 吉凶格時間軸</strong><span id="vizSummary">尚未載入</span></div>
        <div class="viz-legend" aria-label="圖例">
          <span><i class="female-good"></i>女命吉格</span><span><i class="female-bad"></i>女命凶格</span>
          <span><i class="male-good"></i>男命吉格</span><span><i class="male-bad"></i>男命凶格</span>
          <small>每格左半吉／右半凶，上層女／下層男；色深＝結構稀有度高（1—5），非人口機率</small>
        </div>
      </header>
      <div class="viz-scroll" tabindex="0" aria-label="可水平捲動的吉凶格時間軸">
        <div class="viz-stage"><canvas class="viz-canvas"></canvas></div>
        <div class="viz-loading">載入 ${esc(rangeLabel)} 格局資料…</div>
      </div>
      <section class="viz-detail"><span>點選色塊檢視該日期、時辰與性別的吉凶格。</span></section>
      <div class="viz-tooltip" hidden></div>
    </div>`;
    const scroller = root().querySelector(".viz-scroll");
    scroller.addEventListener("scroll", scheduleDraw, { passive: true });
    scroller.addEventListener("pointermove", hover);
    scroller.addEventListener("pointerleave", () => { root().querySelector(".viz-tooltip").hidden = true; });
    scroller.addEventListener("click", choose);
    new ResizeObserver(scheduleDraw).observe(scroller);
    prepareTimeline();
  }

  function prepareTimeline() {
    if (state.ready) return;
    const years = state.metadata.years ?? [state.metadata.year];
    const first = new Date(Date.UTC(Number(years[0]), 0, 1));
    const last = new Date(Date.UTC(Number(years.at(-1)), 11, 31));
    for (let date = first; date <= last; date = new Date(date.getTime() + 86400000)) state.dates.push(date.toISOString().slice(0, 10));
    const stage = root().querySelector(".viz-stage");
    stage.style.width = `${LEFT + state.dates.length * CELL_WIDTH}px`;
    stage.style.height = `${TOP + HOURS.length * ROW_HEIGHT + 22}px`;
    root().querySelector("#vizSummary").textContent = `${state.dates.length} 日 · ${Number(state.metadata.rowCount).toLocaleString()} 張命盤 · 可見日期即時載入`;
    state.ready = true;
    scheduleDraw();
  }

  async function loadChunk(chunk) {
    if (state.loadedChunks.has(chunk) || state.loadingChunks.has(chunk)) return;
    state.loadingChunks.add(chunk);
    const start = chunk * CHUNK_DAYS;
    const end = Math.min(state.dates.length - 1, start + CHUNK_DAYS - 1);
    const from = state.dates[start];
    const to = state.dates[end];
    try {
      const result = await state.query(`SELECT
      m."KEY", m."命盤連結", m."公曆日期", m."年", m."月", m."日", m."時辰", m."時辰序號", m."性別",
      MAX(CASE WHEN d."吉凶"='吉' THEN COALESCE(d."結構稀有度",0) ELSE 0 END) AS "吉格稀有度",
      MAX(CASE WHEN d."吉凶"='凶' THEN COALESCE(d."結構稀有度",0) ELSE 0 END) AS "凶格稀有度",
      GROUP_CONCAT(DISTINCT CASE WHEN d."吉凶"='吉' THEN d."名稱" END) AS "吉格",
      GROUP_CONCAT(DISTINCT CASE WHEN d."吉凶"='凶' THEN d."名稱" END) AS "凶格"
    FROM "命盤" m
    LEFT JOIN "命盤格局明細" d ON d."KEY"=m."KEY"
      AND d."吉凶" IN ('吉','凶') AND d."結構稀有度" BETWEEN 1 AND 5
    WHERE m."公曆日期" BETWEEN '${from}' AND '${to}'
    GROUP BY m."KEY", m."命盤連結", m."公曆日期", m."年", m."月", m."日", m."時辰", m."時辰序號", m."性別"
    ORDER BY m."公曆日期", m."時辰序號", m."性別";`);
      for (const row of result.rows) state.byCell.set(cellKey(row.公曆日期, Number(row.時辰序號), row.性別), row);
      state.loadedChunks.add(chunk);
      root().querySelector(".viz-loading")?.remove();
      scheduleDraw();
    } catch (error) {
      const loading = root().querySelector(".viz-loading");
      if (loading) loading.textContent = `資料載入失敗：${error.message}`;
    } finally {
      state.loadingChunks.delete(chunk);
    }
  }

  function ensureRange(start, end) {
    const firstChunk = Math.floor(start / CHUNK_DAYS);
    const lastChunk = Math.floor(Math.max(start, end - 1) / CHUNK_DAYS);
    for (let chunk = firstChunk; chunk <= lastChunk; chunk += 1) loadChunk(chunk);
  }

  function viewportCell(event) {
    if (!state.ready) return null;
    const scroller = root().querySelector(".viz-scroll");
    const rect = scroller.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const day = Math.floor((scroller.scrollLeft + localX - LEFT) / CELL_WIDTH);
    const hour = Math.floor((localY - TOP) / ROW_HEIGHT);
    if (day < 0 || day >= state.dates.length || hour < 0 || hour >= HOURS.length) return null;
    const gender = (localY - TOP - hour * ROW_HEIGHT) < ROW_HEIGHT / 2 ? "女" : "男";
    return state.byCell.get(cellKey(state.dates[day], hour, gender)) ?? null;
  }

  function hover(event) {
    const row = viewportCell(event);
    const tooltip = root().querySelector(".viz-tooltip");
    if (!row) { tooltip.hidden = true; return; }
    tooltip.hidden = false;
    tooltip.style.left = `${event.clientX + 12}px`;
    tooltip.style.top = `${event.clientY + 12}px`;
    tooltip.textContent = `${row.公曆日期} · ${row.時辰} · ${row.性別}\n吉格：${String(row.吉格 || "無").replaceAll(",", "、")}（最高 ${row.吉格稀有度 || 0}）\n凶格：${String(row.凶格 || "無").replaceAll(",", "、")}（最高 ${row.凶格稀有度 || 0}）`;
  }

  function choose(event) {
    const row = viewportCell(event);
    if (!row) return;
    state.selected = row;
    root().querySelector(".viz-detail").innerHTML = `<div><strong>${esc(row.公曆日期)} · ${esc(row.時辰)} · ${esc(row.性別)}</strong><small>${esc(row.KEY)}</small></div>
      <div><b>吉格</b><span>${esc(String(row.吉格 || "無").replaceAll(",", "、"))}</span><em>最高稀有度 ${Number(row.吉格稀有度 || 0)}</em></div>
      <div><b>凶格</b><span>${esc(String(row.凶格 || "無").replaceAll(",", "、"))}</span><em>最高稀有度 ${Number(row.凶格稀有度 || 0)}</em></div>
      <a href="${esc(row.命盤連結)}" target="_blank" rel="noopener noreferrer">開啟命盤 ↗</a>`;
    scheduleDraw();
  }

  function scheduleDraw() {
    cancelAnimationFrame(state.frame);
    state.frame = requestAnimationFrame(draw);
  }

  function draw() {
    if (!state.ready) return;
    const scroller = root().querySelector(".viz-scroll");
    const canvas = root().querySelector(".viz-canvas");
    const width = scroller.clientWidth;
    const height = TOP + HOURS.length * ROW_HEIGHT + 22;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--panel");
    context.fillRect(0, 0, width, height);
    const start = Math.max(0, Math.floor((scroller.scrollLeft - LEFT) / CELL_WIDTH) - 2);
    const end = Math.min(state.dates.length, Math.ceil((scroller.scrollLeft + width - LEFT) / CELL_WIDTH) + 2);
    ensureRange(start, end);
    for (let index = start; index < end; index += 1) {
      const date = state.dates[index];
      const x = LEFT + index * CELL_WIDTH - scroller.scrollLeft;
      const dateObject = new Date(`${date}T00:00:00Z`);
      if (dateObject.getUTCDate() === 1) {
        context.strokeStyle = "rgba(127,127,127,.42)"; context.beginPath(); context.moveTo(x, 20); context.lineTo(x, height); context.stroke();
        context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--ink"); context.font = "11px Segoe UI, sans-serif";
        context.fillText(`${dateObject.getUTCFullYear()}-${String(dateObject.getUTCMonth() + 1).padStart(2, "0")}`, x + 4, 16);
      }
      if (dateObject.getUTCDay() === 1) { context.fillStyle = "rgba(127,127,127,.06)"; context.fillRect(x, TOP, CELL_WIDTH * 7, HOURS.length * ROW_HEIGHT); }
      for (let hour = 0; hour < HOURS.length; hour += 1) {
        const y = TOP + hour * ROW_HEIGHT;
        for (const [gender, offset] of [["女", 0], ["男", ROW_HEIGHT / 2]]) {
          const row = state.byCell.get(cellKey(date, hour, gender));
          if (!row) continue;
          fill(context, COLORS[`${gender}吉`], Number(row.吉格稀有度), x, y + offset, CELL_WIDTH / 2, ROW_HEIGHT / 2);
          fill(context, COLORS[`${gender}凶`], Number(row.凶格稀有度), x + CELL_WIDTH / 2, y + offset, CELL_WIDTH / 2, ROW_HEIGHT / 2);
          if (state.selected?.KEY === row.KEY) { context.strokeStyle = "#111"; context.lineWidth = 1.5; context.strokeRect(x + .75, y + offset + .75, CELL_WIDTH - 1.5, ROW_HEIGHT / 2 - 1.5); }
        }
      }
    }
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--panel"); context.fillRect(0, 0, LEFT, height);
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--ink"); context.font = "11px Segoe UI, sans-serif"; context.textAlign = "right";
    HOURS.forEach((label, index) => context.fillText(label, LEFT - 7, TOP + index * ROW_HEIGHT + 19));
    context.textAlign = "left"; context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--muted");
    context.fillText("← 水平捲動完整時間軸 →", LEFT + 4, height - 5);
  }

  function init({ metadata, query }) {
    state.metadata = metadata; state.query = query; shell();
    if (document.querySelector("#visualizationWorkspace")?.classList.contains("active")) scheduleDraw();
  }
  window.BAZI_VISUALIZATION = { init, activate() { if (state.query) scheduleDraw(); }, redraw: scheduleDraw };
})();
