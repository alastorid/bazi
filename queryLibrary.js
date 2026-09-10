(() => {
  "use strict";
  // 查詢庫只讀取 GitHub Actions 預先生成的資料庫；瀏覽器不計算命盤或評分。
  const GROUPS = [
    ["top", "👑 綜合排名"], ["wealth", "💰 財富與經商"], ["career", "🏆 事業與官運"],
    ["talent", "📚 專業與科甲"], ["appearance", "🌸 外貌與桃花"], ["marriage", "💑 婚姻"],
    ["pattern", "🔭 格局"], ["research", "🔬 資料研究"], ["family", "🍼 婚育家庭"],
  ];
  const BASE = ['m."KEY"', 'm."命盤連結"', 'm."公曆日期"', 'm."時辰"', 'm."性別"'];
  const NAMES = { overall:"綜合", lucky:"幸運", wealth:"財富", business:"經商", social:"社交", career:"事業", power:"官運", professional:"專業", academic:"科甲", talent:"才藝", appearance:"外貌", charm:"魅力", romance:"桃花", marriage:"婚姻" };
  const rating = (dimension) => [`r."${NAMES[dimension]}分"`, `r."${NAMES[dimension]}排名"`, `r."${NAMES[dimension]}百分位"`];
  const select = ({ dimension="overall", fields=[], where="1=1", order, join="", top=1000 }) => `SELECT TOP ${top}
  ${[...BASE, ...rating(dimension), ...fields].join(",\n  ")}
FROM "命盤" m
JOIN "命盤評分" r ON r."KEY"=m."KEY"
${join}${join ? "\n" : ""}WHERE ${where}
ORDER BY ${order ?? `r."${NAMES[dimension]}分" DESC, m."公曆日期", m."時辰序號", m."性別"`};`;
  const q = (key, group, label, description, options) => ({ key, group, label, description, sql:select(options) });
  const topRank = (name) => `r."${name}排名" IN ('SSS','SSR','SS','S')`;
  const G = 'JOIN "命盤格局" g ON g."KEY"=m."KEY"';
  const hua = ['m."化祿星"','m."化祿宮位"','m."化權星"','m."化權宮位"','m."化科星"','m."化科宮位"','m."化忌星"','m."化忌宮位"'];
  const definitions = [
    q("overall_top","top","全年綜合 SSS～S","全年綜合前段，顯示四化與主要宮位。",{fields:['m."命宮主星"','m."財帛主星"','m."官祿主星"','m."夫妻主星"',...hua],where:topRank("綜合")}),
    q("lucky_top","top","幸運 SSS～S","具名吉格與日月格局的全年前段。",{dimension:"lucky",join:G,fields:['m."命宮主星"','g."紫府坐垣"','g."日月並明"','g."月朗天門"','g."日照雷門"','g."祿馬交馳"'],where:topRank("幸運")}),
    q("wealth_top","top","財富 SSS～S","大財星、權祿與罕見財格的全年前段。",{dimension:"wealth",fields:['m."財帛主星"','m."財帛全部星"','m."武曲星等"','m."貪狼星等"',...hua],where:topRank("財富")}),
    q("power_top","top","官運 SSS～S","官祿化權、紫微七殺等權力條件。",{dimension:"power",fields:['m."官祿主星"','m."官祿全部星"',...hua],where:topRank("官運")}),
    q("wealth_great","wealth","巨富格","武貪權祿坐命、巨日格、巨日會命或祿馬交馳。",{dimension:"wealth",join:G,fields:['m."命宮主星"','m."財帛主星"','g."武貪權祿坐命"','g."巨日同宮"','g."巨日會命"','g."祿馬交馳"',...hua],where:'g."武貪權祿坐命"=1 OR g."巨日同宮"=1 OR g."巨日會命"=1 OR g."祿馬交馳"=1'}),
    q("wealth_right_place","wealth","大財星入財帛","祿存、化祿、武曲、貪狼入財帛。",{dimension:"wealth",fields:['m."財帛主星"','m."財帛全部星"','m."祿存星等"','m."武曲星等"','m."貪狼星等"','m."化祿星"'],where:'m."祿存宮位"=\'財帛\' OR m."武曲宮位"=\'財帛\' OR m."貪狼宮位"=\'財帛\' OR m."化祿宮位"=\'財帛\''}),
    q("wealth_quanlu","wealth","權祿組合","財帛權祿、命宮三方權祿與官祿權財。",{dimension:"wealth",join:G,fields:['g."權祿同財帛"','g."權祿會命"','g."官祿權財"',...hua],where:'g."權祿同財帛"=1 OR g."權祿會命"=1 OR g."官祿權財"=1'}),
    q("business_risk","wealth","經商不利","財帛化忌、巨門或廉破同財帛。",{dimension:"business",join:G,fields:['m."財帛主星"','m."財帛全部星"','g."廉破同財帛"','m."化忌星"'],where:'m."化忌宮位"=\'財帛\' OR m."巨門宮位"=\'財帛\' OR g."廉破同財帛"=1',order:'r."經商分" ASC, m."公曆日期", m."時辰序號", m."性別"'}),
    q("career_power","career","化權入官祿","官祿宮最喜化權；同時顯示化祿、化忌。",{dimension:"power",fields:['m."官祿主星"','m."官祿全部星"',...hua],where:'m."化權宮位"=\'官祿\''}),
    q("career_zisha","career","紫微七殺官祿","紫微七殺同在官祿，官權壓重。",{dimension:"power",join:G,fields:['m."官祿主星"','m."紫微星等"','m."七殺星等"','g."紫微七殺官祿"'],where:'g."紫微七殺官祿"=1'}),
    q("career_professional","career","專業自由業與主管","武官化科坐命，或命宮三方科權。",{dimension:"professional",join:G,fields:['m."命宮主星"','m."命宮全部星"','g."武官化科坐命"','g."科權會命"',...hua],where:'g."武官化科坐命"=1 OR g."科權會命"=1'}),
    q("career_risk","career","官祿不利","六煞、化忌或空宮入官祿；列出六煞星等供亮度比較。",{dimension:"career",join:G,fields:['m."官祿主星"','m."官祿全部星"','m."擎羊星等"','m."陀羅星等"','m."火星星等"','m."鈴星星等"','m."天空星等"','m."地劫星等"','g."六煞入官祿"','g."官祿空宮"','m."化忌星"'],where:'g."六煞入官祿"=1 OR g."官祿空宮"=1 OR m."化忌宮位"=\'官祿\'',order:'r."事業分" ASC, m."公曆日期", m."時辰序號", m."性別"'}),
    q("academic_top","talent","科甲 SSS～S","昌曲、魁鉞與化科組合的全年前段。",{dimension:"academic",join:G,fields:['m."命宮全部星"','g."昌曲同命"','g."魁鉞會命"','g."魁鉞化科會命"','m."化科星"'],where:topRank("科甲")}),
    q("talent_changqu","talent","昌曲與太陰昌曲","昌曲同命兼具科甲才藝；太陰昌曲再加重才藝魅力。",{dimension:"talent",join:G,fields:['m."命宮主星"','m."命宮全部星"','m."太陰星等"','m."文昌星等"','m."文曲星等"','g."昌曲同命"','g."太陰昌曲同命"'],where:'g."昌曲同命"=1 OR g."太陰昌曲同命"=1'}),
    q("academic_kuiyue","talent","魁鉞化科會命","魁鉞會命及再會化科的科甲層級。",{dimension:"academic",join:G,fields:['m."天魁星等"','m."天鉞星等"','m."化科星"','m."化科宮位"','g."魁鉞會命"','g."魁鉞化科會命"'],where:'g."魁鉞會命"=1'}),
    q("appearance_moon","appearance","女命太陰與月朗天門","女命太陰坐命；亥宮廟旺另成月朗天門。",{dimension:"appearance",join:G,fields:['m."命宮"','m."命宮主星"','m."太陰星等"','g."月朗天門"'],where:'m."性別"=\'女\' AND m."太陰宮位"=\'命宮\''}),
    q("romance_top","appearance","桃花 SSS～S","紅鸞、天喜、貪狼及太陰昌曲組合。",{dimension:"romance",join:G,fields:['m."命宮主星"','m."命宮全部星"','g."紅喜同命"','g."泛水桃花"','g."太陰昌曲同命"'],where:topRank("桃花")}),
    q("charm_patterns","appearance","魅力強格","泛水桃花與太陰昌曲同命。",{dimension:"charm",join:G,fields:['m."命宮"','m."命宮主星"','m."命宮全部星"','g."泛水桃花"','g."太陰昌曲同命"'],where:'g."泛水桃花"=1 OR g."太陰昌曲同命"=1'}),
    q("marriage_best","marriage","婚姻有利組合","天府天馬、廉府、紅喜或權祿同在夫妻宮。",{dimension:"marriage",join:G,fields:['m."夫妻主星"','m."夫妻全部星"','g."天府天馬同夫"','g."廉府同夫妻"','g."紅喜同夫妻"','g."權祿同夫妻"'],where:'g."天府天馬同夫"=1 OR g."廉府同夫妻"=1 OR g."紅喜同夫妻"=1 OR g."權祿同夫妻"=1'}),
    q("marriage_risk","marriage","婚姻重大不利","廉破或廉貪同夫妻、破軍或巨門入夫妻。",{dimension:"marriage",join:G,fields:['m."夫妻主星"','m."夫妻全部星"','m."福德主星"','g."廉破同夫妻"','g."廉貪同夫妻"'],where:'g."廉破同夫妻"=1 OR g."廉貪同夫妻"=1 OR m."破軍宮位"=\'夫妻\' OR m."巨門宮位"=\'夫妻\'',order:'r."婚姻分" ASC, m."公曆日期", m."時辰序號", m."性別"'}),
    q("pattern_rare","pattern","罕見大格","紫府坐垣、七殺朝斗、日月並明、巨日與祿馬交馳。",{dimension:"lucky",join:G,fields:['m."命宮"','m."命宮主星"','g."紫府坐垣"','g."七殺朝斗"','g."日月並明"','g."巨日同宮"','g."巨日會命"','g."祿馬交馳"'],where:'g."紫府坐垣"=1 OR g."七殺朝斗"=1 OR g."日月並明"=1 OR g."巨日同宮"=1 OR g."巨日會命"=1 OR g."祿馬交馳"=1'}),
    q("pattern_sunmoon","pattern","日月格局","月朗天門、日照雷門、日麗中天、日月夾命與反背夾命。",{dimension:"lucky",join:G,fields:['m."命宮"','m."命宮主星"','m."太陽星等"','m."太陰星等"','g."月朗天門"','g."日照雷門"','g."日麗中天"','g."日月夾命"','g."日月反背夾命"'],where:'g."月朗天門"=1 OR g."日照雷門"=1 OR g."日麗中天"=1 OR g."日月夾命"=1 OR g."日月反背夾命"=1'}),
    q("research_brightness","research","星曜亮度明細","從正規化長表比較同星同宮不同亮度。",{dimension:"wealth",join:'JOIN "星曜亮度" b ON b."KEY"=m."KEY"',fields:['b."星曜"','b."宮位"','b."星性質"','b."亮度"','b."亮度序"','b."四化"'],where:'b."星曜" IN (\'武曲\',\'貪狼\',\'太陰\',\'巨門\')'}),
    q("research_details","research","評分明細","逐條顯示每個命盤實際命中的規則與貢獻。",{fields:['d."維度"','d."類型"','d."規則ID"','d."星曜"','d."宮位"','d."亮度"','d."亮度倍率"','d."基礎作用"','d."實際貢獻"','d."說明"'],join:'JOIN "命盤評分明細" d ON d."KEY"=m."KEY"',order:'m."KEY", ABS(d."實際貢獻") DESC'}),
    q("family_best","family","家庭品質前段","讀取預計算的家庭品質、平衡、父母、婚姻與子女百分位。",{join:'JOIN "命盤家庭評分" f ON f."KEY"=m."KEY"',fields:['f."家庭品質排名"','f."家庭品質百分位"','f."家庭平衡百分位"','f."父母品質百分位"','f."父母財富百分位"','f."婚姻百分位"','f."子女百分位"','f."最佳婚姻年齡"','f."最佳婚姻年份"'],order:'f."家庭品質百分位" DESC, f."家庭平衡百分位" DESC'}),
    q("family_balanced","family","家庭平衡前段","避免單一高分掩蓋短板，依家庭平衡百分位排序。",{join:'JOIN "命盤家庭評分" f ON f."KEY"=m."KEY"',fields:['f."家庭平衡百分位"','f."家庭品質百分位"','f."父母品質百分位"','f."自身財富百分位"','f."外貌百分位"','f."婚姻百分位"','f."子女百分位"','f."父母負向分"'],order:'f."家庭平衡百分位" DESC'}),
  ];
  const queries=Object.fromEntries(definitions.map((x)=>[x.key,x.sql]));
  const labels=Object.fromEntries(definitions.map((x)=>[x.key,x.label]));
  const metadata=Object.fromEntries(definitions.map((x)=>[x.key,Object.freeze({key:x.key,group:x.group,label:x.label,description:x.description})]));
  const groups=Object.fromEntries(GROUPS.map(([id,title])=>[title,definitions.filter((x)=>x.group===id).map((x)=>x.key)]));
  window.BAZI_QUERY_LIBRARY=Object.freeze({definitions:Object.freeze(definitions),metadata:Object.freeze(metadata),queries:Object.freeze(queries),groups:Object.freeze(groups),labels:Object.freeze(labels),defaultQuery:"overall_top"});
})();
