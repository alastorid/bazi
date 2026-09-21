(() => {
  'use strict';
  let query,showWorkspace,ready=false,generation=0;
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>n==null?'—':Number(n).toFixed(2).replace(/\.00$/,'');
  const pr=r=>r.百分位==null?'未達門檻':fmt(r.百分位);
  const tone=q=>q==='吉'?'good':q==='凶'?'bad':q==='吉凶並見'?'mixed':'neutral';
  function chartCard(chart,label,periods){
    return `<article class="compare-chart"><span>${label}</span><h2>${esc(chart.公曆日期)} <small>${esc(chart.時辰)} · ${esc(chart.性別)}</small></h2>
      <p>${esc(chart.KEY)}</p><div><strong>${pr(chart)}<small> 適時PR</small></strong><a href="${esc(chart.命盤連結)}" target="_blank" rel="noopener noreferrer">開啟命盤 ↗</a></div>
      <dl class="timing-facts"><div><dt>可核對吉宮</dt><dd>${chart.吉宮數} 宮</dd></div><div><dt>壯年純吉限</dt><dd>${chart.壯年吉限年數} 年</dd></div><div><dt>壯年風險限</dt><dd>${chart.壯年風險年數} 年</dd></div><div><dt>首次吉限</dt><dd>${chart.首次吉限年齡==null?'未見':chart.首次吉限年齡+' 歲'}</dd></div></dl>
      <p class="timing-reason">${chart.評選合格?'符合公開適時門檻':esc(chart.未達門檻原因)}${chart.晚發限定?'；六十歲後才見吉限，不補成年得時分':''}</p>
      <div class="timing-periods">${periods.map(p=>`<details class="timing-period ${tone(p.判讀)}"><summary><b>${p.起始年齡}–${p.終止年齡} 歲</b><span>${esc(p.宮位)} · ${esc(p.判讀)}</span><em>${p.起始年齡>=60?'晚年另列':p.終止年齡>=60?'跨六十歲拆算':'得時作用 '+fmt(p.得時作用)}</em></summary><p>${esc(p.依據)}</p><p>年齡權重合計 ${fmt(p.年齡權重合計)}；壯年吉限 ${p.壯年吉限年數} 年，風險 ${p.壯年風險年數} 年。</p></details>`).join('')}</div></article>`;
  }
  async function compare(){
    const a=$('#compareA').value.trim(),b=$('#compareB').value.trim();if(!a||!b)return;
    const version=++generation;$('#compareState').textContent='讀取大限與判讀依據…';$('#compareRun').disabled=true;$('#compareResults').innerHTML='';$('#compareResults').setAttribute('aria-busy','true');
    try{
      const [charts,periods]=await Promise.all([
        query('SELECT m."命盤連結",m."公曆日期",m."時辰",m."性別",r.* FROM "命盤" m JOIN "命盤排名" r USING("KEY") WHERE m."KEY" IN (?,?)',[a,b]),
        query('SELECT * FROM "命盤大限明細" WHERE "KEY" IN (?,?) ORDER BY "KEY","起始年齡"',[a,b]),
      ]);
      if(version!==generation)return;
      const ca=charts.rows.find(r=>r.KEY===a),cb=charts.rows.find(r=>r.KEY===b);
      if(!ca||!cb)throw new Error('找不到命盤，請從建議選項選擇完整識別碼');
      const pa=periods.rows.filter(r=>r.KEY===a),pb=periods.rows.filter(r=>r.KEY===b);
      const verdict=ca.排名序===cb.排名序?'相同':ca.排名序<cb.排名序?'甲較前':'乙較前';
      $('#compareResults').innerHTML=`<div class="timing-verdict compare-verdict"><strong>${verdict}</strong><span>先比適時資格，再比得時分、吉宮數；不以本命星曜加總決勝。</span><span>甲得時分 ${fmt(ca.加權分)} ／ 乙得時分 ${fmt(cb.加權分)}</span></div><div class="timing-pair">${chartCard(ca,'甲盤',pa)}${chartCard(cb,'乙盤',pb)}</div>`;
      $('#compareState').textContent=`甲乙各 ${pa.length} 段大限 · 點開每段可核對原因 · 壯年指二十至四十九歲`;
    }catch(error){if(version===generation){$('#compareState').textContent=error.message;$('#compareResults').innerHTML='';}}
    finally{if(version===generation){$('#compareRun').disabled=false;$('#compareResults').setAttribute('aria-busy','false');}}
  }
  async function init(options){
    ({query,showWorkspace}=options);
    $('#comparisonWorkspace').innerHTML=`<div class="comparison-shell"><header class="compare-heading"><div class="eyebrow">命好，更須限好</div><h1>同是吉宮，何時走到？</h1><p>適時PR只比較符合門檻者；未達門檻不冒充高分。晚年優勢保留，但不補回青年與壯年。</p></header>
      <details class="timing-policy"><summary>排名口徑與公開門檻</summary><p>至少三吉宮；二十至四十九歲純吉限至少十年、風險限不超過十年；六十歲前加權吉限多於風險限。相對名次另存，PR不是人生保證。</p><p>一至十九歲權重 0.5、二十至四十九歲 1、五十至五十九歲 0.5、六十歲起 0。這些是本網站模型政策，非教材定量原文。歲數沿用來源大限，起限前年份不補算；本命宮位隨大限到達，不冒充大限飛化或流年推斷。</p><p>吉宮须有多項支持；化忌、煞曜與落陷風險獨立保留，吉凶並見不算純吉限。</p></details>
      <form id="compareForm"><label>甲盤<input id="compareA" list="chartSuggestionsA" placeholder="輸入日期或完整識別碼" autocomplete="off"><datalist id="chartSuggestionsA"></datalist></label><button type="button" id="compareSwap" aria-label="交換甲乙">⇄</button><label>乙盤<input id="compareB" list="chartSuggestionsB" placeholder="輸入日期或完整識別碼" autocomplete="off"><datalist id="chartSuggestionsB"></datalist></label><button id="compareRun" class="primary-button">比較命盤</button></form><p id="compareState" role="status">準備比較資料…</p><details class="comparison-peaks"><summary>頂端與底端快照</summary><div id="comparePeaks"></div></details><div id="compareResults"></div></div>`;
    $('#compareForm').onsubmit=e=>{e.preventDefault();compare();};
    $('#compareSwap').onclick=()=>{const a=$('#compareA').value;$('#compareA').value=$('#compareB').value;$('#compareB').value=a;compare();};
    for(const side of ['A','B']){let timer,version=0;$('#compare'+side).oninput=e=>{clearTimeout(timer);const text=e.target.value,request=++version;timer=setTimeout(async()=>{try{const r=await query('SELECT "KEY" FROM "命盤" WHERE contains("KEY",?) ORDER BY "KEY" LIMIT 24',[text]);if(request===version)$('#chartSuggestions'+side).innerHTML=r.rows.map(r=>`<option value="${esc(r.KEY)}"></option>`).join('');}catch(error){$('#compareState').textContent=error.message;}},250);};}
    const peaks=await query('SELECT * FROM "排名峰值快照" ORDER BY "總序"');
    $('#comparePeaks').innerHTML=peaks.rows.map(r=>`<div><span>${esc(r.峰別)} · ${esc(r.KEY)}</span><b>${pr(r)}</b><button data-key="${esc(r.KEY)}" data-side="A">加入甲</button><button data-key="${esc(r.KEY)}" data-side="B">加入乙</button></div>`).join('');
    $('#comparePeaks').onclick=e=>{const b=e.target.closest('[data-key]');if(b){$('#compare'+b.dataset.side).value=b.dataset.key;compare();}};
    $('#compareA').value=peaks.rows[0]?.KEY??'';$('#compareB').value=peaks.rows.at(-1)?.KEY??'';ready=true;await compare();
  }
  window.BAZI_COMPARISON={init,open(key,side='A'){if(!ready)return;$('#compare'+side).value=key;showWorkspace('comparison');compare();}};
})();
