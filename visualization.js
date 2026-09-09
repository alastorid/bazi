(() => {
  "use strict";
  const METRICS = {
    family:["Family Quality","家庭品質百分位"], balance:["Family Balance","家庭平衡百分位"],
    parents:["Parents Quality","父母品質百分位"], parentsWealth:["Parents Wealth","父母財富百分位"],
    selfWealth:["Self Wealth","自身財富百分位"], appearance:["Appearance","外貌百分位"],
    romance:["Romance","戀愛百分位"], marriage:["Marriage","婚姻百分位"], children:["Children","子女百分位"],
    geju:["Formation","格局百分位"], wealth:["Wealth","財富百分位"], career:["Career","事業百分位"],
    kin:["Kinship","六親百分位"], exam:["Academic","科甲百分位"], health:["Health","健康百分位"], overall:["Overall","綜合百分位"],
  };
  const FILTERS = [["父母品質百分位","Parents"],["自身財富百分位","Wealth"],["外貌百分位","Appearance"],["婚姻百分位","Marriage"],["子女百分位","Children"]];
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
        <label>Year<select id id="vizYear"><option>${state.year}</option></select></label>
        <label>Gender<select id="vizGender"><option>女</option><option>男</option></select></label>
        <label>Metric<select id="vizMetric">${Object.entries(METRICS).map(([key,[label]])=>`<option value="${key}">${label}</option>`).join("")}</select></label>
        <label>Ranking<select id="vizRanking"><option value="weighted">Weighted Family PR</option><option value="balanced">Balanced Family PR</option></select></label>
        <div class="viz-legend"><span>0</span><span class="viz-gradient"></span><span>100 PR</span></div>
      </div>
      <details class="viz-filter"><summary>Minimum filters — cells remain visible but fade</summary><div>${FILTERS.map(([column,label])=>`<label>${label}<input type="number" min="0" max="100" placeholder="0" data-filter="${esc(column)}"></label>`).join("")}<span class="viz-note">Each row is one gender-specific chart; adjacent clock hours may share the same two-hour 時辰 chart.</span></div></details>
      <div class="viz-layout"><div class="viz-chart-wrap"><div class="viz-loading">Loading month…</div></div><aside class="viz-side"><section class="viz-card"><h3>Top Times</h3><div class="viz-card-body viz-top-list"></div></section><section class="viz-card"><h3>Birth Time Details</h3><div class="viz-card-body viz-detail"><span class="viz-empty">Select a heatmap cell.</span></div></section></aside></div>
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
    root().querySelector(".viz-chart-wrap").innerHTML='<div class="viz-loading">Loading month…</div>';
    const sql=`SELECT m."KEY",m."公曆日期",m."日",m."時辰",m."時辰序號",m."性別",m."命盤連結",m."命宮主星",m."父母主星",m."子女主星",m."真子女宮主星",
      f."家庭品質百分位",f."家庭平衡百分位",f."父母品質百分位",f."父母財富百分位",f."自身財富百分位",f."外貌百分位",f."戀愛百分位",f."婚姻百分位",f."子女百分位",
      f."父母負向分",f."最佳婚姻年齡",f."最佳婚姻年份",f."婚姻窗口起始年齡",f."婚姻窗口結束年齡",f."真子女宮有主星",f."真子女宮來源",f."婚姻主要原因",f."子女主要原因",
      r."格局百分位",r."財富百分位",r."事業百分位",r."六親百分位",r."科甲百分位",r."健康百分位",r."綜合百分位"
      FROM "命盤" m JOIN "命盤家庭評分" f ON f."KEY"=m."KEY" JOIN "命盤評分" r ON r."KEY"=m."KEY"
      WHERE m."年"=${state.year} AND m."月"=${state.month} AND m."性別"='${state.gender}' ORDER BY m."日",m."時辰序號";`;
    const result=await state.query(sql);state.rows=result.rows;state.loaded=true;state.selected=null;render();
  }

  function render(){
    if(!state.loaded)return;
    root().querySelector(".viz-month-title").textContent=`${state.year}-${String(state.month).padStart(2,"0")}`;
    const days=new Date(Date.UTC(state.year,state.month,0)).getUTCDate(),cw=18,ch=14,ox=34,oy=20,w=ox+days*cw+8,h=oy+24*ch+19;
    const expanded=state.rows.flatMap((row)=>hoursFor(Number(row.時辰序號)).map((hour)=>({...row,_hour:hour})));
    const cells=expanded.map((row)=>{const score=value(row),filtered=!passes(row),selected=state.selected?.KEY===row.KEY;return `<rect class="viz-cell${filtered?" filtered":""}${selected?" selected":""}" data-key="${esc(row.KEY)}" data-hour="${row._hour}" x="${ox+(Number(row.日)-1)*cw}" y="${oy+row._hour*ch}" width="${cw}" height="${ch}" fill="${color(score)}"><title>${esc(row.公曆日期)} ${String(row._hour).padStart(2,"0")}:00 · ${esc(METRICS[state.metric][0])} PR ${score.toFixed(2)}</title></rect>`;}).join("");
    const xlabels=Array.from({length:days},(_,i)=>i+1).filter((d)=>d===1||d%2===0).map((d)=>`<text class="viz-axis" x="${ox+(d-.5)*cw}" y="12" text-anchor="middle">${d}</text>`).join("");
    const ylabels=Array.from({length:24},(_,i)=>`<text class="viz-axis" x="28" y="${oy+i*ch+10}" text-anchor="end">${String(i).padStart(2,"0")}</text>`).join("");
    root().querySelector(".viz-chart-wrap").innerHTML=`<svg class="viz-heatmap" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${state.year}-${state.month} date by 24 hour heatmap">${xlabels}${ylabels}${cells}<text class="viz-axis" x="${ox}" y="${h-2}">Date → · Hour ↓ · ${esc(METRICS[state.metric][0])} (${state.ranking==="balanced"&&state.metric==="family"?"Balanced":"Weighted"})</text></svg>`;
    bindCells(expanded);
    const unique=[...state.rows].filter(passes).sort((a,b)=>value(b)-value(a)||String(a.KEY).localeCompare(String(b.KEY))).slice(0,10);
    root().querySelector(".viz-top-list").innerHTML=unique.map((row,i)=>`<button type="button" data-top="${esc(row.KEY)}"><span>${i+1}</span><span>${esc(row.公曆日期.slice(5))} ${String(Number(row.時辰序號)*2).padStart(2,"0")}:00 · ${esc(row.時辰)}</span><strong>${value(row).toFixed(2)}</strong></button>`).join("")||'<span class="viz-empty">No cells pass the current minimums.</span>';
    root().querySelectorAll("[data-top]").forEach((button)=>button.addEventListener("click",()=>select(state.rows.find((row)=>row.KEY===button.dataset.top))));
    if(state.selected){const fresh=state.rows.find((row)=>row.KEY===state.selected.KEY);if(fresh)select(fresh,false);}
    else if(unique[0])select(unique[0],false);
  }

  function bindCells(expanded){
    const tip=root().querySelector(".viz-tooltip");
    root().querySelectorAll(".viz-cell").forEach((cell)=>{
      const row=expanded.find((item)=>item.KEY===cell.dataset.key&&item._hour===Number(cell.dataset.hour));
      cell.addEventListener("mouseenter",()=>{tip.hidden=false;tip.textContent=`${row.公曆日期} ${String(row._hour).padStart(2,"0")}:00 · ${row.性別}\nFamily ${Number(row.家庭品質百分位).toFixed(1)} · Parents ${Number(row.父母品質百分位).toFixed(1)}\nParents Wealth ${Number(row.父母財富百分位).toFixed(1)} · Self Wealth ${Number(row.自身財富百分位).toFixed(1)}\nAppearance ${Number(row.外貌百分位).toFixed(1)} · Romance ${Number(row.戀愛百分位).toFixed(1)}\nMarriage ${Number(row.婚姻百分位).toFixed(1)} · Children ${Number(row.子女百分位).toFixed(1)}`;});
      cell.addEventListener("mousemove",(event)=>{tip.style.left=`${event.clientX+12}px`;tip.style.top=`${event.clientY+12}px`;});
      cell.addEventListener("mouseleave",()=>{tip.hidden=true;});
      cell.addEventListener("click",()=>select(row));
      cell.addEventListener("dblclick",()=>window.open(row.命盤連結,"_blank","noopener"));
    });
  }

  async function select(row,rerender=true){
    if(!row)return;state.selected=row;
    if(rerender)root().querySelectorAll(".viz-cell").forEach((cell)=>cell.classList.toggle("selected",cell.dataset.key===row.KEY));
    const bars=[["Parents",row.父母品質百分位],["Wealth",row.自身財富百分位],["Appearance",row.外貌百分位],["Romance",row.戀愛百分位],["Marriage",row.婚姻百分位],["Children",row.子女百分位]];
    const detail=root().querySelector(".viz-detail");
    detail.innerHTML=`<div class="viz-detail-head"><div><strong>${esc(row.公曆日期)} · ${esc(row.時辰)} · ${esc(row.性別)}</strong><br><small>${esc(row.KEY)}</small></div><a href="${esc(row.命盤連結)}" target="_blank" rel="noopener noreferrer">Open Metis Chart ↗</a></div>
      <div class="viz-bars">${bars.map(([label,score])=>`<div class="viz-bar"><span>${label}</span><span class="viz-bar-track"><span class="viz-bar-fill" style="width:${Number(score)}%"></span></span><span class="viz-bar-value">${Number(score).toFixed(1)}</span></div>`).join("")}</div>
      <div><b>Marriage window</b> ${row.婚姻窗口起始年齡}–${row.婚姻窗口結束年齡} · best ${row.最佳婚姻年齡} (${row.最佳婚姻年份})</div>
      <div><b>Parents</b> ${esc(row.父母主星||"空宮")} · risk ${Number(row.父母負向分).toFixed(1)}</div>
      <div><b>Children</b> ${esc(row.真子女宮主星||"—")} · ${esc(row.真子女宮來源)}</div><div class="viz-loading">Loading scoring reasons…</div>`;
    const result=await state.query(`SELECT "組件","星曜","宮位","亮度","實際貢獻","年齡","年份","說明" FROM "命盤家庭評分明細" WHERE "KEY"='${row.KEY}' ORDER BY ABS("實際貢獻") DESC LIMIT 14;`);
    if(state.selected?.KEY!==row.KEY)return;
    const reasons=result.rows.map((item)=>`<li><b>${esc(item.組件)}</b> ${esc(item.說明)}${item.亮度?` · ${esc(item.亮度)}`:""}${item.年齡?` · age ${item.年齡}`:""} <span>${Number(item.實際貢獻)>=0?"+":""}${Number(item.實際貢獻).toFixed(2)}</span></li>`).join("");
    detail.querySelector(".viz-loading").outerHTML=`<ul class="viz-reasons">${reasons}</ul>`;
  }

  async function init({metadata,query}){state.metadata=metadata;state.year=metadata.year;state.query=query;shell();await loadMonth();}
  window.BAZI_VISUALIZATION={init,activate(){if(!state.loaded&&state.query)loadMonth();}};
})();
