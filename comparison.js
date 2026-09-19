(() => {
  'use strict';
  let query,showWorkspace,ready=false,generation=0;
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n).toFixed(2).replace(/\.00$/,'');
  async function compare() {
    const a=$('#compareA').value.trim(),b=$('#compareB').value.trim();
    if(!a||!b)return;
    const version=++generation;$('#compareState').textContent='讀取預算明細…';$('#compareRun').disabled=true;$('#compareResults').innerHTML='';$('#compareResults').setAttribute('aria-busy','true');
    try {
      const [charts,palaces,stars]=await Promise.all([
        query('SELECT m."KEY",m."命盤連結",m."公曆日期",m."時辰",m."性別",r."百分位",r."排名序",r."加權分" FROM "命盤" m JOIN "命盤排名" r USING("KEY") WHERE m."KEY" IN (?,?)',[a,b]),
        query(`SELECT a."宮位",a."原始作用" AS "甲作用",b."原始作用" AS "乙作用",a."宮位權重" AS "權重",a."主星補償" AS "甲主星補償",b."主星補償" AS "乙主星補償",ROUND(a."加權作用"-b."加權作用",6) AS "差值" FROM "命盤比較宮位" a JOIN "命盤比較宮位" b ON a."宮位"=b."宮位" WHERE a."KEY"=? AND b."KEY"=? ORDER BY CASE a."宮位" WHEN '命宮' THEN 0 WHEN '財帛' THEN 1 WHEN '官祿' THEN 2 WHEN '遷移' THEN 3 ELSE 4 END,a."宮位"`,[a,b]),
        query(`WITH a AS (SELECT * FROM "命盤比較星曜" WHERE "KEY"=?),b AS (SELECT * FROM "命盤比較星曜" WHERE "KEY"=?)
          SELECT COALESCE(a."宮位",b."宮位") AS "宮位",COALESCE(a."星曜",b."星曜") AS "星曜",a."亮度" AS "甲亮度",b."亮度" AS "乙亮度",a."四化" AS "甲四化",b."四化" AS "乙四化",COALESCE(a."單星作用",0) AS "甲作用",COALESCE(b."單星作用",0) AS "乙作用",a."原因" AS "甲依據",b."原因" AS "乙依據" FROM a FULL OUTER JOIN b ON a."宮位"=b."宮位" AND a."星曜"=b."星曜" ORDER BY "宮位","星曜"`,[a,b]),
      ]);
      if(version!==generation)return;
      const chartA=charts.rows.find(r=>r.KEY===a),chartB=charts.rows.find(r=>r.KEY===b);
      if(!chartA||!chartB)throw new Error('找不到命盤，請從建議選項選擇完整識別碼');
      const margin=Number(chartA.加權分)-Number(chartB.加權分);
      const card=(chart,label)=>`<article class="compare-chart"><span>${label}</span><h2>${esc(chart.公曆日期)} <small>${esc(chart.時辰)} · ${esc(chart.性別)}</small></h2><p>${esc(chart.KEY)}</p><div><strong>${Number(chart.百分位).toFixed(2)}<small> 全域PR</small></strong><a href="${esc(chart.命盤連結)}" target="_blank" rel="noopener noreferrer">開啟命盤 ↗</a></div></article>`;
      $('#compareResults').innerHTML=`<div class="compare-pair">${card(chartA,'甲盤')}<div class="compare-verdict"><strong>${Math.abs(margin)<1e-6?'相同':margin>0?'甲較高':'乙較高'}</strong><span>作用差 ${fmt(margin)}</span></div>${card(chartB,'乙盤')}</div><div class="comparison-section"><h2>逐宮對照</h2><p>差值＝（甲作用－乙作用）× 宮位權重</p><div class="palace-comparisons">${palaces.rows.map(p=>`<article><header><strong>${esc(p.宮位)}</strong><span>權重 ${fmt(p.權重)}</span></header><div><span>甲 ${fmt(p.甲作用)}</span><b class="${p.差值>0?'good':p.差值<0?'bad':''}">${p.差值>0?'+':''}${fmt(p.差值)}</b><span>乙 ${fmt(p.乙作用)}</span></div><small>主星補償：甲 ${fmt(p.甲主星補償)} ／ 乙 ${fmt(p.乙主星補償)}</small></article>`).join('')}</div></div><details class="comparison-section" open><summary>逐星依據 <span>${stars.rows.length} 項</span></summary><div class="compare-stars"><table><thead><tr>${['宮位','星曜','甲亮度','乙亮度','甲四化','乙四化','甲作用','乙作用','甲依據','乙依據'].map(c=>'<th>'+c+'</th>').join('')}</tr></thead><tbody>${stars.rows.map(r=>'<tr>'+['宮位','星曜','甲亮度','乙亮度','甲四化','乙四化','甲作用','乙作用','甲依據','乙依據'].map(c=>'<td>'+esc(r[c]??'—')+'</td>').join('')+'</tr>').join('')}</tbody></table></div></details>`;
      $('#compareState').textContent=`${palaces.rows.length} 宮 · ${stars.rows.length} 項逐星依據 · 相同作用並列`;
    } catch(error){if(version===generation){$('#compareState').textContent=error.message;$('#compareResults').innerHTML='';}} finally{if(version===generation){$('#compareRun').disabled=false;$('#compareResults').setAttribute('aria-busy','false');}}
  }
  async function init(options) {
    ({query,showWorkspace}=options);
    $('#comparisonWorkspace').innerHTML=`<div class="comparison-shell"><header class="compare-heading"><div class="eyebrow">一對一比較</div><h1>兩張命盤，逐項對照。</h1><p>全域PR越高，模型內排名越前。查看每顆星、每個宮位的作用來源。</p></header><form id="compareForm"><label>甲盤<input id="compareA" list="chartSuggestionsA" placeholder="輸入日期或完整識別碼" autocomplete="off"><datalist id="chartSuggestionsA"></datalist></label><button type="button" id="compareSwap" aria-label="交換甲乙">⇄</button><label>乙盤<input id="compareB" list="chartSuggestionsB" placeholder="輸入日期或完整識別碼" autocomplete="off"><datalist id="chartSuggestionsB"></datalist></label><button id="compareRun" class="primary-button">比較命盤</button></form><p id="compareState" role="status">準備比較資料…</p><details class="comparison-peaks"><summary>頂端與底端快照</summary><div id="comparePeaks"></div></details><div id="compareResults"></div></div>`;
    $('#compareForm').onsubmit=e=>{e.preventDefault();compare();};
    $('#compareSwap').onclick=()=>{const a=$('#compareA').value;$('#compareA').value=$('#compareB').value;$('#compareB').value=a;compare();};
    for(const side of ['A','B']){
      let timer,version=0;
      $('#compare'+side).oninput=e=>{clearTimeout(timer);const text=e.target.value,request=++version;timer=setTimeout(async()=>{
        try{const result=await query('SELECT "KEY" FROM "命盤" WHERE contains("KEY",?) ORDER BY "KEY" LIMIT 24',[text]);if(request===version)$('#chartSuggestions'+side).innerHTML=result.rows.map(r=>`<option value="${esc(r.KEY)}"></option>`).join('');}catch(error){$('#compareState').textContent=error.message;}
      },250);};
    }
    const peaks=await query('SELECT * FROM "排名峰值快照" ORDER BY "總序"');
    $('#comparePeaks').innerHTML=peaks.rows.map(r=>`<div><span>${esc(r.峰別)} · ${esc(r.KEY)}</span><b>${Number(r.百分位).toFixed(2)}</b><button data-key="${esc(r.KEY)}" data-side="A">加入甲</button><button data-key="${esc(r.KEY)}" data-side="B">加入乙</button></div>`).join('');
    $('#comparePeaks').onclick=e=>{const b=e.target.closest('[data-key]');if(b){$('#compare'+b.dataset.side).value=b.dataset.key;compare();}};
    $('#compareA').value=peaks.rows[0]?.KEY??'';$('#compareB').value=peaks.rows.at(-1)?.KEY??'';ready=true;await compare();
  }
  window.BAZI_COMPARISON={init,open(key,side='A'){if(!ready)return;$('#compare'+side).value=key;showWorkspace('comparison');compare();}};
})();
