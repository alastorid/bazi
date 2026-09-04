(() => {
  "use strict";

  const GROUPS = [
    ["overall", "👑 Top / Overall"], ["wealth", "💰 Wealth"],
    ["windfall", "💥 Windfall / Business"], ["appearance", "✨ Appearance"],
    ["luck", "🍀 Luck / Comfortable Life"], ["career", "👔 Career / Power"],
    ["social", "🤝 Social"], ["family", "👶 Family / Parents"],
    ["intelligence", "🧠 Intelligence / Academic"], ["tools", "🔧 Tools"],
  ];
  const HEADER = ['"KEY"','"命盤連結"','"性別"','"綜合排名"','"綜合分"','"財富排名"','"財富分"','"幸運排名"','"幸運分"','"外貌排名"','"外貌分"'];
  const sql = ({ fields=[], where="1 = 1", order='"綜合分" DESC, "KEY"', top=1000 }) => `SELECT TOP ${top}
  ${[...HEADER, ...fields].join(",\n  ")}
FROM "命盤完整評分"
WHERE ${where}
ORDER BY ${order};`;
  const q = (key, group, label, description, rankTarget, options={}) => ({key,group,label,description,rankTarget,sql:sql(options)});
  const raw = (key, group, label, description, rankTarget, statement) => ({key,group,label,description,rankTarget,sql:statement});
  const wealth = ['"財帛主星"','"官祿主星"','"田宅主星"','"化祿宮位"','"化權宮位"','"化忌宮位"'];
  const beauty = ['"命宮主星"','"命宮全部星"','"太陰星等"','"天同星等"','"貪狼星等"'];
  const family = ['"父母主星"','"父母全部星"','"田宅主星"','"化祿宮位"','"化忌宮位"'];

  const definitions = [
    q("overall_sss","overall","綜合 SSS","全年綜合百分位前 1%","綜合",{where:'"綜合排名" = \'SSS\'',fields:['"事業排名"','"事業分"','"社交排名"','"家庭助力排名"','"福體排名"']}),
    q("overall_ssr","overall","綜合 SSR 以上","全年綜合百分位前 4%","綜合",{where:'"綜合排名" IN (\'SSS\',\'SSR\')',fields:['"事業排名"','"事業分"','"家庭助力排名"','"福體排名"']}),
    q("overall_noble","overall","紫府武相權貴","高綜合及事業排名，再驗證紫府武相命宮","綜合",{where:'"綜合排名" IN (\'SSS\',\'SSR\')\n  AND "事業排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND ("命宮主星" LIKE \'%紫微%\' OR "命宮主星" LIKE \'%天府%\' OR "命宮主星" LIKE \'%武曲%\' OR "命宮主星" LIKE \'%天相%\')',fields:['"事業排名"','"事業分"','"命宮主星"','"官祿主星"','"化權宮位"','"化科宮位"']}),
    q("overall_balanced_elite","overall","均衡菁英","綜合與四大維度均在全年前 20%","綜合",{where:'"綜合排名" IN (\'SSS\',\'SSR\',\'SS\',\'S\')\n  AND "財富排名" IN (\'SSS\',\'SSR\',\'SS\',\'S\')\n  AND "幸運排名" IN (\'SSS\',\'SSR\',\'SS\',\'S\')\n  AND "外貌排名" IN (\'SSS\',\'SSR\',\'SS\',\'S\')\n  AND "事業排名" IN (\'SSS\',\'SSR\',\'SS\',\'S\')',fields:['"事業排名"','"事業分"','"社交排名"','"家庭助力排名"','"福體排名"']}),
    q("overall_no_weakness","overall","無明顯弱項","七個核心維度皆不低於 A","綜合",{where:['財富','幸運','外貌','事業','社交','家庭助力','福體'].map(n=>`"${n}排名" IN ('SSS','SSR','SS','S','A')`).join('\n  AND '),fields:['"事業排名"','"事業分"','"社交排名"','"社交分"','"家庭助力排名"','"福體排名"']}),
    q("overall_top","overall","綜合 TOP 100","依綜合分列出全年前 100","綜合",{top:100,fields:['"事業排名"','"事業分"','"社交排名"','"社交分"','"家庭助力排名"','"福體排名"']}),

    q("wealth_sss","wealth","頂級財富","財富排名 SSS / SSR","財富",{where:'"財富排名" IN (\'SSS\',\'SSR\')',fields:wealth,order:'"財富分" DESC, "綜合分" DESC'}),
    q("wealth_income","wealth","強勁正財","高財富與事業排名，驗證武曲或天府財帛","財富",{where:'"財富排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "事業排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND (("武曲宮位"=\'財帛\' AND "武曲星等" IN (\'廟\',\'旺\')) OR ("天府宮位"=\'財帛\' AND "天府星等" IN (\'廟\',\'旺\')))',fields:['"事業排名"','"事業分"',...wealth,'"武曲星等"','"天府星等"'],order:'"財富分" DESC, "事業分" DESC'}),
    q("wealth_asset","wealth","資產型富命","高財富與家庭助力，田宅具資產型主星","財富",{where:'"財富排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "家庭助力排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND ("田宅主星" LIKE \'%天府%\' OR "田宅主星" LIKE \'%太陰%\' OR "田宅主星" LIKE \'%武曲%\')',fields:['"家庭助力排名"','"家庭助力分"',...wealth],order:'"財富分" DESC, "家庭助力分" DESC'}),
    q("wealth_storage","wealth","守財聚庫","高財富盤再驗證財帛或田宅祿存","財富",{where:'"財富排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND ("財帛全部星" LIKE \'%祿存%\' OR "田宅全部星" LIKE \'%祿存%\')\n  AND "化忌宮位" NOT IN (\'財帛\',\'田宅\')',fields:[...wealth,'"財帛全部星"','"田宅全部星"'],order:'"財富分" DESC'}),
    q("wealth_property","wealth","田宅資產王","高財富盤中田宅財庫星廟旺","財富",{where:'"財富排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND (("太陰宮位"=\'田宅\' AND "太陰星等" IN (\'廟\',\'旺\')) OR ("天府宮位"=\'田宅\' AND "天府星等" IN (\'廟\',\'旺\')) OR ("武曲宮位"=\'田宅\' AND "武曲星等" IN (\'廟\',\'旺\')))',fields:[...wealth,'"田宅全部星"','"太陰星等"','"天府星等"','"武曲星等"'],order:'"財富分" DESC'}),

    q("windfall_sss","windfall","頂級爆發財","橫財排名 SSS / SSR；與長期財富分開","橫財",{where:'"橫財排名" IN (\'SSS\',\'SSR\')',fields:['"橫財排名"','"橫財分"','"財帛主星"','"財帛全部星"','"貪狼星等"','"化祿宮位"','"化權宮位"','"化忌宮位"'],order:'"橫財分" DESC, "財富分" DESC'}),
    q("windfall_fire_greed","windfall","火貪財格","火星與貪狼必須同在財帛宮","橫財",{where:'"橫財排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "貪狼宮位"=\'財帛\' AND "財帛全部星" LIKE \'%火星%\'',fields:['"橫財排名"','"橫財分"','"財帛主星"','"財帛全部星"','"貪狼星等"','"化祿宮位"','"化權宮位"','"化忌宮位"'],order:'"橫財分" DESC, "財富分" DESC'}),
    q("windfall_fire_greed_sss","windfall","超級火貪","火貪、貪狼廟旺，並得祿或祿存","橫財",{where:'"橫財排名" IN (\'SSS\',\'SSR\')\n  AND "貪狼宮位"=\'財帛\' AND "貪狼星等" IN (\'廟\',\'旺\')\n  AND "財帛全部星" LIKE \'%火星%\'\n  AND ("化祿宮位"=\'財帛\' OR "財帛全部星" LIKE \'%祿存%\')\n  AND "化忌宮位"<>\'財帛\'',fields:['"橫財排名"','"橫財分"','"財帛主星"','"財帛全部星"','"貪狼星等"','"化祿宮位"','"化權宮位"','"化忌宮位"'],order:'"橫財分" DESC'}),
    q("windfall_bell_greed","windfall","鈴貪財格","鈴星與貪狼必須同在財帛宮","橫財",{where:'"橫財排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "貪狼宮位"=\'財帛\' AND "財帛全部星" LIKE \'%鈴星%\'',fields:['"橫財排名"','"橫財分"','"財帛主星"','"財帛全部星"','"貪狼星等"','"化祿宮位"','"化權宮位"','"化忌宮位"'],order:'"橫財分" DESC'}),
    q("business_elite","windfall","商業型富命","高橫財、財富與社交排名","橫財",{where:'"橫財排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "財富排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "社交排名" IN (\'SSS\',\'SSR\',\'SS\',\'S\')',fields:['"橫財排名"','"橫財分"','"社交排名"','"社交分"','"財帛主星"','"遷移主星"'],order:'"橫財分" DESC, "財富分" DESC'}),
    q("business_entrepreneur","windfall","創業開創","高事業與橫財，再驗證殺破狼或武曲官祿","事業",{where:'"事業排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "橫財排名" IN (\'SSS\',\'SSR\',\'SS\',\'S\')\n  AND ("官祿主星" LIKE \'%七殺%\' OR "官祿主星" LIKE \'%破軍%\' OR "官祿主星" LIKE \'%貪狼%\' OR "官祿主星" LIKE \'%武曲%\')',fields:['"事業排名"','"事業分"','"橫財排名"','"橫財分"','"官祿主星"','"財帛主星"','"化權宮位"'],order:'"事業分" DESC, "橫財分" DESC'}),

    q("appearance_sss","appearance","頂級外貌","外貌排名 SSS / SSR","外貌",{where:'"外貌排名" IN (\'SSS\',\'SSR\')',fields:beauty,order:'"外貌分" DESC'}),
    q("appearance_sweet","appearance","甜妹高顏值","高外貌排名並驗證天同命宮","外貌",{where:'"外貌排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "天同宮位"=\'命宮\'',fields:beauty,order:'"外貌分" DESC, "幸運分" DESC'}),
    q("appearance_elegant","appearance","氣質型","高外貌排名並驗證太陰或昌曲命宮","外貌",{where:'"外貌排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND ("太陰宮位"=\'命宮\' OR "命宮全部星" LIKE \'%文昌%\' OR "命宮全部星" LIKE \'%文曲%\')',fields:beauty,order:'"外貌分" DESC'}),
    q("appearance_glamour","appearance","魅力型","高外貌與社交，驗證貪狼或廉貞","外貌",{where:'"外貌排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "社交排名" IN (\'SSS\',\'SSR\',\'SS\',\'S\')\n  AND ("命宮主星" LIKE \'%貪狼%\' OR "命宮主星" LIKE \'%廉貞%\')',fields:['"社交排名"','"社交分"',...beauty],order:'"外貌分" DESC, "社交分" DESC'}),
    q("appearance_noble","appearance","貴氣顏值","高外貌及綜合，驗證紫微或天相","外貌",{where:'"外貌排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "綜合排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND ("命宮主星" LIKE \'%紫微%\' OR "命宮主星" LIKE \'%天相%\')',fields:beauty,order:'"外貌分" DESC, "綜合分" DESC'}),
    q("appearance_rich","appearance","又美又有錢","外貌與財富都在全年前 10%","外貌",{where:'"外貌排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "財富排名" IN (\'SSS\',\'SSR\',\'SS\')',fields:[...beauty,...wealth],order:'"綜合分" DESC'}),

    q("luck_sss","luck","超級幸運","幸運排名 SSS / SSR","幸運",{where:'"幸運排名" IN (\'SSS\',\'SSR\')',fields:['"福體排名"','"福體分"','"命宮主星"','"福德主星"','"化祿宮位"','"化科宮位"','"化忌宮位"'],order:'"幸運分" DESC'}),
    q("luck_noble_support","luck","貴人助力","高幸運與社交排名，檢視左右魁鉞","幸運",{where:'"幸運排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "社交排名" IN (\'SSS\',\'SSR\',\'SS\',\'S\')',fields:['"社交排名"','"社交分"','"命宮全部星"','"遷移全部星"','"父母全部星"'],order:'"幸運分" DESC, "社交分" DESC'}),
    q("luck_smooth_life","luck","人生順遂","幸運與福體菁英，核心宮避忌","幸運",{where:'"幸運排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "福體排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "化忌宮位" NOT IN (\'命宮\',\'福德\',\'疾厄\')',fields:['"福體排名"','"福體分"','"命宮主星"','"福德主星"','"化忌宮位"'],order:'"幸運分" DESC, "福體分" DESC'}),
    q("luck_comfortable_rich","luck","富足舒服","財富、幸運、福體都在全年前 10%","幸運",{where:'"財富排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "幸運排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "福體排名" IN (\'SSS\',\'SSR\',\'SS\')',fields:['"福體排名"','"福體分"',...wealth],order:'"綜合分" DESC'}),

    q("career_sss","career","頂級事業","事業排名 SSS / SSR","事業",{where:'"事業排名" IN (\'SSS\',\'SSR\')',fields:['"事業排名"','"事業分"','"命宮主星"','"官祿主星"','"化權宮位"','"化科宮位"'],order:'"事業分" DESC'}),
    q("career_leadership","career","權貴領導","高事業並驗證領導星與化權","事業",{where:'"事業排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "化權宮位" IN (\'命宮\',\'官祿\')\n  AND ("命宮主星" LIKE \'%紫微%\' OR "命宮主星" LIKE \'%武曲%\' OR "官祿主星" LIKE \'%七殺%\' OR "官祿主星" LIKE \'%破軍%\')',fields:['"事業排名"','"事業分"','"命宮主星"','"官祿主星"','"化權宮位"'],order:'"事業分" DESC'}),
    q("career_professional","career","專業菁英","高事業與幸運，官祿得科","事業",{where:'"事業排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "幸運排名" IN (\'SSS\',\'SSR\',\'SS\',\'S\')\n  AND "化科宮位" IN (\'命宮\',\'官祿\')',fields:['"事業排名"','"事業分"','"官祿主星"','"官祿全部星"','"化科星"','"化科宮位"'],order:'"事業分" DESC'}),

    q("social_sss","social","頂級社交","社交排名 SSS / SSR","社交",{where:'"社交排名" IN (\'SSS\',\'SSR\')',fields:['"社交排名"','"社交分"','"命宮主星"','"僕役主星"','"遷移主星"'],order:'"社交分" DESC'}),
    q("social_popular","social","人氣桃花","高社交與外貌排名","社交",{where:'"社交排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "外貌排名" IN (\'SSS\',\'SSR\',\'SS\',\'S\')',fields:['"社交排名"','"社交分"','"命宮全部星"','"僕役全部星"','"夫妻全部星"'],order:'"社交分" DESC, "外貌分" DESC'}),
    q("social_network_power","social","人脈權力","高社交與事業排名","社交",{where:'"社交排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "事業排名" IN (\'SSS\',\'SSR\',\'SS\')',fields:['"社交排名"','"社交分"','"事業排名"','"事業分"','"僕役全部星"','"遷移全部星"'],order:'"社交分" DESC, "事業分" DESC'}),

    q("family_sss","family","頂級家庭助力","家庭助力排名 SSS / SSR","家庭助力",{where:'"家庭助力排名" IN (\'SSS\',\'SSR\')',fields:['"家庭助力排名"','"家庭助力分"',...family],order:'"家庭助力分" DESC'}),
    q("family_parents","family","旺父母","高家庭助力排名，檢視父母宮","家庭助力",{where:'"家庭助力排名" IN (\'SSS\',\'SSR\',\'SS\')',fields:['"家庭助力排名"','"家庭助力分"',...family],order:'"家庭助力分" DESC'}),
    q("family_wealth","family","家運帶財","家庭助力與財富都在全年前 10%","家庭助力",{where:'"家庭助力排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "財富排名" IN (\'SSS\',\'SSR\',\'SS\')',fields:['"家庭助力排名"','"家庭助力分"',...family,'"財帛主星"'],order:'"家庭助力分" DESC, "財富分" DESC'}),
    q("family_property","family","家族田宅強","高家庭助力，田宅具府陰武或祿存","家庭助力",{where:'"家庭助力排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND ("田宅主星" LIKE \'%天府%\' OR "田宅主星" LIKE \'%太陰%\' OR "田宅主星" LIKE \'%武曲%\' OR "田宅全部星" LIKE \'%祿存%\')',fields:['"家庭助力排名"','"家庭助力分"',...family,'"田宅全部星"'],order:'"家庭助力分" DESC'}),

    q("smart_sss","intelligence","聰明賺錢","高事業與財富，驗證機巨日昌曲","事業",{where:'"事業排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "財富排名" IN (\'SSS\',\'SSR\',\'SS\',\'S\')\n  AND ("命宮主星" LIKE \'%天機%\' OR "命宮主星" LIKE \'%巨門%\' OR "命宮主星" LIKE \'%太陽%\' OR "命宮全部星" LIKE \'%文昌%\' OR "命宮全部星" LIKE \'%文曲%\')',fields:['"事業排名"','"事業分"','"命宮主星"','"命宮全部星"','"官祿主星"'],order:'"事業分" DESC, "財富分" DESC'}),
    q("smart_academic","intelligence","學業菁英","高事業與幸運，驗證昌曲或化科","事業",{where:'"事業排名" IN (\'SSS\',\'SSR\',\'SS\')\n  AND "幸運排名" IN (\'SSS\',\'SSR\',\'SS\',\'S\')\n  AND ("命宮全部星" LIKE \'%文昌%\' OR "命宮全部星" LIKE \'%文曲%\' OR "化科宮位" IN (\'命宮\',\'官祿\'))',fields:['"事業排名"','"事業分"','"命宮全部星"','"官祿全部星"','"化科星"','"化科宮位"'],order:'"事業分" DESC'}),

    q("tools_top","tools","TOP 1000","完整評分 view 的前 1000 筆","綜合",{fields:['"公曆日期"','"時辰"','"命宮主星"','"財帛主星"','"官祿主星"']}),
    q("tools_sihua","tools","核心宮四化","查看四化星與落宮，仍帶固定排名表頭","綜合",{fields:['"化祿星"','"化祿宮位"','"化權星"','"化權宮位"','"化科星"','"化科宮位"','"化忌星"','"化忌宮位"']}),
    q("tools_daxian","tools","十二宮大限","查看十二宮大限欄位","綜合",{fields:['"命宮大限"','"兄弟大限"','"夫妻大限"','"子女大限"','"財帛大限"','"疾厄大限"','"遷移大限"','"僕役大限"','"官祿大限"','"田宅大限"','"福德大限"','"父母大限"']}),
    q("tools_key","tools","KEY 反查","以生辰與性別 KEY 精準反查","綜合",{where:'"KEY"=\'20270810-子時-女\'',fields:['"公曆日期"','"時辰"','"命宮"','"身宮"','"命宮主星"']}),
    raw("tools_score_distribution","tools","分數分布","主要分數的最低、平均與最高","診斷",`SELECT ROUND(MIN("綜合分"),2) AS "綜合最低", ROUND(AVG("綜合分"),2) AS "綜合平均", ROUND(MAX("綜合分"),2) AS "綜合最高",
  ROUND(MIN("財富分"),2) AS "財富最低", ROUND(AVG("財富分"),2) AS "財富平均", ROUND(MAX("財富分"),2) AS "財富最高",
  ROUND(MIN("橫財分"),2) AS "橫財最低", ROUND(AVG("橫財分"),2) AS "橫財平均", ROUND(MAX("橫財分"),2) AS "橫財最高"
FROM "命盤評分";`),
    raw("tools_rank_distribution","tools","排名分布","各綜合排名的全年筆數","診斷",`SELECT "綜合排名", COUNT(*) AS "數量", ROUND(COUNT(*)*100.0/(SELECT COUNT(*) FROM "命盤評分"),2) AS "百分比"
FROM "命盤評分" GROUP BY "綜合排名"
ORDER BY CASE "綜合排名" WHEN 'SSS' THEN 1 WHEN 'SSR' THEN 2 WHEN 'SS' THEN 3 WHEN 'S' THEN 4 WHEN 'A' THEN 5 WHEN 'B' THEN 6 WHEN 'C' THEN 7 WHEN 'D' THEN 8 WHEN 'E' THEN 9 ELSE 10 END;`),
    raw("tools_rules","tools","評分規則","檢視可配置規則與權重","診斷",`SELECT TOP 1000 "規則ID", "維度", "類型", "權重", "說明", "條件SQL"
FROM "評分規則" ORDER BY "維度", "規則ID";`),
  ];

  const queries=Object.fromEntries(definitions.map(x=>[x.key,x.sql]));
  const labels=Object.fromEntries(definitions.map(x=>[x.key,x.label]));
  const metadata=Object.fromEntries(definitions.map(x=>[x.key,Object.freeze({key:x.key,group:x.group,label:x.label,description:x.description,rankTarget:x.rankTarget})]));
  const groups=Object.fromEntries(GROUPS.map(([id,title])=>[title,definitions.filter(x=>x.group===id).map(x=>x.key)]));
  window.BAZI_QUERY_LIBRARY=Object.freeze({definitions:Object.freeze(definitions),metadata:Object.freeze(metadata),queries:Object.freeze(queries),groups:Object.freeze(groups),labels:Object.freeze(labels),defaultQuery:"overall_top"});
})();
