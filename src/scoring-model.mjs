// 橫財 is deliberately separate from 財富: sudden upside and durable wealth
// are not the same signal. A zero overallWeight makes it an analytical
// sub-score without double-counting it in 綜合分.
export const DIMENSIONS = ["財富", "橫財", "幸運", "外貌", "事業", "社交", "家庭助力", "福體"];

export const DIMENSION_CONFIG = {
  財富: { baseScore: 50, overallWeight: 0.20 },
  橫財: { baseScore: 35, overallWeight: 0 },
  幸運: { baseScore: 50, overallWeight: 0.14 },
  外貌: { baseScore: 50, overallWeight: 0.10 },
  事業: { baseScore: 50, overallWeight: 0.17 },
  社交: { baseScore: 50, overallWeight: 0.10 },
  家庭助力: { baseScore: 50, overallWeight: 0.14 },
  福體: { baseScore: 50, overallWeight: 0.15 },
};

export const RANK_THRESHOLDS = [
  ["SSS", 99], ["SSR", 96], ["SS", 90], ["S", 80], ["A", 60],
  ["B", 35], ["C", 20], ["D", 10], ["E", 4], ["F", 0],
];

const p = (palace) => `m."${palace}全部星"`;
const anyLike = (fields, stars) => `(${fields.flatMap((field) => stars.map((star) => `${field} LIKE '%${star}%'`)).join(" OR ")})`;
const coreWealth = [p("命宮"), p("財帛"), p("官祿"), p("田宅")];
const coreLuck = [p("命宮"), p("福德"), p("遷移"), p("父母")];
const coreCareer = [p("命宮"), p("官祿"), p("財帛"), p("遷移")];
const coreSocial = [p("命宮"), p("僕役"), p("遷移"), p("夫妻")];
const coreFamily = [p("父母"), p("田宅"), p("福德"), p("命宮")];
const coreWellbeing = [p("命宮"), p("福德"), p("疾厄")];

const rule = (id, dimension, kind, weight, condition, description) => ({ id, dimension, kind, weight, condition, description });

