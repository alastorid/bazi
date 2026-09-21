(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ident = (v) => '"'+String(v).replaceAll('"','""')+'"';
  const literal = (v) => v == null ? 'NULL' : "'"+String(v).replaceAll("'","''")+"'";
  const number = (v) => Number(v).toLocaleString('zh-TW');
  const state = {table:'命盤總覽',columns:[],filters:[],search:'',page:0,size:100,sort:'公曆日期',direction:'ASC',generation:0,rows:[],count:0};
  let query,metadata,openSql,timer,filterId=0;
  const columns = () => metadata.tables[state.table];
  const numeric = name => columns().find(c=>c.name===name)?.type !== 'TEXT';
  const operators = {eq:'等於',ne:'不等於',contains:'包含',notcontains:'不包含',in:'屬於其中',notin:'不屬於其中',gt:'大於',gte:'大於或等於',lt:'小於',lte:'小於或等於',between:'介於',empty:'是空值',notempty:'不是空值'};
  const defaultColumns = ['KEY','公曆日期','時辰','性別','全域PR','評選合格','吉宮數','壯年吉限年數','壯年風險年數','首次吉限年齡','吉格數','凶格數','命盤連結'];
  const fieldType = name => numeric(name) ? '數值' : '文字';
  function where(skipId) {
    const terms=[];
    if (state.search.trim()) {
      const searchable=columns().filter(c=>c.type==='TEXT' && /KEY|日期|名稱|主星|吉格|凶格|相關星曜/.test(c.name)).map(c=>c.name);
      const fields=searchable.length?searchable:columns().filter(c=>c.type==='TEXT').slice(0,12).map(c=>c.name);
      if(fields.length) terms.push('('+fields.map(c=>`contains(COALESCE(${ident(c)},''),${literal(state.search.trim())})`).join(' OR ')+')');
    }
    for(const f of state.filters) {
      if(f.id===skipId) continue;
      const col=ident(f.field);
      if(f.op==='empty') {terms.push(`(${col} IS NULL${numeric(f.field)?'':` OR ${col}=''`})`);continue;}
      if(f.op==='notempty') {terms.push(`(${col} IS NOT NULL${numeric(f.field)?'':` AND ${col}<>''`})`);continue;}
      if(['in','notin'].includes(f.op)) {
        if(!f.values.length) continue;
        const values=f.values.filter(v=>v!==null);
        const pieces=[];
        if(values.length) pieces.push(`${col} ${f.op==='in'?'IN':'NOT IN'} (${values.map(literal).join(',')})`);
        if(f.values.includes(null)) pieces.push(`${col} IS ${f.op==='in'?'':'NOT '}NULL`);
        terms.push('('+pieces.join(f.op==='in'?' OR ':' AND ')+')');continue;
      }
      if(f.value===''||f.op==='between'&&f.to==='') continue;
      if(numeric(f.field)&&(!Number.isFinite(Number(f.value))||f.op==='between'&&!Number.isFinite(Number(f.to)))) continue;
      if(f.op==='contains'||f.op==='notcontains') terms.push(`${f.op==='notcontains'?'NOT ':''}contains(CAST(${col} AS VARCHAR),${literal(f.value)})`);
      else if(f.op==='between') terms.push(`${col} BETWEEN ${literal(f.value)} AND ${literal(f.to)}`);
      else terms.push(`${col} ${{eq:'=',ne:'<>',gt:'>',gte:'>=',lt:'<',lte:'<='}[f.op]} ${literal(f.value)}`);
    }
    return terms.length?' WHERE '+terms.join(' AND '):'';
  }
  function sql(paged=false) {
    const extra=['KEY','規則ID','維度','年齡','星曜'].filter(n=>n!==state.sort&&columns().some(c=>c.name===n)).map(n=>`, ${ident(n)} ASC`).join('');
    return `SELECT ${state.columns.map(ident).join(', ')}\nFROM ${ident(state.table)}${where()}${state.sort?`\nORDER BY ${ident(state.sort)} ${state.direction}${extra}`:''}${paged?`\nLIMIT ${state.size} OFFSET ${state.page*state.size}`:''}`;
  }
  function shell() {
    $('#databaseWorkspace').innerHTML=`<div class="browser-shell">
      <aside class="filter-rail">
        <div class="rail-heading"><span class="eyebrow">資料探索</span><span class="small-dot"></span></div>
        <label class="field-caption" for="browseTable">資料表</label><select id="browseTable">${['命盤總覽',...Object.keys(metadata.tables).filter(n=>n!=='命盤總覽')].map(n=>`<option>${esc(n)}</option>`).join('')}</select>
        <div class="rail-divider"></div>
        <div class="rail-heading"><h2>篩選條件</h2><button id="clearFilters" class="text-button">重設</button></div>
        <p class="rail-note">同時符合以下條件</p>
        <div id="filterList"></div>
        <button id="addFilter" class="add-filter">＋ 新增條件</button>
        <div class="rail-bottom"><span id="schemaInfo"></span><button id="browseSubset">合格子集排名 ↗</button><button id="browseSql">⌘ 在 SQL 中開啟 <span>↗</span></button></div>
      </aside>
      <section class="browse-main">
        <header class="browse-heading"><div><div class="eyebrow">資料瀏覽</div><h1 id="browseTitle">命盤總覽 <span class="title-dot"></span></h1></div><div class="browse-actions"><button id="chooseColumns">▥ 欄位 <span id="visibleCount"></span></button><button id="browseExport">↓ 匯出</button></div></header>
        <div class="browse-metrics" id="browseMetrics"><div><span>符合筆數</span><strong>—</strong></div><div><span>資料範圍</span><strong>${esc(metadata.year)}</strong></div></div>
        <div class="browse-toolbar"><div class="search-box"><span>⌕</span><input type="search" id="browseSearch" placeholder="搜尋日期、主星、格局或識別碼" aria-label="搜尋資料"></div><span id="browseState" role="status">載入中…</span></div>
        <div class="browse-grid" id="browseGrid" tabindex="0" aria-label="資料表，可水平捲動"><table><thead id="browseHead"></thead><tbody id="browseRows"></tbody></table><div id="browseEmpty" hidden>沒有符合條件的資料</div></div>
        <footer class="browse-pager"><span id="browsePageInfo"></span><div><label>每頁 <select id="browseSize"><option>50</option><option selected>100</option><option>250</option><option>500</option></select> 筆</label><button id="browsePrev" aria-label="上一頁">←</button><span id="browsePage">1</span><button id="browseNext" aria-label="下一頁">→</button></div></footer>
      </section>
    </div><dialog id="browseDialog" class="browse-dialog"></dialog><div id="browseMenu" class="browse-menu" hidden></div>`;
    $('#browseTable').addEventListener('change',e=>{state.table=e.target.value;resetTable();refresh();});
    $('#addFilter').onclick=fieldPicker;
    $('#clearFilters').onclick=()=>{state.filters=[];state.search='';state.page=0;$('#browseSearch').value='';renderFilters();refresh();};
    $('#chooseColumns').onclick=columnPicker;
    $('#browseSql').onclick=()=>openSql(sql(false)+';');
    $('#browseSubset').onclick=()=>openSql(`SELECT "KEY","命盤連結","公曆日期","時辰","性別","全域PR",RANK() OVER(ORDER BY "全域名次") AS "子集名次",COUNT(*) OVER() AS "子集樣本",CASE WHEN COUNT(*) OVER()=1 THEN 100 ELSE ROUND(100.0*(1-(RANK() OVER(ORDER BY "全域名次")-1.0)/(COUNT(*) OVER()-1)),2) END AS "子集PR" FROM (SELECT * FROM "命盤總覽"${where()}) WHERE "評選合格"=1 ORDER BY "全域名次","KEY";`);
    $('#browseExport').onclick=exportRows;
    $('#browseSearch').oninput=e=>{state.search=e.target.value;state.page=0;debounce();};
    $('#browseSize').onchange=e=>{state.size=Number(e.target.value);state.page=0;refresh();};
    $('#browsePrev').onclick=()=>{state.page=Math.max(0,state.page-1);refresh();};
    $('#browseNext').onclick=()=>{state.page++;refresh();};
    $('#browseHead').onclick=e=>{
      const button=e.target.closest('[data-sort]');
      if(button) {state.direction=state.sort===button.dataset.sort&&state.direction==='ASC'?'DESC':'ASC';state.sort=button.dataset.sort;refresh();}
      const menu=e.target.closest('[data-field-menu]');if(menu) fieldMenu(menu.dataset.fieldMenu,menu.getBoundingClientRect());
    };
    $('#browseRows').oncontextmenu=e=>{
      const cell=e.target.closest('td[data-column]');if(!cell)return;e.preventDefault();
      const value=state.rows[Number(cell.parentElement.dataset.row)][cell.dataset.column];
      showMenu([{label:'只顯示此值',action:()=>addFilter(cell.dataset.column,value===null?'empty':'eq',value)},
        {label:'排除此值',action:()=>addFilter(cell.dataset.column,value===null?'notempty':'ne',value)},
        {label:'複製內容',action:()=>navigator.clipboard.writeText(String(value??''))}],{left:e.clientX,bottom:e.clientY});
    };
    document.addEventListener('click',e=>{if(!e.target.closest('#browseMenu,[data-field-menu]'))$('#browseMenu').hidden=true;});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#browseMenu').hidden=true;});
    $('#browseDialog').addEventListener('click',e=>{if(e.target===$('#browseDialog'))$('#browseDialog').close();});
  }
  function resetTable() {
    state.filters=[];state.search='';state.page=0;
    state.columns=state.table==='命盤總覽'?defaultColumns.filter(n=>columns().some(c=>c.name===n)):columns().slice(0,10).map(c=>c.name);
    state.sort=columns().some(c=>c.name==='公曆日期')?'公曆日期':columns()[0].name;state.direction='ASC';
    $('#browseSearch').value='';$('#browseTitle').textContent=state.table;
    $('#schemaInfo').textContent=`${number(columns().length)} 個可查詢欄位`;
    $('#browseSubset').hidden=state.table!=='命盤總覽';
    renderFilters();
  }
  const debounce=()=>{clearTimeout(timer);timer=setTimeout(refresh,300);};
  async function refresh() {
    const generation=++state.generation;
    $('#browseState').textContent='查詢中…';$('#browseGrid').setAttribute('aria-busy','true');
    $('#browsePrev').disabled=$('#browseNext').disabled=true;
    const isOverview=state.table==='命盤總覽';
    try {
      const result=await query(sql(true));
      const aggregate=await query(`SELECT COUNT(*) AS "筆數"${isOverview?',SUM("吉格數") AS "吉格",SUM("凶格數") AS "凶格",MAX("最高稀有度") AS "稀有度"':''} FROM ${ident(state.table)}${where()}`);
      if(generation!==state.generation)return;
      state.rows=result.rows;state.count=Number(aggregate.rows[0].筆數);
      if(state.page&&state.page*state.size>=state.count){state.page=0;return refresh();}
      const agg=aggregate.rows[0];
      $('#browseMetrics').innerHTML=`<div><span>符合筆數</span><strong>${number(state.count)}<small>筆</small></strong></div>`+(isOverview?`<div class="metric-good"><span>吉格命中</span><strong>${number(agg.吉格??0)}<small>次</small></strong></div><div class="metric-bad"><span>凶格命中</span><strong>${number(agg.凶格??0)}<small>次</small></strong></div><div class="metric-rare"><span>最高結構稀有度</span><strong>${agg.稀有度?'✦'.repeat(agg.稀有度):'—'}</strong></div>`:`<div><span>資料欄位</span><strong>${columns().length}<small>欄</small></strong></div>`);
      $('#browseHead').innerHTML='<tr><th class="index-cell">#</th>'+state.columns.map(name=>`<th><div class="column-heading"><button data-sort="${esc(name)}">${esc(name)} <span>${state.sort===name?(state.direction==='ASC'?'↑':'↓'):''}</span></button><button data-field-menu="${esc(name)}" aria-label="${esc(name)}欄位操作">⌄</button></div></th>`).join('')+'</tr>';
      $('#browseRows').innerHTML=state.rows.map((row,i)=>`<tr data-row="${i}"><th class="index-cell">${number(state.page*state.size+i+1)}</th>${state.columns.map(name=>`<td data-column="${esc(name)}" class="${numeric(name)?'numeric':''}">${cell(name,row[name])}</td>`).join('')}</tr>`).join('');
      $('#browseEmpty').hidden=state.rows.length>0;
      $('#browseState').textContent=`${result.elapsedMs} 毫秒 · ${state.filters.length?state.filters.length+' 個條件':'全部資料'}`;
      $('#visibleCount').textContent=state.columns.length;
      $('#browsePageInfo').textContent=state.count?`${number(state.page*state.size+1)}–${number(state.page*state.size+state.rows.length)} ／ ${number(state.count)} 筆`:'0 筆';
      $('#browsePage').textContent=`${state.page+1} ／ ${Math.max(1,Math.ceil(state.count/state.size))}`;
      $('#browsePrev').disabled=state.page===0;$('#browseNext').disabled=(state.page+1)*state.size>=state.count;
      state.filters.filter(f=>f.expanded&&['in','notin'].includes(f.op)).forEach(f=>loadValues(f,$(`[data-value-search="${f.id}"]`)?.value??''));
    }catch(error){if(generation===state.generation){$('#browseState').textContent='查詢失敗：'+error.message;}}
    finally {if(generation===state.generation)$('#browseGrid').setAttribute('aria-busy','false');}
  }
  function cell(name,value) {
    if(name==='全域PR'&&value==null)return '<span class="empty-cell">未達門檻</span>';
    if(name==='評選合格')return value?'合格':'未達門檻';
    if(value==null)return '<span class="empty-cell">—</span>';
    if(name==='全域PR')return `<span class="pr-cell"><i style="width:${Math.max(0,Math.min(100,Number(value)))}%"></i><b>${Number(value).toFixed(1)}</b></span>`;
    if(name==='命盤連結'&&/^https:\/\/metisziwei\.com\/chart\?/.test(value))return `<a class="chart-link" href="${esc(value)}" target="_blank" rel="noopener noreferrer">開啟命盤 ↗</a>`;
    if(['吉格數','凶格數'].includes(name))return `<span class="count-badge ${name==='吉格數'?'good':'bad'} ${value?'':'zero'}">${esc(value)}</span>`;
    if(name==='最高稀有度'||name==='結構稀有度')return `<span class="rarity" title="結構稀有度 ${esc(value)}">${'✦'.repeat(Math.max(0,Math.min(5,Number(value))))}</span>`;
    if(name==='吉凶')return `<span class="count-badge ${value==='吉'?'good':value==='凶'?'bad':''}">${esc(value)}</span>`;
    if(name==='性別')return `<span class="gender-tag ${value==='女'?'female':'male'}">${esc(value)}</span>`;
    if(name==='吉格'||name==='凶格')return `<span class="pattern-text ${name==='吉格'?'good':'bad'}">${esc(value)}</span>`;
    return esc(value);
  }
  function addFilter(field,op,value='') {
    const f={id:++filterId,field,op:op||(numeric(field)?'gte':'in'),value:value??'',to:'',values:[],expanded:true};
    state.filters.push(f);state.page=0;renderFilters();
    if(['in','notin'].includes(f.op))loadValues(f);else refresh();
  }
  function renderFilters() {
    $('#filterList').innerHTML=state.filters.length?state.filters.map(f=>{
      const set=['in','notin'].includes(f.op);
      return `<article class="filter-card" data-filter="${f.id}"><div class="filter-card-head"><button data-expand="${f.id}">${esc(f.field)} <span>${f.expanded?'⌃':'⌄'}</span></button><button data-remove="${f.id}" aria-label="移除${esc(f.field)}篩選">×</button></div>${f.expanded?`<select data-op="${f.id}" aria-label="${esc(f.field)}比較方式">${Object.entries(operators).filter(([op])=>numeric(f.field)?!['contains','notcontains'].includes(op):!['gt','gte','lt','lte'].includes(op)).map(([op,label])=>`<option value="${op}" ${op===f.op?'selected':''}>${label}</option>`).join('')}</select>${set?`<input data-value-search="${f.id}" type="search" placeholder="搜尋選項" aria-label="搜尋${esc(f.field)}選項"><div class="value-options" id="values${f.id}"><span>載入選項…</span></div>`:['empty','notempty'].includes(f.op)?'':`<input data-value="${f.id}" value="${esc(f.value)}" type="${numeric(f.field)?'number':'text'}" placeholder="輸入${esc(f.field)}" aria-label="${esc(f.field)}條件值">${f.op==='between'?`<input data-to="${f.id}" value="${esc(f.to)}" type="${numeric(f.field)?'number':'text'}" placeholder="結束值" aria-label="${esc(f.field)}結束值">`:''}`}`:`<button class="filter-summary" data-expand="${f.id}">${operators[f.op]} ${esc(set?f.values.map(v=>v??'空值').join('、'):f.value+(f.op==='between'?' — '+f.to:''))}</button>`}</article>`;
    }).join(''):'<div class="filters-empty"><span>⌁</span><p>從一個條件開始</p><small>篩選日期、星曜或吉凶格</small></div>';
    const list=$('#filterList');
    list.onclick=e=>{
      const remove=e.target.closest('[data-remove]');if(remove){state.filters=state.filters.filter(f=>f.id!==Number(remove.dataset.remove));state.page=0;renderFilters();refresh();return;}
      const expand=e.target.closest('[data-expand]');if(expand){const f=state.filters.find(f=>f.id===Number(expand.dataset.expand));f.expanded=!f.expanded;renderFilters();}
    };
    list.onchange=e=>{
      if(e.target.dataset.op){const f=state.filters.find(f=>f.id===Number(e.target.dataset.op));f.op=e.target.value;renderFilters();state.page=0;refresh();}
      if(e.target.dataset.option!==undefined){const f=state.filters.find(f=>f.id===Number(e.target.dataset.for));const value=JSON.parse(e.target.dataset.option);f.values=e.target.checked?[...f.values,value]:f.values.filter(v=>v!==value);state.page=0;refresh();}
    };
    list.oninput=e=>{
      for(const key of ['value','to'])if(e.target.dataset[key]){const f=state.filters.find(f=>f.id===Number(e.target.dataset[key]));f[key]=e.target.value;state.page=0;debounce();}
      if(e.target.dataset.valueSearch){const f=state.filters.find(f=>f.id===Number(e.target.dataset.valueSearch));loadValues(f,e.target.value);}
    };
    state.filters.filter(f=>f.expanded&&['in','notin'].includes(f.op)).forEach(f=>loadValues(f));
  }
  async function loadValues(f,search='') {
    const request=f.valueRequest=(f.valueRequest??0)+1;
    const clause=where(f.id);
    try {
      const result=await query(`SELECT ${ident(f.field)} AS "值",COUNT(*) AS "次數" FROM ${ident(state.table)}${clause}${search?`${clause?' AND ':' WHERE '}contains(CAST(${ident(f.field)} AS VARCHAR),${literal(search)})`:''} GROUP BY ${ident(f.field)} ORDER BY "次數" DESC,"值" LIMIT 100`);
      if(request!==f.valueRequest||!$('#values'+f.id))return;
      const values=[...f.values.filter(v=>!result.rows.some(r=>r.值===v)).map(v=>({值:v,次數:null})),...result.rows];
      $('#values'+f.id).innerHTML=values.map(r=>`<label><input type="checkbox" data-for="${f.id}" data-option="${esc(JSON.stringify(r.值))}" ${f.values.includes(r.值)?'checked':''}><span>${esc(r.值??'空值')}</span><small>${r.次數==null?'已選':number(r.次數)}</small></label>`).join('')+(result.rows.length===100?'<small class="value-note">顯示前 100 個值；可搜尋其他值</small>':'')||'<small>沒有可選值</small>';
    }catch(error){if($('#values'+f.id))$('#values'+f.id).textContent=error.message;}
  }
  function dialog(title,content) {
    const d=$('#browseDialog');d.innerHTML=`<header><h2>${title}</h2><button id="closeBrowseDialog" aria-label="關閉">×</button></header>${content}`;d.showModal();$('#closeBrowseDialog').onclick=()=>d.close();return d;
  }
  function fieldPicker() {
    dialog('新增篩選條件','<input id="fieldSearch" type="search" placeholder="搜尋欄位名稱" aria-label="搜尋篩選欄位"><div class="field-list" id="fieldList"></div>');
    const render=()=>{$('#fieldList').innerHTML=columns().filter(c=>c.name.toLowerCase().includes($('#fieldSearch').value.toLowerCase())).map(c=>`<button data-field="${esc(c.name)}"><span>${esc(c.name)}</span><small>${fieldType(c.name)}</small><span>＋</span></button>`).join('');};
    $('#fieldSearch').oninput=render;render();$('#fieldSearch').focus();
    $('#fieldList').onclick=e=>{const b=e.target.closest('[data-field]');if(b){$('#browseDialog').close();addFilter(b.dataset.field);}};
  }
  function columnPicker() {
    dialog('顯示欄位','<input id="columnSearch" type="search" placeholder="搜尋欄位" aria-label="搜尋顯示欄位"><div class="column-presets"><button id="columnsDefault">預設欄位</button><button id="columnsAll">全部欄位</button></div><div class="field-list" id="columnList"></div><footer><span id="columnCount"></span><button class="primary-button" id="applyColumns">套用欄位</button></footer>');
    const selected=new Set(state.columns);
    const render=()=>{$('#columnList').innerHTML=columns().filter(c=>c.name.toLowerCase().includes($('#columnSearch').value.toLowerCase())).map(c=>`<label><input type="checkbox" value="${esc(c.name)}" ${selected.has(c.name)?'checked':''}><span>${esc(c.name)}</span><small>${fieldType(c.name)}</small></label>`).join('');$('#columnCount').textContent=`已選 ${selected.size} 個欄位`;};
    $('#columnSearch').oninput=render;
    $('#columnList').onchange=e=>{e.target.checked?selected.add(e.target.value):selected.delete(e.target.value);$('#columnCount').textContent=`已選 ${selected.size} 個欄位`;$('#applyColumns').disabled=!selected.size;};
    $('#columnsAll').onclick=()=>{columns().forEach(c=>selected.add(c.name));$('#applyColumns').disabled=false;render();};
    $('#columnsDefault').onclick=()=>{selected.clear();(state.table==='命盤總覽'?defaultColumns:columns().slice(0,10).map(c=>c.name)).forEach(c=>selected.add(c));$('#applyColumns').disabled=false;render();};
    $('#applyColumns').onclick=()=>{state.columns=[...selected];$('#browseDialog').close();refresh();};render();
  }
  function showMenu(items,rect) {
    const menu=$('#browseMenu');menu.innerHTML=items.map((item,i)=>`<button data-action="${i}">${esc(item.label)}</button>`).join('');menu.hidden=false;
    menu.style.left=Math.max(8,Math.min(rect.left,innerWidth-210))+'px';menu.style.top=Math.max(8,Math.min(rect.bottom+4,innerHeight-menu.offsetHeight-8))+'px';
    menu.onclick=e=>{const b=e.target.closest('[data-action]');if(b){menu.hidden=true;items[Number(b.dataset.action)].action();}};
  }
  function fieldMenu(field,rect) {
    showMenu([{label:'↑ 遞增排序',action:()=>{state.sort=field;state.direction='ASC';refresh();}},
      {label:'↓ 遞減排序',action:()=>{state.sort=field;state.direction='DESC';refresh();}},
      {label:'篩選此欄位…',action:()=>addFilter(field)},
      ...(state.columns.length>1?[{label:'隱藏此欄位',action:()=>{state.columns=state.columns.filter(c=>c!==field);refresh();}}]:[])],rect);
  }
  async function exportRows() {
    const b=$('#browseExport');b.disabled=true;b.textContent='匯出中…';
    try {
      const result=await query(sql());const csvCell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
      const text='\uFEFF'+[result.columns,...result.rows.map(r=>result.columns.map(c=>r[c]))].map(row=>row.map(csvCell).join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`bazi-${state.table}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){$('#browseState').textContent='匯出失敗：'+error.message;}finally{b.disabled=false;b.textContent='↓ 匯出';}
  }
  window.BAZI_BROWSER={async init(options){({query,metadata,openSql}=options);shell();resetTable();await refresh();}};
})();
