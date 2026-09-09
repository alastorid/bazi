(() => {
  "use strict";
  const METRICS = {
    family:["家庭品質","家庭品質百分位"], balance:["家庭平衡","家庭平衡百分位"],
    parents:["父母品質","父母品質百分位"], parentsWealth:["父母財富","父母財富百分位"], selfWealth:["自身財富","自身財富百分位"],
    lucky:["幸運","命盤幸運百分位"], wealth:["財富","命盤財富百分位"], business:["經商","命盤經商百分位"], social:["社交","命盤社交百分位"],
    career:["事業","命盤事業百分位"], power:["官運","命盤官運百分位"], professional:["專業","命盤專業百分位"], academic:["科甲","命盤科甲百分位"],
    talent:["才藝","命盤才藝百分位"], appearance:["外貌","命盤外貌百分位"], charm:["魅力","命盤魅力百分位"], romance:["桃花","命盤桃花百分位"],
    marriage:["婚姻","命盤婚姻百分位"], children:["子女","子女百分位"], overall:["綜合","命盤綜合百分位"],
  };
  const FILTERS = [["父母品質百分位","父母品質"],["自身財富百分位","自身財富"],["外貌百分位","外貌"],["婚姻百分位","婚姻"],["子女百分位","子女"]];
  const esc=(v)=>String(v??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const state={query:null,metadata:null,year:null,month:3,gender:"女",metric:"family",ranking:"weighted",rows:[],selected:null,filters:{},loaded:false};
  const root=()=>document.querySelector("#visualizationView");
  const q=(name)=>`"${name.replaceAll('"','""')}"`;
  const hoursFor=(index)=>index===0?[0,23]:[index*2-1,index*2];
  const metricColumn=()=>state.metric==="family"&&state.ranking==="balanced"?"家庭平衡百分位":METRICS[state.metric][1];
  const value=(row,column=metricColumn())=>Number(row[column]??0);
  const passes=(row)=>FILTERS.every(([column])=>state.filters[column]===""||state.filters[column]===undefined||Number(row[column])>=Number(state.filters[column]));
  const color=(score)=>`hsl(210 ${35+score*.53}% ${96-score*.53}%)`;

  function shell(){
    root().innerHTML=`<div class="viz-shell">
      <div class="viz-controls">
        <button type="button" data-month="-1">←</button><span class="viz-month-title"></span><button type="button" data-month="1">→</button>
        <label>年份<select id="vizYear"><option>${state.year}</option></select></label>
        <label>性別<select id="vizGender"><option>女</option><option>男</option></select></label>
        <label>指標<select id="vizMetric">${Object.entries(METRICS).map(([key,[label]])=>`<option value="${key}">${label}</option>`).join("")}</select></label>
        <label>家庭排序<select id="vizRanking"><option value="weighted">家庭品質百分位</option><option value="balanced">家庭平衡百分位</option></select></label>
        <div class="viz-legend"><span>0</span><span class="viz-gradient"></span><span>百分位 100</span></div>
      </div>
      <details class="viz-filter"><summary>最低百分位篩選（未達者保留但淡化）</summary><div>${FILTERS.map(([column,label])=>`<label>${label}<input type="number" min="0" max="100" placeholder="0" data-filter="${esc(column)}"></label>`).join("")}<span class="viz-note">每列為一張指定性別命盤；相鄰時鐘小時可能屬於同一個兩小時時辰。</span></div></details>
      <div class="viz-layout"><div class="viz-chart-wrap"><div class="viz-loading">載入月份中…</div></div><aside class="viz-side"><section class="viz-card"><h3>最佳時段</h3><div class="viz-card-body viz-top-list"></div></section><section class="viz-card"><h3>出生時段明細</h3><div class="viz-card-body viz-detail"><span class="viz-empty">請選擇熱圖格。</span></div></section></aside></div>
      <div class="viz-tooltip" hidden></div>
    </div>`;
    root().querySelector("#vizGender").value=state.gender;
    root().querySelector("#vizMetric").value=state.metric;
    root().querySelector("#vizRanking").value=state.ranking;
    root().querySelectorAll("[data-month]").forEach((button)=>button.addEventListener("click",()=>{state.month+=Number(button.dataset.month);if(state.month<1)state.month=12;if(state.month>12)state.month=1;loadMonth();}));
    root().querySelector("#vizGender").addEventListener("change",(e)=>{state.gender=e.target.value;loadMonth();});
    root().querySelector("#vizMetric").addEventListener("change",(e)=>{state.metric=e.target.value;render();});
    root().querySelector("#vizRanking").addEventListener("change",(e)=>{state.ranking=e.target.value;render();});
    root().querySelectorAll("[data-filter]").forEach((input)=>input.addEventListener("input",(e)=>{state.filters[e.target.dataset.filter]=e.target.value;render();}));
  }

  async function loadMonth(){
    root().querySelector(".viz-month-title").textContent=`${state.year}-${String(state.month).padStart(2,"0")}`;
    root().querySelector(".viz-chart-wrap").innerHTML='<div class="viz-loading">載入月份中…</div>';
    const sql=`SELECT m."KEY",m."公曆日期",m."日",m."時辰",m."時辰序號",m."性別",m."命盤連結",m."命宮主星",m."父母主星",m."子女主星",m."真子女宮主星",
      f."家庭品質百分位",f."家庭平衡百分位",f."父母品質百分位",f."父母財富百分位",f."自身財富百分位",f."外貌百分位",f."戀愛百分位",f."婚姻百分位",f."子女百分位",
      f."父母負向分",f."最佳婚姻年齡",f."最佳婚姻年份",f."婚姻窗口起始年齡",f."婚姻窗口結束年齡",f."真子女宮有主星",f."真子女宮來源",f."婚姻主要原因",f."子女主要原因",
      r."幸運百分位" AS "命盤幸運百分位",r."財富百分位" AS "命盤財富百分位",r."經商百分位" AS "命盤經商百分位",r."社交百分位" AS "命盤社交百分位",r."事業百分位" AS "命盤事業百分位",r."官運百分位" AS "命盤官運百分位",r."專業百分位" AS "命盤專業百分位",r."科甲百分位" AS "命盤科甲百分位",r."才藝百分位" AS "命盤才藝百分位",r."外貌百分位" AS "命盤外貌百分位",r."魅力百分位" AS "命盤魅力百分位",r."桃花百分位" AS "命盤桃花百分位",r."婚姻百分位" AS "命盤婚姻百分位",r."綜合百分位" AS "命盤綜合百分位"
      FROM "命盤" m JOIN "命盤家庭評分" f ON f."KEY"=m."KEY" JOIN "命盤評分" r ON r."KEY"=m."KEY"
      WHERE m."年"=${state.year} AND m."月"=${state.month} AND m."性別"='${state.gender}' ORDER BY m."日",m."時辰序號";`;
    const result=await state.query(sql);state.rows=result.rows;state.loaded=true;state.selected=null;render();
  }

  function render(){
    if(!state.loaded)return;
    root().querySelector(".viz-month-title").textContent=`${state.year}-${String(state.month).padStart(2,"0")}`;
    const days=new Date(Date.UTC(state.year,state.month,0)).getUTCDate(),cw=18,ch=14,ox=34,oy=20,w=ox+days*cw+8,h=oy+24*ch+19;
    const expanded=state.rows.flatMap((row)=>hoursFor(Number(row.時辰序號)).map((hour)=>({...row,_hour:hour})));
    const cells=expanded.map((row)=>{const score=value(row),filtered=!passes(row),selected=state.selected?.KEY===row.KEY;return `<rect class="viz-cell${filtered?" filtered":""}${selected?" selected":""}" data-key="${esc(row.KEY)}" data-hour="${row._hour}" x="${ox+(Number(row.日)-1)*cw}" y="${oy+row._hour*ch}" width="${cw}" height="${ch}" fill="${color(score)}"><title>${esc(row.公曆日期)} ${String(row._hour).padStart(2,"0")}:00 · ${esc(METRICS[state.metric][0])}百分位 ${score.toFixed(2)}</title></rect>`;}).join("");
    const xlabels=Array.from({length:days},(_,i)=>i+1).filter((d)=>d===1||d%2===0).map((d)=>`<text class="viz-axis" x="${ox+(d-.5)*cw}" y="12" text-anchor="middle">${d}</text>`).join("");
    const ylabels=Array.from({length:24},(_,i)=>`<text class="viz-axis" x="28" y="${oy+i*ch+10}" text-anchor="end">${String(i).padStart(2,"0")}</text>`).join("");
    root().querySelector(".viz-chart-wrap").innerHTML=`<svg class="viz-heatmap" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${state.year} 年 ${state.month} 月日期與二十四小時熱圖">${xlabels}${ylabels}${cells}<text class="viz-axis" x="${ox}" y="${h-2}">日期 → · 小時 ↓ · ${esc(METRICS[state.metric][0])}${state.metric==="family"?`（${state.ranking==="balanced"?"平衡":"品質"}）`:""}</text></svg>`;
    bindCells(expanded);
    const unique=[...state.rows].filter(passes).sort((a,b)=>value(b)-value(a)||String(a.KEY).localeCompare(String(b.KEY))).slice(0,10);
    root().querySelector(".viz-top-list").innerHTML=unique.map((row,i)=>`<button type="button" data-top="${esc(row.KEY)}"><span>${i+1}</span><span>${esc(row.公曆日期.slice(5))} ${String(Number(row.時辰序號)*2).padStart(2,"0")}:00 · ${esc(row.時辰)}</span><strong>${value(row).toFixed(2)}</strong></button>`).join("")||'<span class="viz-empty">沒有時段符合目前門檻。</span>';
    root().querySelectorAll("[data-top]").forEach((button)=>button.addEventListener("click",()=>select(state.rows.find((row)=>row.KEY===button.dataset.top))));
    if(state.selected){const fresh=state.rows.find((row)=>row.KEY===state.selected.KEY);if(fresh)select(fresh,false);}
    else if(unique[0])select(unique[0],false);
  }

  function bindCells(expanded){
    const tip=root().querySelector(".viz-tooltip");
    root().querySelectorAll(".viz-cell").forEach((cell)=>{
      const row=expanded.find((item)=>item.KEY===cell.dataset.key&&item._hour===Number(cell.dataset.hour));
      cell.addEventListener("mouseenter",()=>{tip.hidden=false;tip.textContent=`${row.公曆日期} ${String(row._hour).padStart(2,"0")}:00 · ${row.性別}\n家庭 ${Number(row.家庭品質百分位).toFixed(1)} · 父母 ${Number(row.父母品質百分位).toFixed(1)}\n父母財富 ${Number(row.父母財富百分位).toFixed(1)} · 自身財富 ${Number(row.自身財富百分位).toFixed(1)}\n外貌 ${Number(row.外貌百分位).toFixed(1)} · 戀愛 ${Number(row.戀愛百分位).toFixed(1)}\n婚姻 ${Number(row.婚姻百分位).toFixed(1)} · 子女 ${Number(row.子女百分位).toFixed(1)}`;});
      cell.addEventListener("mousemove",(event)=>{tip.style.left=`${event.clientX+12}px`;tip.style.top=`${event.clientY+12}px`;});
      cell.addEventListener("mouseleave",()=>{tip.hidden=true;});
      cell.addEventListener("click",()=>select(row));
      cell.addEventListener("dblclick",()=>window.open(row.命盤連結,"_blank","noopener"));
    });
  }

  async function select(row,rerender=true){
    if(!row)return;state.selected=row;
    if(rerender)root().querySelectorAll(".viz-cell").forEach((cell)=>cell.classList.toggle("selected",cell.dataset.key===row.KEY));
    const bars=[["父母",row.父母品質百分位],["財富",row.自身財富百分位],["外貌",row.外貌百分位],["戀愛",row.戀愛百分位],["婚姻",row.婚姻百分位],["子女",row.子女百分位]];
    const detail=root().querySelector(".viz-detail");
    detail.innerHTML=`<div class="viz-detail-head"><div><strong>${esc(row.公曆日期)} · ${esc(row.時辰)} · ${esc(row.性別)}</strong><br><small>${esc(row.KEY)}</small></div><a href="${esc(row.命盤連結)}" target="_blank" rel="noopener noreferrer">開啟命盤 ↗</a></div>
      <div class="viz-bars">${bars.map(([label,score])=>`<div class="viz-bar"><span>${label}</span><span class="viz-bar-track"><span class="viz-bar-fill" style="width:${Number(score)}%"></span></span><span class="viz-bar-value">${Number(score).toFixed(1)}</span></div>`).join("")}</div>
      <div><b>婚姻時段</b> ${row.婚姻窗口起始年齡}–${row.婚姻窗口結束年齡} 歲 · 最佳 ${row.最佳婚姻年齡} 歲（${row.最佳婚姻年份} 年）</div>
      <div><b>父母</b> ${esc(row.父母主星||"空宮")} · 負向分 ${Number(row.父母負向分).toFixed(1)}</div>
      <div><b>子女</b> ${esc(row.真子女宮主星||"—")} · ${esc(row.真子女宮來源)}</div><div class="viz-loading">載入評分原因中…</div>`;
    const result=await state.query(`SELECT "組件","星曜","宮位","亮度","實際貢獻","年齡","年份","說明" FROM "命盤家庭評分明細" WHERE "KEY"='${row.KEY}' ORDER BY ABS("實際貢獻") DESC LIMIT 14;`);
    if(state.selected?.KEY!==row.KEY)return;
    const reasons=result.rows.map((item)=>`<li><b>${esc(item.組件)}</b> ${esc(item.說明)}${item.亮度?` · ${esc(item.亮度)}`:""}${item.年齡?` · ${item.年齡} 歲`:""} <span>${Number(item.實際貢獻)>=0?"+":""}${Number(item.實際貢獻).toFixed(2)}</span></li>`).join("");
    detail.querySelector(".viz-loading").outerHTML=`<ul class="viz-reasons">${reasons}</ul>`;
  }

  async function init({metadata,query}){state.metadata=metadata;state.year=metadata.year;state.query=query;shell();await loadMonth();}
  window.BAZI_VISUALIZATION={init,activate(){if(!state.loaded&&state.query)loadMonth();}};
})();
