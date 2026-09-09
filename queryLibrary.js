(() => {
  "use strict";
  // 預設查詢全部依倪海廈《天紀》的批命順序設計：
  // ① 格局（命宮三方四正總格與具名格局）→ ② 凶格（破格）→ ③ 財官（星得正位）
  // → ④ 婚姻（夫妻＋福德同參）→ ⑤ 六親（化忌主剋）→ ⑥ 科甲 → ⑦ 健康（只做參考）。
  const GROUPS = [
    ["geju", "👑 格局"], ["xiong", "⛈️ 凶格"], ["wealth", "💰 財富"], ["career", "🏆 事業"],
    ["marriage", "💑 婚姻"], ["kin", "👪 六親"], ["kejia", "📚 科甲"], ["health", "🌿 健康"],
    ["overall", "⚖️ 綜合"], ["research", "🔬 研究"], ["birth", "🍼 婚育家庭"],
  ];
  const BASE = ['m."KEY" AS "KEY"', 'm."命盤連結"', 'm."公曆日期"', 'm."時辰"', 'm."性別"'];
  const NAMES = { overall: "綜合", geju: "格局", wealth: "財富", career: "事業", marriage: "婚姻", kin: "六親", kejia: "科甲", health: "健康" };
  const rating = (dimension) => [`r."${NAMES[dimension]}分"`, `r."${NAMES[dimension]}排名"`, `r."${NAMES[dimension]}百分位"`];
  const select = ({ dimension = "overall", fields = [], where = "1=1", order, join = "", top = 1000 }) => `SELECT TOP ${top}
  ${[...BASE, ...rating(dimension), ...fields].join(",\n  ")}
FROM "命盤" m
JOIN "命盤評分" r ON r."KEY"=m."KEY"
${join}${join ? "\n" : ""}WHERE ${where}
ORDER BY ${order ?? `r."${NAMES[dimension]}分" DESC, m."公曆日期", m."時辰序號", m."性別"`};`;
  const q = (key, group, label, description, options) => ({ key, group, label, description, sql: select(options) });
  const b = (star, palaces, min = 5) => `EXISTS (SELECT 1 FROM "星曜亮度" b WHERE b."KEY"=m."KEY" AND b."星曜"='${star}' AND b."宮位" IN (${palaces.map((p) => `'${p}'`).join(",")}) AND b."亮度序">=${min})`;
  const topRank = (name) => `r."${name}排名" IN ('SSS','SSR','SS','S')`;
  const G = 'JOIN "命盤格局" g ON g."KEY"=m."KEY"';
  const hua = () => ['m."化祿星"', 'm."化祿宮位"', 'm."化權星"', 'm."化權宮位"', 'm."化科星"', 'm."化科宮位"', 'm."化忌星"', 'm."化忌宮位"'];

  const definitions = [
    // 👑 格局：倪師批總格的具名格局
    q("geju_top", "geju", "全年格局前段", "格局百分位前 20%，顯示命宮三方四正與四化落宮、成格數。", {
      dimension: "geju", join: G,
      fields: ['m."命宮主星"', 'm."財帛主星"', 'm."官祿主星"', 'm."遷移主星"', ...hua(), 'g."成格數"', 'g."凶格數"'],
      where: topRank("格局"),
    }),
    q("geju_zifu", "geju", "紫府坐垣・七殺朝斗", "命宮寅申紫府同廟坐命，或七殺獨坐入廟：將相之格。", {
      dimension: "geju", join: G,
      fields: ['m."命宮"', 'm."命宮主星"', 'm."紫微星等"', 'm."天府星等"', 'm."七殺星等"', 'm."化權宮位"'],
      where: 'g."紫府坐垣"=1 OR g."七殺朝斗"=1',
    }),
    q("geju_riyue", "geju", "日月成格", "日月並明、月朗天門（女最吉）、日照雷門（男最吉）、日麗中天、明珠出海、日月夾命。", {
      dimension: "geju", join: G,
      fields: ['m."命宮"', 'm."命宮主星"', 'm."太陽星等"', 'm."太陰星等"', 'g."月朗天門"', 'g."日照雷門"', 'g."日月夾命"'],
      where: 'g."日月並明"=1 OR g."月朗天門"=1 OR g."日照雷門"=1 OR g."日麗中天"=1 OR g."明珠出海"=1 OR g."日月夾命"=1',
    }),
    q("geju_jia", "geju", "夾命格局", "紫府夾權、魁鉞夾貴為吉；羊陀夾命、日月反背夾命為凶，同表對照。", {
      dimension: "geju", join: G,
      fields: ['m."命宮"', 'm."命宮主星"', 'g."紫府夾權"', 'g."魁鉞夾貴"', 'g."羊陀夾命"', 'g."日月反背夾命"'],
      where: 'g."紫府夾權"=1 OR g."魁鉞夾貴"=1 OR g."羊陀夾命"=1 OR g."日月反背夾命"=1',
    }),
    q("geju_kequanlu", "geju", "科權祿三會命", "化祿化權化科同會命宮三方四正：一方之主；對照權祿相逢與祿馬交馳。", {
      dimension: "geju", join: G,
      fields: ['m."命宮主星"', 'm."化祿星"', 'm."化祿宮位"', 'm."化權星"', 'm."化權宮位"', 'm."化科星"', 'm."化科宮位"', 'g."權祿相逢"', 'g."祿馬交馳"'],
      where: 'g."科權祿三會命"=1',
    }),

    // ⛈️ 凶格：倪師明確「必凶」的破格
    q("xiong_bankong", "xiong", "半空折翅", "化忌在遷移沖命且三方無吉星，或命宮巳亥廉貪落陷對沖：大限在中年。", {
      dimension: "geju", join: G,
      fields: ['m."命宮"', 'm."命宮主星"', 'm."命宮全部星"', 'm."化忌星"', 'm."化忌宮位"', 'g."廉貪陷沖命"'],
      where: 'g."半空折翅"=1 OR g."廉貪陷沖命"=1',
      order: 'r."格局分" ASC, m."公曆日期", m."時辰序號", m."性別"',
    }),
    q("xiong_fanbei", "xiong", "日月反背", "太陽太陰均落陷：披星戴月、六親不靠；落陷夾命一世辛勞。", {
      dimension: "geju", join: G,
      fields: ['m."命宮"', 'm."命宮主星"', 'm."太陽星等"', 'm."太陰星等"', 'g."日月反背夾命"', 'm."化忌宮位"'],
      where: 'g."日月反背"=1 OR g."日月反背夾命"=1',
      order: 'r."格局分" ASC, m."公曆日期", m."時辰序號", m."性別"',
    }),
    q("xiong_lianxian", "xiong", "殺星落陷凶格", "列出倪師教材中的廉殺、廉貪、武殺落陷組合；這是傳統格局標記，不是事件預測。", {
      dimension: "geju", join: G,
      fields: ['m."命宮主星"', 'm."廉貞星等"', 'm."七殺星等"', 'm."破軍星等"', 'm."貪狼星等"', 'm."武曲星等"', 'g."廉殺落陷"', 'g."廉貪落陷"', 'g."武殺落陷"'],
      where: 'g."廉殺落陷"=1 OR g."廉貪落陷"=1 OR g."武殺落陷"=1',
      order: 'r."格局分" ASC, m."公曆日期", m."時辰序號", m."性別"',
    }),
    q("xiong_jichu", "xiong", "吉處藏凶", "三方四正吉星成叢卻有煞星落陷：倪師明言必凶；對照凶處藏吉。", {
      dimension: "geju", join: G,
      fields: ['m."命宮主星"', 'm."命宮全部星"', 'g."凶處藏吉"', 'g."凶格數"'],
      where: 'g."吉處藏凶"=1',
      order: 'r."格局分" ASC, m."公曆日期", m."時辰序號", m."性別"',
    }),

    // 💰 財富：財星得正位，權祿相逢自己當老闆
    q("wealth_zhengwei", "wealth", "財星得正位", "武曲、天府或太陰至少得地坐財帛：財星入財帛最好。", {
      dimension: "wealth",
      fields: ['m."財帛主星"', 'm."財帛全部星"', 'm."武曲星等"', 'm."天府星等"', 'm."太陰星等"', 'm."化祿宮位"', 'm."化忌宮位"'],
      where: `${b("武曲", ["財帛"])} OR ${b("天府", ["財帛"])} OR ${b("太陰", ["財帛"])}`,
    }),
    q("wealth_riyue_jia", "wealth", "日月夾命・夾財", "日月廟旺分踞命宮兩側：命宮有主星為日月夾命，空宮則為教材所稱日月夾財。", {
      dimension: "wealth", join: G,
      fields: ['m."命宮"', 'm."命宮是否空宮"', 'm."命宮對宮主星"', 'm."太陽星等"', 'm."太陰星等"'],
      where: 'g."日月夾命"=1 OR g."日月夾財"=1',
    }),
    q("wealth_luma", "wealth", "祿馬交馳", "祿存或化祿與天馬同宮：辛苦賺大錢，巨富。", {
      dimension: "wealth", join: G,
      fields: ['m."化祿星"', 'm."化祿宮位"', 'm."祿存宮位"', 'm."天馬宮位"', 'm."財帛主星"'],
      where: 'g."祿馬交馳"=1',
    }),
    q("wealth_quanlu", "wealth", "權祿相逢", "化權與化祿或祿存同宮於命財官：一定自己做事業當老闆。", {
      dimension: "wealth", join: G,
      fields: ['m."化權星"', 'm."化權宮位"', 'm."化祿宮位"', 'm."祿存宮位"', 'm."財帛主星"'],
      where: 'g."權祿相逢"=1',
    }),
    q("career_huogui", "career", "火貴・鈴貴", "火星或鈴星與貪狼同坐命宮；依倪師教材歸入武貴／武職，不當作財帛爆發財格。", {
      dimension: "career", join: G,
      fields: ['m."命宮主星"', 'm."命宮全部星"', 'm."貪狼星等"', 'm."火星星等"', 'm."鈴星星等"', 'g."火貴格"', 'g."鈴貴格"'],
      where: 'g."火貴格"=1 OR g."鈴貴格"=1',
    }),
    q("wealth_jipo", "wealth", "破財組合", "化忌或空劫破軍入財帛，依財富分由低至高研究。", {
      dimension: "wealth",
      fields: ['m."財帛全部星"', 'm."化忌星"', 'm."破軍星等"', 'm."地空星等"', 'm."地劫星等"'],
      where: 'm."化忌宮位"=\'財帛\' OR m."地空宮位"=\'財帛\' OR m."地劫宮位"=\'財帛\' OR m."破軍宮位"=\'財帛\'',
      order: 'r."財富分" ASC, m."公曆日期", m."時辰序號", m."性別"',
    }),

    // 🏆 事業：官祿宮最喜化權；六殺入官祿做官辛苦
    q("career_quan", "career", "化權入官祿", "官祿宮最喜權星入宮；化科入官祿對照考公家單位。", {
      dimension: "career",
      fields: ['m."化權星"', 'm."官祿主星"', 'm."官祿全部星"', 'm."化科星"', 'm."化科宮位"', 'm."化忌宮位"', 'm."身宮宮位"'],
      where: 'm."化權宮位"=\'官祿\'',
    }),
    q("career_zifu_guan", "career", "官星正位入官祿", "紫微、天府至少旺地入官祿，或紫微七殺同宮於官祿：官帶越大官越大。", {
      dimension: "career", join: G,
      fields: ['m."官祿主星"', 'm."官祿全部星"', 'm."紫微星等"', 'm."天府星等"', 'm."七殺星等"', 'g."紫微七殺官祿"'],
      where: `${b("紫微", ["官祿"], 6)} OR ${b("天府", ["官祿"], 6)} OR g."紫微七殺官祿"=1`,
    }),
    q("career_liusha", "career", "六殺入官祿", "羊陀火鈴空劫入官祿，做官很辛苦；依事業分由低至高。", {
      dimension: "career",
      fields: ['m."官祿全部星"', 'm."擎羊星等"', 'm."陀羅星等"', 'm."火星星等"', 'm."鈴星星等"', 'm."化忌宮位"'],
      where: 'm."擎羊宮位"=\'官祿\' OR m."陀羅宮位"=\'官祿\' OR m."火星宮位"=\'官祿\' OR m."鈴星宮位"=\'官祿\' OR m."地空宮位"=\'官祿\' OR m."地劫宮位"=\'官祿\'',
      order: 'r."事業分" ASC, m."公曆日期", m."時辰序號", m."性別"',
    }),
    q("career_shen", "career", "身宮去向與機月同梁", "身在財帛私企做老闆、身在官祿從政；機月同梁宜公家單位。", {
      dimension: "career", join: G,
      fields: ['m."身宮宮位"', 'm."命宮主星"', 'm."官祿主星"', 'm."財帛主星"', 'g."機月同梁"', 'g."身在官祿"', 'g."身在財帛"'],
      where: 'g."機月同梁"=1 OR g."身在官祿"=1 OR g."身在財帛"=1',
    }),

    // 💑 婚姻：夫妻宮必須與福德宮一起看
    q("marriage_zifu", "marriage", "配偶優秀", "紫微、天府、天同或天相至少旺地入夫妻；天府天馬同宮、紫輔同夫、天同巨門同夫。", {
      dimension: "marriage", join: G,
      fields: ['m."夫妻主星"', 'm."夫妻全部星"', 'm."福德主星"', 'g."天府天馬同夫"', 'g."紫輔同夫"', 'g."天同巨門同夫"'],
      where: `${b("紫微", ["夫妻"], 6)} OR ${b("天府", ["夫妻"], 6)} OR ${b("天同", ["夫妻"], 6)} OR ${b("天相", ["夫妻"], 6)} OR g."天府天馬同夫"=1 OR g."紫輔同夫"=1 OR g."天同巨門同夫"=1`,
    }),
    q("marriage_lianxiong", "marriage", "夫妻福德重大不利", "廉貞貪狼或廉貞破軍同入夫妻／福德；教材要求命運、陽宅與面相同參，不作單一條件斷語。", {
      dimension: "marriage", join: G,
      fields: ['m."夫妻主星"', 'm."夫妻全部星"', 'm."福德主星"', 'm."福德全部星"', 'm."廉貞星等"', 'm."貪狼星等"', 'm."破軍星等"', 'g."廉破入夫妻福德"', 'g."廉貪入夫妻福德"'],
      where: 'g."廉破入夫妻福德"=1 OR g."廉貪入夫妻福德"=1',
      order: 'r."婚姻分" ASC, m."公曆日期", m."時辰序號", m."性別"',
    }),
    q("marriage_fude_ji", "marriage", "化忌入夫妻福德", "化忌入夫妻或福德是婚姻不利訊號；重大判斷仍須命運、陽宅與面相同參。", {
      dimension: "marriage",
      fields: ['m."化忌星"', 'm."夫妻主星"', 'm."夫妻全部星"', 'm."福德主星"', 'm."福德全部星"'],
      where: 'm."化忌宮位" IN (\'夫妻\', \'福德\')',
      order: 'r."婚姻分" ASC, m."公曆日期", m."時辰序號", m."性別"',
    }),
    q("marriage_nv_gudu", "marriage", "女命孤獨訊號", "女命武官星坐命、福德武曲七殺、或太陽落陷在命夫妻：女身男命孤獨格。", {
      dimension: "marriage", join: G,
      fields: ['m."命宮主星"', 'm."福德主星"', 'm."太陽星等"', 'g."女命武官坐命"', 'g."福德武曲七殺"', 'g."女命太陽陷"'],
      where: 'g."女命武官坐命"=1 OR g."福德武曲七殺"=1 OR g."女命太陽陷"=1',
      order: 'r."婚姻分" ASC, m."公曆日期", m."時辰序號", m."性別"',
    }),

    // 👪 六親：化忌所在六親宮主剋；化祿入父母有祖產
    q("kin_zuchan", "kin", "祖產財祿", "化祿入父母或田宅：父母從商有祖產；化忌入田宅破祖業對照。", {
      dimension: "kin",
      fields: ['m."化祿星"', 'm."父母主星"', 'm."田宅主星"', 'm."化忌宮位"', 'm."兄弟主星"'],
      where: 'm."化祿宮位" IN (\'父母\', \'田宅\')',
    }),
    q("kin_ji", "kin", "化忌剋六親", "化忌入父母、兄弟或子女：父母不在身邊、兄弟不和、與子女衝突大。", {
      dimension: "kin",
      fields: ['m."化忌星"', 'm."父母主星"', 'm."兄弟主星"', 'm."子女主星"', 'm."太陽星等"', 'm."太陰星等"'],
      where: 'm."化忌宮位" IN (\'父母\', \'兄弟\', \'子女\')',
      order: 'r."六親分" ASC, m."公曆日期", m."時辰序號", m."性別"',
    }),
    q("kin_wuzi", "kin", "無子訊號", "子女宮無主星而對宮（田宅）化忌：倪師定義的無子格。", {
      dimension: "kin", join: G,
      fields: ['m."子女主星"', 'm."子女是否空宮"', 'm."子女對宮主星"', 'm."化忌星"', 'm."化忌宮位"', 'g."子女無子"'],
      where: 'g."子女無子"=1',
      order: 'r."六親分" ASC, m."公曆日期", m."時辰序號", m."性別"',
    }),

    // 📚 科甲：昌曲魁鉞主科甲
    q("kejia_hui", "kejia", "昌曲魁鉞會命", "昌曲會命讀書奇才；魁鉞會命或夾貴，考試貴人皆利。", {
      dimension: "kejia", join: G,
      fields: ['m."命宮全部星"', 'm."文昌星等"', 'm."文曲星等"', 'm."天魁星等"', 'm."天鉞星等"', 'g."昌曲會命"', 'g."魁鉞會命"', 'g."魁鉞夾貴"'],
      where: 'g."昌曲會命"=1 OR g."魁鉞會命"=1 OR g."魁鉞夾貴"=1',
    }),
    q("kejia_huake", "kejia", "化科入命官", "化科入命讀書考試都好；入官祿適合考公家單位。", {
      dimension: "kejia",
      fields: ['m."化科星"', 'm."命宮主星"', 'm."官祿主星"', 'm."文昌星等"', 'm."文曲星等"'],
      where: 'm."化科宮位" IN (\'命宮\', \'官祿\')',
    }),

    // 🌿 健康：疾厄宮只做參考，煞星多在哪個宮就知道那方面的疾病
    q("health_shaxing", "health", "疾厄見煞與忌", "羊陀火鈴空劫或化忌入疾厄，依健康分由低至高研究；非醫療判斷。", {
      dimension: "health",
      fields: ['m."疾厄主星"', 'm."疾厄全部星"', 'm."擎羊星等"', 'm."陀羅星等"', 'm."火星星等"', 'm."鈴星星等"', 'm."化忌星"'],
      where: 'm."化忌宮位"=\'疾厄\' OR m."擎羊宮位"=\'疾厄\' OR m."陀羅宮位"=\'疾厄\' OR m."火星宮位"=\'疾厄\' OR m."鈴星宮位"=\'疾厄\' OR m."地空宮位"=\'疾厄\' OR m."地劫宮位"=\'疾厄\'',
      order: 'r."健康分" ASC, m."公曆日期", m."時辰序號", m."性別"',
    }),

    // ⚖️ 綜合
    q("overall_top", "overall", "全年綜合前段", "綜合百分位前 20%，顯示命宮三方四正、四化落宮與成格數。", {
      join: G,
      fields: ['m."命宮主星"', 'm."財帛主星"', 'm."官祿主星"', ...hua(), 'g."成格數"', 'g."凶格數"'],
      where: topRank("綜合"),
    }),
    q("overall_caiguan", "overall", "財官雙美", "財富與事業百分位同在前 20%：星得正位的直接成果。", {
      fields: ['r."格局分"', 'm."財帛主星"', 'm."官祿主星"', 'm."化祿宮位"', 'm."化權宮位"', 'm."化忌宮位"'],
      where: 'r."財富百分位">=80 AND r."事業百分位">=80',
    }),

    // 🔬 研究
    q("research_empty_ming", "research", "命宮空宮與借對宮", "命宮無主星時借用對宮；顯示七維評分與來源。", {
      fields: ['m."命宮主星"', 'm."命宮是否空宮"', 'm."命宮對宮主星"', 'm."真命宮主星"', 'm."真命宮來源"', 'r."格局分"', 'r."財富分"', 'r."事業分"', 'r."婚姻分"', 'r."六親分"', 'r."科甲分"', 'r."健康分"'],
      where: 'm."命宮是否空宮"=1',
    }),
    q("research_brightness_rows", "research", "星曜亮度明細", "由正規化長表查貪狼在財帛的亮度、順序及分數。", {
      dimension: "wealth",
      join: 'JOIN "星曜亮度" b ON b."KEY"=m."KEY" AND b."星曜"=\'貪狼\' AND b."宮位"=\'財帛\'',
      fields: ['b."星曜"', 'b."宮位"', 'b."星曜類型"', 'b."星性質"', 'b."亮度"', 'b."亮度序"', 'b."四化"', 'm."財帛主星"', 'm."財帛全部星"'],
    }),

    // 🍼 婚育家庭（倪師：挑生子女的時間，看命盤哪個宮最好）
    q("family_best_overall", "birth", "Best Overall Family", "父母、自身財富、外貌、婚姻、子女與時機的年度綜合 PR。", {
      join: 'JOIN "命盤家庭評分" f ON f."KEY"=m."KEY"',
      fields: ['f."家庭品質分"', 'f."家庭品質排名"', 'f."家庭品質百分位"', 'f."家庭平衡百分位"', 'f."父母品質百分位"', 'f."父母財富百分位"', 'f."自身財富百分位"', 'f."外貌百分位"', 'f."戀愛百分位"', 'f."婚姻百分位"', 'f."子女百分位"', 'f."父母負向分"', 'f."最佳婚姻年齡"', 'f."最佳婚姻年份"'],
      order: 'f."家庭品質百分位" DESC, f."家庭平衡百分位" DESC',
    }),
    q("family_wealthy_parents_beautiful", "birth", "Wealthy Parents + Beautiful", "父母財富與外貌 PR 高，父母負向低。", {
      join: 'JOIN "命盤家庭評分" f ON f."KEY"=m."KEY"',
      fields: ['f."家庭品質百分位"', 'f."父母財富分"', 'f."父母財富百分位"', 'f."父母品質百分位"', 'f."自身財富百分位"', 'f."外貌百分位"', 'f."父母負向分"', 'm."父母主星"', 'm."命宮主星"'],
      where: 'f."父母財富百分位">=70 AND f."外貌百分位">=70 AND f."父母品質百分位">=60 AND f."自身財富百分位">=40 AND f."父母負向分"<=40',
      order: 'f."家庭品質百分位" DESC',
    }),
    q("family_marriage_children", "birth", "Marriage + Children", "婚姻與子女 timing 清楚，且真子女宮有主星。", {
      join: 'JOIN "命盤家庭評分" f ON f."KEY"=m."KEY"',
      fields: ['f."家庭品質百分位"', 'f."婚姻百分位"', 'f."婚姻時機百分位"', 'f."子女百分位"', 'f."子女時機百分位"', 'f."真子女宮有主星"', 'f."真子女宮來源"', 'f."最佳婚姻年齡"', 'f."婚姻窗口起始年齡"', 'f."婚姻窗口結束年齡"', 'f."大限紅鸞"', 'f."大限天喜"', 'f."小限紅鸞"', 'f."小限天喜"'],
      where: 'f."婚姻百分位">=65 AND f."子女百分位">=60 AND f."真子女宮有主星"=1',
      order: 'f."家庭品質百分位" DESC',
    }),
    q("family_best_parents", "birth", "Best For Parents", "父母品質、父母財富高且負向訊號低。", {
      join: 'JOIN "命盤家庭評分" f ON f."KEY"=m."KEY"',
      fields: ['f."父母分"', 'f."父母百分位"', 'f."父母財富分"', 'f."父母財富百分位"', 'f."父母品質分"', 'f."父母品質百分位"', 'f."父母負向分"', 'm."父母主星"', 'm."父母全部星"', 'm."化祿宮位"', 'm."化忌宮位"'],
      order: 'f."父母品質百分位" DESC, f."父母負向分" ASC',
    }),
    q("family_worst_parents", "birth", "Worst For Parents", "反向列出父母負向組合，供 regression 與 sanity check。", {
      join: 'JOIN "命盤家庭評分" f ON f."KEY"=m."KEY"',
      fields: ['f."父母負向分"', 'f."父母品質分"', 'f."父母品質百分位"', 'f."父母財富百分位"', 'm."父母主星"', 'm."父母全部星"', 'm."化忌星"', 'm."化忌宮位"'],
      where: 'f."父母負向分">0',
      order: 'f."父母負向分" DESC, f."父母品質分" ASC',
    }),
    q("family_full_target", "birth", "Full Target", "旺父母、正財、外貌、適度桃花、婚育 timing、真子女宮主星且避免嚴重父母負向。", {
      join: 'JOIN "命盤家庭評分" f ON f."KEY"=m."KEY"',
      fields: ['f."家庭品質百分位"', 'f."家庭平衡百分位"', 'f."父母品質百分位"', 'f."父母財富百分位"', 'f."穩定財富百分位"', 'f."自身財富百分位"', 'f."外貌百分位"', 'f."戀愛百分位"', 'f."婚姻百分位"', 'f."子女百分位"', 'f."家庭時機百分位"', 'f."父母負向分"', 'f."最佳婚姻年齡"', 'f."最佳婚姻年份"', 'f."真子女宮有主星"'],
      where: 'f."父母品質百分位">=50 AND f."父母財富百分位">=50 AND f."穩定財富百分位">=50 AND f."外貌百分位">=50 AND f."婚姻百分位">=50 AND f."子女百分位">=50 AND f."真子女宮有主星"=1 AND f."父母負向分"<=45',
      order: 'f."家庭品質百分位" DESC, f."家庭平衡百分位" DESC',
    }),
  ];
  const queries = Object.fromEntries(definitions.map((x) => [x.key, x.sql]));
  const labels = Object.fromEntries(definitions.map((x) => [x.key, x.label]));
  const metadata = Object.fromEntries(definitions.map((x) => [x.key, Object.freeze({ key: x.key, group: x.group, label: x.label, description: x.description })]));
  const groups = Object.fromEntries(GROUPS.map(([id, title]) => [title, definitions.filter((x) => x.group === id).map((x) => x.key)]));
  window.BAZI_QUERY_LIBRARY = Object.freeze({ definitions: Object.freeze(definitions), metadata: Object.freeze(metadata), queries: Object.freeze(queries), groups: Object.freeze(groups), labels: Object.freeze(labels), defaultQuery: "geju_top" });
})();
