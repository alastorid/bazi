(() => {
  "use strict";

  const HOURS = ["子時", "丑時", "寅時", "卯時", "辰時", "巳時", "午時", "未時", "申時", "酉時", "戌時", "亥時"];
  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
  const CHUNK_DAYS = 31;
  const MONTH_TITLE = 34;
  const WEEKDAY_HEIGHT = 24;
  const DAY_HEADER = 18;
  const HOUR_HEIGHT = 7;
  const DAY_HEIGHT = DAY_HEADER + HOURS.length * HOUR_HEIGHT + 5;
  const MONTH_GAP = 22;
  const state = {
    metadata: null, query: null, dates: [], months: [], byCell: new Map(),
    loadedChunks: new Set(), loadingChunks: new Set(), mode: "女＋男",
    selected: null, ready: false, positioned: false, frame: 0,
  };
  const root = () => document.querySelector("#visualizationView");
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const key = (date, hour, gender) => `${date}|${hour}|${gender}`;
  const pad = (number) => String(number).padStart(2, "0");
  const localDate = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  function shell() {
    const years = state.metadata?.calendarYears ?? state.metadata?.years ?? [state.metadata?.year];
    const range = years.length > 1 ? `${years[0]}—${years.at(-1)}` : `${years[0]}`;
    root().innerHTML = `<div class="viz-shell">
      <header class="viz-header">
        <div><strong>${esc(range)} 吉凶格時間軸</strong><span id="vizSummary">準備時間軸…</span></div>
        <div class="viz-switch" role="group" aria-label="性別顯示">
          ${["女", "男", "女＋男"].map((mode) => `<button type="button" data-viz-mode="${mode}" class="${mode === state.mode ? "active" : ""}">${mode}</button>`).join("")}
        </div>
        <div class="viz-scale" aria-label="色階"><span>凶格多</span><i></i><span>吉格多</span></div>
      </header>
      <div class="viz-main">
        <div class="viz-scroll" tabindex="0" aria-label="由上到下捲動的吉凶格月曆">
          <div class="viz-stage"><canvas class="viz-canvas"></canvas></div>
          <div class="viz-loading">載入可見日期…</div>
        </div>
        <aside class="viz-detail"><div class="viz-detail-empty"><strong>命盤明細</strong><span>點選色塊查看吉凶格；雙擊直接開啟命盤。</span></div></aside>
      </div>
      <div class="viz-tooltip" hidden></div>
    </div>`;
    const scroller = root().querySelector(".viz-scroll");
    scroller.addEventListener("scroll", scheduleDraw, { passive: true });
    scroller.addEventListener("pointermove", hover);
    scroller.addEventListener("pointerleave", () => { root().querySelector(".viz-tooltip").hidden = true; });
    scroller.addEventListener("click", choose);
    scroller.addEventListener("dblclick", openChart);
    root().querySelector(".viz-switch").addEventListener("click", switchMode);
    new ResizeObserver(scheduleDraw).observe(scroller);
    prepareTimeline();
  }

  function prepareTimeline() {
    if (state.ready) return;
    const years = state.metadata.calendarYears ?? state.metadata.years ?? [state.metadata.year];
    const first = new Date(Date.UTC(Number(years[0]), 0, 1));
    const last = new Date(Date.UTC(Number(years.at(-1)), 11, 31));
    for (let date = first; date <= last; date = new Date(date.getTime() + 86400000)) state.dates.push(date.toISOString().slice(0, 10));
    let top = 0;
    for (const year of years) {
      for (let month = 0; month < 12; month += 1) {
        const start = new Date(Date.UTC(Number(year), month, 1));
        const days = new Date(Date.UTC(Number(year), month + 1, 0)).getUTCDate();
        const weeks = Math.ceil((start.getUTCDay() + days) / 7);
        const height = MONTH_TITLE + WEEKDAY_HEIGHT + weeks * DAY_HEIGHT + MONTH_GAP;
        state.months.push({ year: Number(year), month, startDay: start.getUTCDay(), days, weeks, top, height });
        top += height;
      }
    }
    root().querySelector(".viz-stage").style.height = `${top}px`;
    root().querySelector("#vizSummary").textContent = `${state.dates.length} 日 · ${Number(state.metadata.rowCount).toLocaleString()} 張命盤 · 色彩依吉凶格數量`;
    state.ready = true;
    scheduleDraw();
    requestAnimationFrame(scrollToCurrentDate);
  }

  function scrollToCurrentDate() {
    const now = new Date();
    const years = state.metadata.calendarYears ?? state.metadata.years ?? [state.metadata.year];
    const targetYear = years.includes(now.getFullYear()) ? now.getFullYear() : Number(years[0]);
    const targetMonth = targetYear === now.getFullYear() ? now.getMonth() : 0;
    const layout = state.months.find((item) => item.year === targetYear && item.month === targetMonth);
    if (!layout) return;
    const scroller = root().querySelector(".viz-scroll");
    if (!scroller.clientHeight) return;
    const day = targetYear === now.getFullYear() && targetMonth === now.getMonth() ? now.getDate() : 1;
    const week = Math.floor((layout.startDay + day - 1) / 7);
    const focusedWeek = layout.top + MONTH_TITLE + WEEKDAY_HEIGHT + week * DAY_HEIGHT - scroller.clientHeight * 0.34;
    scroller.scrollTop = Math.max(layout.top, focusedWeek);
    state.positioned = true;
    scheduleDraw();
  }

  async function loadChunk(chunk) {
    if (state.loadedChunks.has(chunk) || state.loadingChunks.has(chunk)) return;
    state.loadingChunks.add(chunk);
    const start = chunk * CHUNK_DAYS;
    const end = Math.min(state.dates.length - 1, start + CHUNK_DAYS - 1);
    try {
      const result = await state.query(`SELECT
        m."KEY", m."命盤連結", m."公曆日期", m."時辰", m."時辰序號", m."性別",
        COUNT(DISTINCT CASE WHEN d."吉凶"='吉' THEN d."名稱" END) AS "吉格數",
        COUNT(DISTINCT CASE WHEN d."吉凶"='凶' THEN d."名稱" END) AS "凶格數",
        GROUP_CONCAT(DISTINCT CASE WHEN d."吉凶"='吉' THEN d."名稱" END) AS "吉格",
        GROUP_CONCAT(DISTINCT CASE WHEN d."吉凶"='凶' THEN d."名稱" END) AS "凶格"
      FROM "命盤" m
      LEFT JOIN "命盤格局明細" d ON d."KEY"=m."KEY"
        AND d."吉凶" IN ('吉','凶') AND d."結構稀有度" BETWEEN 1 AND 5
      WHERE m."公曆日期" BETWEEN '${state.dates[start]}' AND '${state.dates[end]}'
      GROUP BY m."KEY", m."命盤連結", m."公曆日期", m."時辰", m."時辰序號", m."性別"
      ORDER BY m."公曆日期", m."時辰序號", m."性別";`);
      for (const row of result.rows) state.byCell.set(key(row.公曆日期, Number(row.時辰序號), row.性別), row);
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

  function ensureDates(from, to) {
    if (from < 0 || to < 0) return;
    const first = Math.max(0, Math.floor(from / CHUNK_DAYS));
    const last = Math.min(Math.ceil(state.dates.length / CHUNK_DAYS) - 1, Math.floor(to / CHUNK_DAYS));
    for (let chunk = first; chunk <= last; chunk += 1) loadChunk(chunk);
  }

  function monthAt(y) {
    return state.months.find((month) => y >= month.top && y < month.top + month.height) ?? null;
  }

  function hit(event) {
    if (!state.ready) return null;
    const scroller = root().querySelector(".viz-scroll");
    const rect = scroller.getBoundingClientRect();
    const width = scroller.clientWidth;
    const side = 14;
    const columnWidth = Math.max(34, (width - side * 2) / 7);
    const x = event.clientX - rect.left - side;
    const absoluteY = scroller.scrollTop + event.clientY - rect.top;
    const month = monthAt(absoluteY);
    if (!month || x < 0 || x >= columnWidth * 7) return null;
    const gridY = absoluteY - month.top - MONTH_TITLE - WEEKDAY_HEIGHT;
    if (gridY < 0 || gridY >= month.weeks * DAY_HEIGHT) return null;
    const column = Math.floor(x / columnWidth);
    const week = Math.floor(gridY / DAY_HEIGHT);
    const day = week * 7 + column - month.startDay + 1;
    const insideDayY = gridY - week * DAY_HEIGHT;
    const hour = Math.floor((insideDayY - DAY_HEADER) / HOUR_HEIGHT);
    if (day < 1 || day > month.days || hour < 0 || hour >= HOURS.length) return null;
    let gender = state.mode;
    if (state.mode === "女＋男") gender = (x - column * columnWidth) < columnWidth / 2 ? "男" : "女";
    const date = `${month.year}-${pad(month.month + 1)}-${pad(day)}`;
    return state.byCell.get(key(date, hour, gender)) ?? { pending: true, date, hour, gender };
  }

  function switchMode(event) {
    const mode = event.target.closest("[data-viz-mode]")?.dataset.vizMode;
    if (!mode || mode === state.mode) return;
    state.mode = mode;
    state.selected = null;
    root().querySelectorAll("[data-viz-mode]").forEach((button) => button.classList.toggle("active", button.dataset.vizMode === mode));
    root().querySelector(".viz-detail").innerHTML = '<div class="viz-detail-empty"><strong>命盤明細</strong><span>點選色塊查看吉凶格；雙擊直接開啟命盤。</span></div>';
    scheduleDraw();
  }

  function hover(event) {
    const row = hit(event);
    const tooltip = root().querySelector(".viz-tooltip");
    if (!row || row.pending) { tooltip.hidden = true; return; }
    tooltip.hidden = false;
    tooltip.style.left = `${Math.min(window.innerWidth - 310, event.clientX + 12)}px`;
    tooltip.style.top = `${Math.min(window.innerHeight - 110, event.clientY + 12)}px`;
    tooltip.textContent = `${row.公曆日期} · ${row.時辰} · ${row.性別}\n吉格 ${row.吉格數}：${String(row.吉格 || "無").replaceAll(",", "、")}\n凶格 ${row.凶格數}：${String(row.凶格 || "無").replaceAll(",", "、")}`;
  }

  function choose(event) {
    const row = hit(event);
    if (!row || row.pending) return;
    state.selected = row;
    root().querySelector(".viz-detail").innerHTML = `<div class="viz-detail-heading"><span>${esc(row.性別)}命</span><strong>${esc(row.公曆日期)}</strong><b>${esc(row.時辰)}</b><small>${esc(row.KEY)}</small></div>
      <div class="viz-detail-group good"><header><b>吉格</b><em>${Number(row.吉格數)} 格</em></header><p>${esc(String(row.吉格 || "無").replaceAll(",", "、"))}</p></div>
      <div class="viz-detail-group bad"><header><b>凶格</b><em>${Number(row.凶格數)} 格</em></header><p>${esc(String(row.凶格 || "無").replaceAll(",", "、"))}</p></div>
      <a class="viz-chart-link" href="${esc(row.命盤連結)}" target="_blank" rel="noopener noreferrer">開啟命盤 ↗</a>
      <small class="viz-double-hint">也可雙擊月曆中的色塊直接開啟</small>`;
    scheduleDraw();
  }

  function openChart(event) {
    const row = hit(event);
    if (row && !row.pending && row.命盤連結) window.open(row.命盤連結, "_blank", "noopener,noreferrer");
  }

  function color(good, bad) {
    const total = good + bad;
    if (!total) return "rgba(127,127,127,.09)";
    const hue = Math.round((good / total) * 120);
    const saturation = 68 + Math.min(18, total * 3);
    const lightness = 72 - Math.min(28, total * 5);
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }

  function drawBand(context, row, x, y, width, height) {
    if (!row) { context.fillStyle = "rgba(127,127,127,.055)"; context.fillRect(x, y, width, height); return; }
    context.fillStyle = color(Number(row.吉格數), Number(row.凶格數));
    context.fillRect(x, y, width, height);
    if (state.selected?.KEY === row.KEY) {
      context.strokeStyle = "#fff"; context.lineWidth = 1.5; context.strokeRect(x + .75, y + .75, width - 1.5, height - 1.5);
    }
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
    const height = scroller.clientHeight;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--panel");
    context.fillRect(0, 0, width, height);
    const top = scroller.scrollTop;
    const bottom = top + height;
    const side = 14;
    const columnWidth = Math.max(34, (width - side * 2) / 7);
    const visibleMonths = state.months.filter((month) => month.top + month.height >= top && month.top <= bottom);
    if (visibleMonths.length) {
      const firstDate = `${visibleMonths[0].year}-${pad(visibleMonths[0].month + 1)}-01`;
      const lastMonth = visibleMonths.at(-1);
      const lastDate = `${lastMonth.year}-${pad(lastMonth.month + 1)}-${pad(lastMonth.days)}`;
      ensureDates(state.dates.indexOf(firstDate), state.dates.indexOf(lastDate));
    }
    for (const month of visibleMonths) drawMonth(context, month, top, side, columnWidth, width);
  }

  function drawMonth(context, month, scrollTop, side, columnWidth, width) {
    const y = month.top - scrollTop;
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink");
    const muted = getComputedStyle(document.documentElement).getPropertyValue("--muted");
    const line = getComputedStyle(document.documentElement).getPropertyValue("--line");
    context.textAlign = "left"; context.fillStyle = ink; context.font = '600 16px "Segoe UI",sans-serif';
    context.fillText(`${month.year} 年 ${month.month + 1} 月`, side, y + 23);
    context.font = '11px "Segoe UI",sans-serif'; context.textAlign = "center"; context.fillStyle = muted;
    WEEKDAYS.forEach((day, index) => context.fillText(day, side + index * columnWidth + columnWidth / 2, y + MONTH_TITLE + 16));
    for (let day = 1; day <= month.days; day += 1) {
      const position = month.startDay + day - 1;
      const column = position % 7;
      const week = Math.floor(position / 7);
      const x = side + column * columnWidth;
      const cellY = y + MONTH_TITLE + WEEKDAY_HEIGHT + week * DAY_HEIGHT;
      const date = `${month.year}-${pad(month.month + 1)}-${pad(day)}`;
      context.strokeStyle = line; context.lineWidth = .6; context.strokeRect(x + .5, cellY + .5, columnWidth - 1, DAY_HEIGHT - 1);
      context.textAlign = "left"; context.fillStyle = ink; context.font = '600 10px "Segoe UI",sans-serif'; context.fillText(String(day), x + 5, cellY + 13);
      if (date === localDate()) { context.fillStyle = "#0078d4"; context.fillRect(x + columnWidth - 12, cellY + 5, 6, 6); }
      for (let hour = 0; hour < HOURS.length; hour += 1) {
        const bandY = cellY + DAY_HEADER + hour * HOUR_HEIGHT;
        if (state.mode === "女＋男") {
          drawBand(context, state.byCell.get(key(date, hour, "男")), x + 2, bandY, columnWidth / 2 - 3, HOUR_HEIGHT - 1);
          drawBand(context, state.byCell.get(key(date, hour, "女")), x + columnWidth / 2 + 1, bandY, columnWidth / 2 - 3, HOUR_HEIGHT - 1);
        } else {
          drawBand(context, state.byCell.get(key(date, hour, state.mode)), x + 2, bandY, columnWidth - 4, HOUR_HEIGHT - 1);
        }
      }
    }
    context.strokeStyle = line; context.beginPath(); context.moveTo(side, y + month.height - MONTH_GAP / 2); context.lineTo(width - side, y + month.height - MONTH_GAP / 2); context.stroke();
  }

  function init({ metadata, query }) {
    state.metadata = metadata; state.query = query; shell();
  }
  window.BAZI_VISUALIZATION = {
    init,
    activate() { requestAnimationFrame(() => { if (!state.positioned) scrollToCurrentDate(); scheduleDraw(); }); },
    redraw: scheduleDraw,
  };
})();
