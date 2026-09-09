(() => {
  "use strict";
  const GROUPS = [
    ["overall","👑 綜合"],["wealth","💰 財富"],["appearance","👸 外貌"],["health","🌿 健康"],
    ["career","🏆 事業"],["social","🤝 社交"],["family","🏠 家庭"],["research","🔬 研究"],
  ];
  const BASE = ['m."KEY" AS "KEY"','m."命盤連結"','m."公曆日期"','m."時辰"','m."性別"'];
  const NAMES = { overall:"綜合", wealth:"財富", appearance:"外貌", health:"健康", career:"事業", social:"社交", family:"家庭助力" };
  const rating = (dimension) => [`r."${NAMES[dimension]}分"`,`r."${NAMES[dimension]}排名"`,`r."${NAMES[dimension]}百分位"`];
  const select = ({ dimension="overall", fields=[], where="1=1", order, join="", top=1000 }) => `SELECT TOP ${top}
  ${[...BASE,...rating(dimension),...fields].join(",\n  ")}
FROM "命盤" m
JOIN "命盤評分" r ON r."KEY"=m."KEY"
${join}${join ? "\n" : ""}WHERE ${where}
ORDER BY ${order ?? `r."${NAMES[dimension]}分" DESC, m."公曆日期", m."時辰序號", m."性別"`};`;
  const q = (key,group,label,description,options) => ({ key,group,label,description,sql:select(options) });
  const b = (star,palaces,min=5) => `EXISTS (SELECT 1 FROM "星曜亮度" b WHERE b."KEY"=m."KEY" AND b."星曜"='${star}' AND b."宮位" IN (${palaces.map((p)=>`'${p}'`).join(",")}) AND b."亮度序">=${min})`;
  const topRank = (name) => `r."${name}排名" IN ('SSS','SSR','SS','S')`;

  const definitions = [
    q("overall_top","overall","全年綜合前段","綜合百分位前 20%，顯示核心宮位與四化證據。",{
      fields:['m."命宮主星"','m."財帛主星"','m."官祿主星"','m."田宅主星"','m."紫微星等"','m."武曲星等"','m."天府星等"','m."太陰星等"','m."貪狼星等"','m."化祿宮位"','m."化權宮位"','m."化科宮位"','m."化忌宮位"'],where:topRank("綜合")}),
    q("overall_bright_core","overall","核心廟旺強盤","命或官有廟旺紫微、武曲或天府，且綜合位於前段。",{
      fields:['m."命宮主星"','m."官祿主星"','m."紫微星等"','m."武曲星等"','m."天府星等"','m."化祿宮位"','m."化忌宮位"'],where:`r."綜合百分位">=80 AND (${b("紫微",["命宮","官祿"],6)} OR ${b("武曲",["命宮","官祿"],6)} OR ${b("天府",["命宮","官祿"],6)})`}),
    q("overall_balanced","overall","七維均衡","七個維度均不低於全年中位。",{
      fields:['r."財富分"','r."幸運分"','r."外貌分"','r."健康分"','r."事業分"','r."社交分"','r."家庭助力分"'],where:'r."財富百分位">=50 AND r."幸運百分位">=50 AND r."外貌百分位">=50 AND r."健康百分位">=50 AND r."事業百分位">=50 AND r."社交百分位">=50 AND r."家庭助力百分位">=50'}),

    q("wealth_top","wealth","全年財富前段","財富百分位前 20%。",{dimension:"wealth",fields:['m."財帛主星"','m."財帛全部星"','m."官祿主星"','m."田宅主星"','m."化祿宮位"','m."化權宮位"','m."化忌宮位"'],where:topRank("財富")}),
    q("wealth_bright_store","wealth","得地財庫","武曲、天府或太陰至少得地坐財帛／田宅。",{dimension:"wealth",fields:['m."財帛主星"','m."田宅主星"','m."武曲星等"','m."天府星等"','m."太陰星等"','m."化祿宮位"'],where:`${b("武曲",["財帛","田宅"])} OR ${b("天府",["財帛","田宅"])} OR ${b("太陰",["財帛","田宅"])}`}),
    q("wealth_fire_greed","wealth","火貪財格（得地）","嚴格原財帛同宮，貪狼至少得地；借對宮不成立。",{dimension:"wealth",fields:['m."財帛主星"','m."財帛全部星"','m."貪狼星等"','m."火星星等"','m."化祿宮位"','m."化權宮位"','m."化忌宮位"'],where:`m."貪狼宮位"='財帛' AND m."火星宮位"='財帛' AND ${b("貪狼",["財帛"])}`}),
    q("wealth_bell_greed","wealth","鈴貪財格（得地）","嚴格原財帛同宮，貪狼至少得地；借對宮不成立。",{dimension:"wealth",fields:['m."財帛主星"','m."財帛全部星"','m."貪狼星等"','m."鈴星星等"','m."化祿宮位"','m."化權宮位"','m."化忌宮位"'],where:`m."貪狼宮位"='財帛' AND m."鈴星宮位"='財帛' AND ${b("貪狼",["財帛"])}`}),
    q("wealth_brightness_compare","wealth","火貪亮度比較","保留全部火貪亮度，直接比較同格局的財富分。",{dimension:"wealth",fields:['m."財帛主星"','m."貪狼星等"','m."火星星等"','m."化祿宮位"','m."化忌宮位"'],where:'m."貪狼宮位"=\'財帛\' AND m."火星宮位"=\'財帛\''}),

    q("appearance_top","appearance","全年外貌前段","外貌傾向百分位前 20%。",{dimension:"appearance",fields:['m."命宮主星"','m."命宮全部星"','m."太陰星等"','m."天同星等"','m."天相星等"','m."紫微星等"','m."貪狼星等"'],where:topRank("外貌")}),
    q("appearance_bright","appearance","命宮得地亮麗主星","太陰、天同、天相、紫微或貪狼至少得地坐命。",{dimension:"appearance",fields:['m."命宮主星"','m."命宮全部星"','m."太陰星等"','m."天同星等"','m."天相星等"','m."紫微星等"','m."貪狼星等"'],where:`${b("太陰",["命宮"])} OR ${b("天同",["命宮"])} OR ${b("天相",["命宮"])} OR ${b("紫微",["命宮"])} OR ${b("貪狼",["命宮"])}`}),
    q("appearance_female","appearance","女性外貌前段","女性盤外貌百分位前 10%，保留亮度證據。",{dimension:"appearance",fields:['m."命宮主星"','m."命宮全部星"','m."太陰星等"','m."天同星等"','m."天相星等"','m."貪狼星等"'],where:'m."性別"=\'女\' AND r."外貌百分位">=90'}),

    q("health_top","health","全年健康前段","傳統命理的穩定／恢復傾向，不是醫療判斷。",{dimension:"health",fields:['m."命宮主星"','m."福德主星"','m."疾厄主星"','m."天同星等"','m."天梁星等"','m."天府星等"','m."化科宮位"','m."化忌宮位"'],where:topRank("健康")}),
    q("health_bright_support","health","命福疾得地庇護星","天同、天梁或天府至少得地坐命福疾。",{dimension:"health",fields:['m."命宮主星"','m."福德主星"','m."疾厄主星"','m."天同星等"','m."天梁星等"','m."天府星等"'],where:`${b("天同",["命宮","福德","疾厄"])} OR ${b("天梁",["命宮","福德","疾厄"])} OR ${b("天府",["命宮","福德","疾厄"])}`}),
    q("health_volatility","health","命疾波動","命或疾厄見羊陀火鈴，依健康傾向分由低至高研究。",{dimension:"health",fields:['m."命宮全部星"','m."疾厄全部星"','m."火星星等"','m."鈴星星等"','m."擎羊星等"','m."陀羅星等"','m."化忌宮位"'],where:'m."火星宮位" IN (\'命宮\',\'疾厄\') OR m."鈴星宮位" IN (\'命宮\',\'疾厄\') OR m."擎羊宮位" IN (\'命宮\',\'疾厄\') OR m."陀羅宮位" IN (\'命宮\',\'疾厄\')',order:'r."健康分" ASC, m."公曆日期", m."時辰序號", m."性別"'}),

    q("career_top","career","全年事業前段","事業百分位前 20%。",{dimension:"career",fields:['m."命宮主星"','m."官祿主星"','m."官祿全部星"','m."化權宮位"','m."化科宮位"','m."化忌宮位"'],where:topRank("事業")}),
    q("career_bright_leader","career","廟旺領導星","紫微、武曲或太陽至少旺地坐命／官。",{dimension:"career",fields:['m."命宮主星"','m."官祿主星"','m."紫微星等"','m."武曲星等"','m."太陽星等"','m."化權宮位"'],where:`${b("紫微",["命宮","官祿"],6)} OR ${b("武曲",["命宮","官祿"],6)} OR ${b("太陽",["命宮","官祿"],6)}`}),
    q("career_entrepreneur","career","得地開創型","七殺、破軍或貪狼至少得地坐命／官。",{dimension:"career",fields:['m."命宮主星"','m."官祿主星"','m."七殺星等"','m."破軍星等"','m."貪狼星等"','m."化權宮位"','m."化忌宮位"'],where:`${b("七殺",["命宮","官祿"])} OR ${b("破軍",["命宮","官祿"])} OR ${b("貪狼",["命宮","官祿"])}`}),
    q("career_wealth","career","財官雙前段","財富與事業百分位同在前 20%。",{dimension:"career",fields:['r."財富分"','r."財富排名"','m."財帛主星"','m."官祿主星"','m."化祿宮位"','m."化權宮位"'],where:'r."財富百分位">=80 AND r."事業百分位">=80'}),

    q("social_top","social","全年社交前段","社交百分位前 20%。",{dimension:"social",fields:['m."命宮主星"','m."僕役主星"','m."遷移主星"','m."夫妻主星"','m."化祿宮位"','m."化科宮位"','m."化忌宮位"'],where:topRank("社交")}),
    q("social_bright","social","得地社交主星","貪狼、太陽、天同或巨門至少得地坐命僕遷。",{dimension:"social",fields:['m."命宮主星"','m."僕役主星"','m."遷移主星"','m."貪狼星等"','m."太陽星等"','m."天同星等"','m."巨門星等"'],where:`${b("貪狼",["命宮","僕役","遷移"])} OR ${b("太陽",["命宮","僕役","遷移"])} OR ${b("天同",["命宮","僕役","遷移"])} OR ${b("巨門",["命宮","僕役","遷移"])}`}),
    q("social_support","social","人際貴人助力","命僕遷夫見左右魁鉞。",{dimension:"social",fields:['m."命宮全部星"','m."僕役全部星"','m."遷移全部星"','m."夫妻全部星"'],where:'m."命宮全部星" LIKE \'%左輔%\' OR m."命宮全部星" LIKE \'%右弼%\' OR m."僕役全部星" LIKE \'%天魁%\' OR m."僕役全部星" LIKE \'%天鉞%\' OR m."遷移全部星" LIKE \'%天魁%\' OR m."夫妻全部星" LIKE \'%右弼%\''}),

    q("family_top","family","全年家庭助力前段","家庭助力百分位前 20%。",{dimension:"family",fields:['m."父母主星"','m."父母全部星"','m."田宅主星"','m."田宅全部星"','m."化祿宮位"','m."化忌宮位"'],where:topRank("家庭助力")}),
    q("family_bright","family","父田得地資源星","紫微、天府、太陽或太陰至少得地坐父母／田宅。",{dimension:"family",fields:['m."父母主星"','m."田宅主星"','m."紫微星等"','m."天府星等"','m."太陽星等"','m."太陰星等"'],where:`${b("紫微",["父母","田宅"])} OR ${b("天府",["父母","田宅"])} OR ${b("太陽",["父母","田宅"])} OR ${b("太陰",["父母","田宅"])}`}),

    q("research_empty_ming","research","命宮空宮與評分","保留借對宮語義並顯示七維分。",{fields:['m."命宮主星"','m."命宮是否空宮"','m."命宮對宮主星"','m."真命宮主星"','m."真命宮來源"','r."財富分"','r."幸運分"','r."外貌分"','r."健康分"','r."事業分"','r."社交分"','r."家庭助力分"'],where:'m."命宮是否空宮"=1'}),
    q("research_brightness_rows","research","星曜亮度明細","由正規化長表查貪狼在財帛的亮度、順序及分數。",{dimension:"wealth",join:'JOIN "星曜亮度" b ON b."KEY"=m."KEY" AND b."星曜"=\'貪狼\' AND b."宮位"=\'財帛\'',fields:['b."星曜"','b."宮位"','b."星曜類型"','b."星性質"','b."亮度"','b."亮度序"','b."四化"','m."財帛主星"','m."財帛全部星"']})
  ];
  const queries=Object.fromEntries(definitions.map((x)=>[x.key,x.sql]));
  const labels=Object.fromEntries(definitions.map((x)=>[x.key,x.label]));
  const metadata=Object.fromEntries(definitions.map((x)=>[x.key,Object.freeze({key:x.key,group:x.group,label:x.label,description:x.description})]));
  const groups=Object.fromEntries(GROUPS.map(([id,title])=>[title,definitions.filter((x)=>x.group===id).map((x)=>x.key)]));
  window.BAZI_QUERY_LIBRARY=Object.freeze({definitions:Object.freeze(definitions),metadata:Object.freeze(metadata),queries:Object.freeze(queries),groups:Object.freeze(groups),labels:Object.freeze(labels),defaultQuery:"overall_top"});
})();
