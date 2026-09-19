// Synthetic UI fixture only; production data is generated on Actions.
import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1440,height:960}});
try {
  await page.setContent(fs.readFileSync('index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,''));
  for(const path of ['terminal.css','visualization.css','design.css'])await page.addStyleTag({path});
  await page.addScriptTag({path:'comparison.js'});
  await page.evaluate(async()=>{
    document.querySelector('.app-body').dataset.workspace='comparison';
    document.querySelectorAll('.workspace-view,.query-workspace').forEach(el=>el.classList.toggle('active',el.id==='comparisonWorkspace'));
    document.querySelectorAll('.workspace-tab').forEach(el=>el.classList.toggle('active',el.dataset.workspaceTab==='comparison'));
    document.querySelector('#runSql').hidden=true;
    const charts=[{KEY:'20260810-辰時-女',公曆日期:'2026-08-10',時辰:'辰時',性別:'女',百分位:99.98,排名序:2,加權分:31,峰別:'頂端',命盤連結:'https://metisziwei.com/chart?y=2026&m=8&d=10&h=8&mi=0&g=f'},
      {KEY:'20351219-子時-男',公曆日期:'2035-12-19',時辰:'子時',性別:'男',百分位:0,排名序:87696,加權分:-14,峰別:'底端',命盤連結:'https://metisziwei.com/chart?y=2035&m=12&d=19&h=0&mi=0&g=m'}];
    const names=['命宮','財帛','官祿','遷移','夫妻','子女','父母','兄弟','僕役','田宅','福德','疾厄'];
    await window.BAZI_COMPARISON.init({showWorkspace(){},query:async(sql,params=[])=>{
      if(sql.includes('排名峰值快照'))return {rows:charts};
      const a=charts.find(c=>c.KEY===params[0]),b=charts.find(c=>c.KEY===params[1]);
      if(sql.includes('命盤比較宮位'))return {rows:names.map(宮位=>({宮位,甲作用:a?.加權分/12,乙作用:b?.加權分/12,權重:1,甲主星補償:.5,乙主星補償:.5,差值:(a?.加權分-b?.加權分)/12}))};
      if(sql.includes('命盤比較星曜'))return {rows:names.flatMap(宮位=>['紫微','天府','左輔'].map(星曜=>({宮位,星曜,甲亮度:'廟',乙亮度:'陷',甲四化:'',乙四化:'',甲作用:3,乙作用:0,原因:'廟；依星性與亮度對照模型權重'})))};
      return {rows:charts.filter(c=>params.includes(c.KEY))};
    }});
  });
  await expect(page.locator('.palace-comparisons article')).toHaveCount(12);
  await expect(page.locator('.compare-verdict')).toContainText('甲較高');
  fs.mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/comparison-fixture.png',fullPage:true});
  await page.locator('#compareSwap').click();
  await expect(page.locator('.compare-verdict')).toContainText('乙較高');
  await page.locator('#compareB').fill(await page.locator('#compareA').inputValue());
  await page.locator('#compareRun').click();
  await expect(page.locator('.compare-verdict')).toContainText('相同');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/comparison-fixture-mobile.png',fullPage:true});
  await page.locator('#compareB').fill('不存在');
  await page.locator('#compareRun').click();
  await expect(page.locator('#compareState')).toContainText('找不到命盤');
  await expect(page.locator('#compareResults')).toBeEmpty();
  console.log('Synthetic comparison UI verified: swap, ties, invalid key, desktop/mobile layout.');
}finally{await browser.close();}