export const SCORE_RULES = [
  rule("W01", "財富", "加分", 13, `((m."武曲宮位" IN ('財帛','官祿','田宅') AND m."武曲星等" IN ('廟','旺')) OR (m."天府宮位" IN ('財帛','官祿','田宅') AND m."天府星等" IN ('廟','旺')))`, "武曲或天府廟旺坐財官田"),
  rule("W02", "財富", "加分", 9, `(m."太陰宮位" IN ('財帛','田宅') AND m."太陰星等" IN ('廟','旺'))`, "太陰廟旺坐財帛或田宅"),
  rule("W03", "財富", "加分", 14, `m."化祿宮位" IN ('命宮','財帛','官祿','田宅')`, "化祿進核心財富宮"),
  rule("W04", "財富", "加分", 7, `m."化權宮位" IN ('財帛','官祿')`, "化權進財帛或官祿"),
  rule("W05", "財富", "加分", 10, anyLike(coreWealth, ["祿存"]), "財官田命見祿存"),
  rule("W06", "財富", "組合", 9, `(${anyLike([p("財帛"), p("田宅")], ["天府","武曲","太陰"])} AND ${anyLike([p("財帛"), p("田宅")], ["祿存"])})`, "財庫主星與祿存形成守財組合"),
  rule("W07", "財富", "組合", 7, `(${anyLike([p("財帛"), p("官祿")], ["七殺","破軍","貪狼"])} AND m."化權宮位" IN ('財帛','官祿','遷移'))`, "開創主星得權形成事業爆發力"),
  rule("W08", "財富", "扣分", -20, `m."化忌宮位" IN ('財帛','官祿','田宅')`, "化忌損及財官田"),
  rule("W09", "財富", "扣分", -12, anyLike([p("財帛"), p("田宅")], ["地空","地劫"]), "財帛田宅受空劫影響"),
  rule("W10", "財富", "扣分", -7, anyLike([p("財帛"), p("官祿")], ["擎羊","陀羅","火星","鈴星"]), "財官見主要煞曜增加波動"),

  rule("G01", "橫財", "加分", 5, `m."貪狼宮位"='財帛'`, "貪狼在財帛，具機會財與商業財訊號"),
  rule("G02", "橫財", "加分", 5, `(m."貪狼宮位"='財帛' AND m."貪狼星等" IN ('廟','旺'))`, "貪狼廟旺坐財帛"),
  rule("G03", "橫財", "組合", 18, `(m."貪狼宮位"='財帛' AND m."財帛全部星" LIKE '%火星%')`, "火星與貪狼同在財帛形成火貪"),
  rule("G04", "橫財", "組合", 16, `(m."貪狼宮位"='財帛' AND m."財帛全部星" LIKE '%鈴星%')`, "鈴星與貪狼同在財帛形成鈴貪"),
  rule("G05", "橫財", "組合", 10, `(m."貪狼宮位"='財帛' AND ${anyLike([p("財帛")], ["火星","鈴星"])} AND m."化祿宮位"='財帛')`, "火鈴貪同財帛再得化祿"),
  rule("G06", "橫財", "組合", 8, `(m."貪狼宮位"='財帛' AND ${anyLike([p("財帛")], ["火星","鈴星"])} AND m."財帛全部星" LIKE '%祿存%')`, "火鈴貪同財帛再得祿存"),
  rule("G07", "橫財", "組合", 8, `(m."貪狼宮位"='財帛' AND m."貪狼星等" IN ('廟','旺') AND ${anyLike([p("財帛")], ["火星","鈴星"])} AND m."化祿宮位"='財帛')`, "火鈴貪化祿且貪狼廟旺"),
  rule("G08", "橫財", "加分", 8, `((m."破軍宮位" IN ('財帛','官祿','遷移') AND m."破軍星等" IN ('廟','旺')) OR (m."七殺宮位" IN ('財帛','官祿','遷移') AND m."七殺星等" IN ('廟','旺')))`, "破軍或七殺得地於財官遷"),
  rule("G09", "橫財", "組合", 10, `(m."化祿宮位" IN ('財帛','官祿','遷移') AND m."化權宮位" IN ('財帛','官祿','遷移'))`, "祿權同時引動財官遷"),
  rule("G10", "橫財", "扣分", -18, anyLike([p("財帛")], ["地空","地劫"]), "財帛空劫使爆發財大起大落"),
  rule("G11", "橫財", "扣分", -15, `(m."化忌宮位"='財帛' AND ${anyLike([p("財帛")], ["擎羊","陀羅","火星","鈴星","地空","地劫"])})`, "財帛化忌又受煞，得失反覆"),

  rule("L01", "幸運", "加分", 12, `m."化祿宮位" IN ('命宮','福德','遷移','父母')`, "化祿進命福遷父"),
  rule("L02", "幸運", "加分", 9, `m."化科宮位" IN ('命宮','福德','遷移','父母')`, "化科帶來順遂與解厄"),
  rule("L03", "幸運", "加分", 10, anyLike(coreLuck, ["天魁","天鉞"]), "核心助力宮見魁鉞"),
  rule("L04", "幸運", "加分", 8, anyLike(coreLuck, ["左輔","右弼"]), "核心助力宮見左右"),
  rule("L05", "幸運", "加分", 8, anyLike(coreLuck, ["祿存"]), "命福遷父見祿存"),
  rule("L06", "幸運", "組合", 9, `(${anyLike([p("命宮"),p("福德")], ["天府","天同","太陰"])} AND ${anyLike(coreLuck, ["天魁","天鉞","左輔","右弼"])})`, "福星與貴人星跨宮支持"),
  rule("L07", "幸運", "扣分", -17, `m."化忌宮位" IN ('命宮','福德','遷移','父母')`, "化忌進核心助力宮"),
  rule("L08", "幸運", "扣分", -10, anyLike(coreLuck, ["地空","地劫"]), "核心助力宮見空劫"),
  rule("L09", "幸運", "扣分", -7, anyLike([p("命宮"),p("福德")], ["擎羊","陀羅","火星","鈴星"]), "命福受主要煞曜干擾"),

  rule("A01", "外貌", "加分", 14, `((m."太陰宮位"='命宮' OR m."太陰宮位"=m."身宮宮位") AND m."太陰星等" IN ('廟','旺'))`, "太陰廟旺在命身"),
  rule("A02", "外貌", "加分", 10, `(m."天同宮位"='命宮' AND m."天同星等" IN ('廟','旺','得','利'))`, "天同得地在命宮"),
  rule("A03", "外貌", "加分", 10, `((m."天相宮位"='命宮' AND m."天相星等" IN ('廟','旺')) OR (m."紫微宮位"='命宮' AND m."紫微星等" IN ('廟','旺')))`, "天相或紫微廟旺形成貴氣"),
  rule("A04", "外貌", "加分", 9, `((m."貪狼宮位"='命宮' AND m."貪狼星等" IN ('廟','旺')) OR (m."廉貞宮位"='命宮' AND m."廉貞星等" IN ('廟','旺')))`, "貪狼廉貞得地形成鮮明魅力"),
  rule("A05", "外貌", "加分", 8, anyLike([p("命宮")], ["文昌","文曲"]), "命宮昌曲增添氣質"),
  rule("A06", "外貌", "加分", 9, anyLike([p("命宮"),p("夫妻")], ["紅鸞","天喜","天姚","咸池"]), "命或夫妻宮見桃花曜"),
  rule("A07", "外貌", "加分", 6, `m."化科宮位"='命宮'`, "命宮化科提升儀態"),
  rule("A08", "外貌", "組合", 8, `(${anyLike([p("命宮")], ["太陰","天同","貪狼","廉貞","天相","紫微"])} AND ${anyLike([p("命宮")], ["文昌","文曲","紅鸞","天喜","天姚"])})`, "主風格星與氣質魅力星同宮"),
  rule("A09", "外貌", "扣分", -10, `m."化忌宮位"='命宮'`, "命宮化忌影響和諧感"),
  rule("A10", "外貌", "扣分", -8, anyLike([p("命宮")], ["擎羊","陀羅","火星","鈴星","地空","地劫"]), "命宮煞曜降低和諧穩定"),

  rule("C01", "事業", "加分", 13, `((m."紫微宮位" IN ('命宮','官祿') AND m."紫微星等" IN ('廟','旺')) OR (m."武曲宮位" IN ('命宮','官祿') AND m."武曲星等" IN ('廟','旺')) OR (m."天府宮位" IN ('命宮','官祿') AND m."天府星等" IN ('廟','旺')) OR (m."天相宮位" IN ('命宮','官祿') AND m."天相星等" IN ('廟','旺')))`, "紫武府相廟旺在命官"),
  rule("C02", "事業", "加分", 9, `((m."七殺宮位" IN ('命宮','官祿') AND m."七殺星等" IN ('廟','旺')) OR (m."破軍宮位" IN ('命宮','官祿') AND m."破軍星等" IN ('廟','旺')) OR (m."貪狼宮位" IN ('命宮','官祿') AND m."貪狼星等" IN ('廟','旺')))`, "殺破狼得地具開創執行力"),
  rule("C03", "事業", "加分", 14, `m."化權宮位" IN ('命宮','官祿')`, "命官化權"),
  rule("C04", "事業", "加分", 9, `m."化科宮位" IN ('命宮','官祿')`, "命官化科帶來專業認可"),
  rule("C05", "事業", "加分", 9, anyLike(coreCareer, ["左輔","右弼","天魁","天鉞"]), "事業三方見左右魁鉞"),
  rule("C06", "事業", "組合", 9, `(${anyLike([p("命宮"),p("官祿")], ["紫微","武曲","七殺","破軍","貪狼"])} AND m."化權宮位" IN ('命宮','官祿','財帛'))`, "領導開創主星得權"),
  rule("C07", "事業", "扣分", -20, `m."化忌宮位" IN ('命宮','官祿')`, "命官化忌"),
  rule("C08", "事業", "扣分", -11, anyLike([p("官祿"),p("遷移")], ["地空","地劫"]), "官遷受空劫影響"),
  rule("C09", "事業", "扣分", -7, anyLike([p("官祿")], ["擎羊","陀羅","火星","鈴星"]), "官祿煞曜增加職涯波動"),

  rule("S01", "社交", "加分", 10, `((m."貪狼宮位" IN ('命宮','僕役','遷移') AND m."貪狼星等" IN ('廟','旺')) OR (m."太陽宮位" IN ('命宮','僕役','遷移') AND m."太陽星等" IN ('廟','旺')) OR (m."天同宮位" IN ('命宮','僕役','遷移') AND m."天同星等" IN ('廟','旺')))`, "社交主星得地在命僕遷"),
  rule("S02", "社交", "加分", 9, anyLike(coreSocial, ["左輔","右弼"]), "社交宮位見左右"),
  rule("S03", "社交", "加分", 9, anyLike(coreSocial, ["天魁","天鉞"]), "社交宮位見魁鉞"),
  rule("S04", "社交", "加分", 7, anyLike(coreSocial, ["文昌","文曲"]), "社交宮位見昌曲"),
  rule("S05", "社交", "加分", 7, anyLike(coreSocial, ["紅鸞","天喜","天姚","咸池"]), "人際宮位見桃花曜"),
  rule("S06", "社交", "加分", 7, `m."化祿宮位" IN ('命宮','僕役','遷移') OR m."化科宮位" IN ('命宮','僕役','遷移')`, "命僕遷得祿科"),
  rule("S07", "社交", "組合", 8, `(${anyLike([p("命宮"),p("僕役"),p("遷移")], ["貪狼","太陽","天同","巨門"])} AND ${anyLike(coreSocial, ["左輔","右弼","天魁","天鉞"])})`, "社交主星與助力星跨宮連動"),
  rule("S08", "社交", "扣分", -14, `m."化忌宮位" IN ('命宮','僕役','遷移','夫妻')`, "人際核心宮位化忌"),
  rule("S09", "社交", "扣分", -9, anyLike([p("僕役"),p("遷移")], ["擎羊","陀羅","地空","地劫"]), "僕役遷移見衝突孤立星"),

  rule("F01", "家庭助力", "加分", 11, anyLike([p("父母")], ["紫微","天府","太陽","太陰"]), "父母宮見家庭資源主星"),
  rule("F02", "家庭助力", "加分", 10, anyLike([p("父母")], ["左輔","右弼","天魁","天鉞"]), "父母宮見左右魁鉞"),
  rule("F03", "家庭助力", "加分", 15, `m."化祿宮位" IN ('父母','田宅')`, "父母或田宅化祿"),
  rule("F04", "家庭助力", "加分", 9, `((m."天府宮位"='田宅' AND m."天府星等" IN ('廟','旺')) OR (m."太陰宮位"='田宅' AND m."太陰星等" IN ('廟','旺')) OR (m."武曲宮位"='田宅' AND m."武曲星等" IN ('廟','旺')))`, "田宅財庫星廟旺"),
  rule("F05", "家庭助力", "加分", 8, anyLike(coreFamily, ["祿存"]), "家庭相關宮位見祿存"),
  rule("F06", "家庭助力", "組合", 10, `(${anyLike([p("父母")], ["紫微","天府","太陽","太陰"])} AND ${anyLike([p("田宅")], ["天府","太陰","武曲","祿存"])})`, "父母資源與田宅累積連動"),
  rule("F07", "家庭助力", "扣分", -20, `m."化忌宮位" IN ('父母','田宅')`, "父母田宅化忌"),
  rule("F08", "家庭助力", "扣分", -11, anyLike([p("父母"),p("田宅")], ["地空","地劫"]), "父母田宅受空劫影響"),
  rule("F09", "家庭助力", "扣分", -7, anyLike([p("父母")], ["擎羊","陀羅","火星","鈴星"]), "父母宮主要煞曜"),

  rule("B01", "福體", "加分", 13, `((m."天同宮位"='福德' AND m."天同星等" IN ('廟','旺')) OR (m."天府宮位"='福德' AND m."天府星等" IN ('廟','旺')) OR (m."太陰宮位"='福德' AND m."太陰星等" IN ('廟','旺')))`, "福德宮福星廟旺"),
  rule("B02", "福體", "加分", 9, anyLike([p("命宮"),p("福德")], ["天府","天同","太陰","天相"]), "命福具穩定型主星"),
  rule("B03", "福體", "加分", 11, `m."化祿宮位" IN ('命宮','福德')`, "命福化祿"),
  rule("B04", "福體", "加分", 8, `m."化科宮位" IN ('命宮','福德','疾厄')`, "命福疾化科"),
  rule("B05", "福體", "加分", 8, anyLike(coreWellbeing, ["左輔","右弼","天魁","天鉞"]), "命福疾有助力星"),
  rule("B06", "福體", "組合", 9, `(${anyLike([p("命宮"),p("福德")], ["天府","天同","太陰","天相"])} AND ${anyLike(coreWellbeing, ["左輔","右弼","天魁","天鉞","祿存"])})`, "穩定主星與助力資源連動"),
  rule("B07", "福體", "扣分", -20, `m."化忌宮位" IN ('命宮','福德','疾厄')`, "命福疾化忌"),
  rule("B08", "福體", "扣分", -11, anyLike(coreWellbeing, ["地空","地劫"]), "命福疾見空劫"),
  rule("B09", "福體", "扣分", -9, anyLike([p("命宮"),p("疾厄")], ["擎羊","陀羅","火星","鈴星"]), "命疾主要煞曜影響穩定"),
];

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const clamp = (expression) => `ROUND(MAX(0, MIN(100, ${expression})), 2)`;

export function scoringColumns() {
  return [...DIMENSIONS, "綜合"].flatMap((dimension) => [
    { name: `${dimension}分`, type: "REAL" },
    { name: `${dimension}排名`, type: "TEXT" },
    { name: `${dimension}百分位`, type: "REAL" },
  ]);
}

export function buildScoringTables(db) {
  db.run('DROP VIEW IF EXISTS "命盤完整評分"');
  db.run('DROP TABLE IF EXISTS "命盤評分"');
  db.run('DROP TABLE IF EXISTS "評分規則"');
  db.run('DROP TABLE IF EXISTS "評分維度"');
  db.run('DROP TABLE IF EXISTS "排名門檻"');
  db.run('CREATE TABLE "評分規則" ("規則ID" TEXT PRIMARY KEY, "維度" TEXT NOT NULL, "類型" TEXT NOT NULL, "權重" REAL NOT NULL, "條件SQL" TEXT NOT NULL, "說明" TEXT NOT NULL)');
  const ruleInsert = db.prepare('INSERT INTO "評分規則" VALUES (?, ?, ?, ?, ?, ?)');
  for (const item of SCORE_RULES) ruleInsert.run([item.id, item.dimension, item.kind, item.weight, item.condition, item.description]);
  ruleInsert.free();
  db.run('CREATE TABLE "評分維度" ("維度" TEXT PRIMARY KEY, "基礎分" REAL NOT NULL, "綜合權重" REAL NOT NULL)');
  const dimensionInsert = db.prepare('INSERT INTO "評分維度" VALUES (?, ?, ?)');
  for (const dimension of DIMENSIONS) dimensionInsert.run([dimension, DIMENSION_CONFIG[dimension].baseScore, DIMENSION_CONFIG[dimension].overallWeight]);
  dimensionInsert.free();
  db.run('CREATE TABLE "排名門檻" ("排名" TEXT PRIMARY KEY, "最低百分位" REAL NOT NULL)');
  const thresholdInsert = db.prepare('INSERT INTO "排名門檻" VALUES (?, ?)');
  for (const item of RANK_THRESHOLDS) thresholdInsert.run(item);
  thresholdInsert.free();

  const dimensionScores = DIMENSIONS.map((dimension) => {
    const terms = SCORE_RULES.filter((item) => item.dimension === dimension).map((item) => `CASE WHEN ${item.condition} THEN ${item.weight} ELSE 0 END`);
    return `${clamp(`${DIMENSION_CONFIG[dimension].baseScore} + ${terms.join(" + ")}`)} AS "${dimension}分"`;
  });
  db.run(`CREATE TEMP TABLE "_維度分數" AS SELECT m."KEY", ${dimensionScores.join(", ")} FROM "命盤" m`);
  const overall = DIMENSIONS.map((dimension) => `"${dimension}分" * ${DIMENSION_CONFIG[dimension].overallWeight}`).join(" + ");
  db.run(`CREATE TEMP TABLE "_全部分數" AS SELECT *, ROUND(${overall}, 2) AS "綜合分" FROM "_維度分數"`);
  const allDimensions = [...DIMENSIONS, "綜合"];
  const percentiles = allDimensions.map((dimension) => `ROUND(PERCENT_RANK() OVER (ORDER BY "${dimension}分" ASC) * 100, 2) AS "${dimension}百分位"`);
  db.run(`CREATE TEMP TABLE "_含百分位" AS SELECT *, ${percentiles.join(", ")} FROM "_全部分數"`);
  const schema = allDimensions.flatMap((dimension) => [`"${dimension}分" REAL NOT NULL`, `"${dimension}排名" TEXT NOT NULL`, `"${dimension}百分位" REAL NOT NULL`]);
  db.run(`CREATE TABLE "命盤評分" ("KEY" TEXT PRIMARY KEY REFERENCES "命盤"("KEY"), ${schema.join(", ")})`);
  const rankCase = (dimension) => `CASE ${RANK_THRESHOLDS.map(([rank, minimum]) => `WHEN "${dimension}百分位" >= ${minimum} THEN ${quote(rank)}`).join(" ")} END`;
  const values = allDimensions.flatMap((dimension) => [`"${dimension}分"`, `${rankCase(dimension)} AS "${dimension}排名"`, `"${dimension}百分位"`]);
  db.run(`INSERT INTO "命盤評分" SELECT "KEY", ${values.join(", ")} FROM "_含百分位"`);
  for (const dimension of allDimensions) db.run(`CREATE INDEX "idx_評分_${dimension}" ON "命盤評分"("${dimension}排名", "${dimension}分" DESC)`);
  db.run('DROP TABLE "_維度分數"');
  db.run('DROP TABLE "_全部分數"');
  db.run('DROP TABLE "_含百分位"');
  const scoreProjection = scoringColumns().map(({ name }) => `r."${name}"`).join(", ");
  db.run(`CREATE VIEW "命盤完整評分" AS SELECT m.*, ${scoreProjection} FROM "命盤" m JOIN "命盤評分" r ON r."KEY" = m."KEY"`);
}
