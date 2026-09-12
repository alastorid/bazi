(() => {
  "use strict";

  const GROUPS = [
    ["overview", "吉凶格總覽"], ["good", "吉格"], ["bad", "凶格"],
    ["compare", "格局對照"], ["catalog", "規則目錄"],
  ];
  const raw = (key, group, label, description, sql) => ({ key, group, label, description, sql });
  const detailSelect = ({ where = `d."吉凶" IN ('吉','凶')`, order = `d."結構稀有度" DESC, m."公曆日期", m."時辰序號", m."性別"` } = {}) => `SELECT TOP 1000
  m."KEY", m."命盤連結", m."公曆日期", m."時辰", m."性別",
  d."名稱" AS "格局", d."類型", d."吉凶", d."結構稀有度",
  d."成格條件", d."教材結果"
FROM "命盤" m
JOIN "命盤格局明細" d ON d."KEY" = m."KEY"
WHERE (${where}) AND d."結構稀有度" BETWEEN 1 AND 5
ORDER BY ${order};`;

  // 資料庫欄位沿用繁體中文既有 schema；介面標籤統一為中文。
  const definitions = [
    raw("rare_all", "overview", "全期稀有吉凶格", "預設查詢：同時列出吉格與凶格，結構稀有度高者優先。", detailSelect()),
    raw("chart_patterns", "overview", "單盤全部格局", "按日期、時辰與性別檢視每張命盤命中的全部吉凶格。", detailSelect({ order: `m."公曆日期", m."時辰序號", m."性別", d."吉凶", d."結構稀有度" DESC` })),
    raw("supplemental_dates", "overview", "指定日期吉凶格", "查看 1946-06-14 與 1991-12-19 的全部男女時辰及其吉凶格。", `SELECT TOP 1000
  m."KEY", m."命盤連結", m."公曆日期", m."時辰", m."性別",
  SUM(CASE WHEN d."吉凶"='吉' THEN 1 ELSE 0 END) AS "吉格數",
  SUM(CASE WHEN d."吉凶"='凶' THEN 1 ELSE 0 END) AS "凶格數",
  GROUP_CONCAT(CASE WHEN d."吉凶"='吉' THEN d."名稱" END, '、') AS "吉格",
  GROUP_CONCAT(CASE WHEN d."吉凶"='凶' THEN d."名稱" END, '、') AS "凶格"
FROM "命盤" m LEFT JOIN "命盤格局明細" d ON d."KEY"=m."KEY"
  AND d."吉凶" IN ('吉','凶') AND d."結構稀有度" BETWEEN 1 AND 5
WHERE m."公曆日期" IN ('1946-06-14','1991-12-19')
GROUP BY m."KEY", m."命盤連結", m."公曆日期", m."時辰", m."時辰序號", m."性別"
ORDER BY m."公曆日期", m."時辰序號", m."性別";`),
    raw("good_rare", "good", "稀有吉格", "只列教材明確、可計算的吉格。", detailSelect({ where: `d."吉凶"='吉'`, order: `d."結構稀有度" DESC, m."公曆日期", m."時辰序號", m."性別"` })),
    raw("good_formal", "good", "正式吉格", "只看正式格局，不把一般組合混作格。", detailSelect({ where: `d."吉凶"='吉' AND d."類型"='正式格局'` })),
    raw("good_strong", "good", "吉性強組合", "科權祿、財官雙美、昌曲魁鉞等教材強組合。", detailSelect({ where: `d."吉凶"='吉' AND d."類型" IN ('強組合','條件組合')` })),
    raw("bad_rare", "bad", "稀有凶格", "只列教材明確、可計算的凶格。", detailSelect({ where: `d."吉凶"='凶'`, order: `d."結構稀有度" DESC, m."公曆日期", m."時辰序號", m."性別"` })),
    raw("bad_formal", "bad", "正式凶格", "正式凶格依結構稀有度排序。", detailSelect({ where: `d."吉凶"='凶' AND d."類型"='正式格局'` })),
    raw("brightness_patterns", "compare", "亮度依賴組合", "只看結果會隨廟旺、落陷改變的條件組合。", detailSelect({ where: `d."名稱" IN ('廉貞七殺同宮','廉殺廟旺','廉殺落陷','武曲七殺同宮','武殺落陷')` })),
    raw("both_polarities", "compare", "同盤吉凶並見", "找出同一命盤同時出現吉格與凶格的時段。", `SELECT TOP 1000
  m."KEY", m."命盤連結", m."公曆日期", m."時辰", m."性別",
  MAX(CASE WHEN d."吉凶"='吉' THEN d."結構稀有度" END) AS "最高吉格稀有度",
  MAX(CASE WHEN d."吉凶"='凶' THEN d."結構稀有度" END) AS "最高凶格稀有度",
  GROUP_CONCAT(CASE WHEN d."吉凶"='吉' THEN d."名稱" END, '、') AS "吉格",
  GROUP_CONCAT(CASE WHEN d."吉凶"='凶' THEN d."名稱" END, '、') AS "凶格"
FROM "命盤" m JOIN "命盤格局明細" d ON d."KEY"=m."KEY"
WHERE d."吉凶" IN ('吉','凶') AND d."結構稀有度" BETWEEN 1 AND 5
GROUP BY m."KEY", m."命盤連結", m."公曆日期", m."時辰", m."性別"
HAVING COUNT(CASE WHEN d."吉凶"='吉' THEN 1 END)>0 AND COUNT(CASE WHEN d."吉凶"='凶' THEN 1 END)>0
ORDER BY "最高吉格稀有度" DESC, "最高凶格稀有度" DESC, m."公曆日期";`),
    raw("pattern_frequency", "compare", "格局出現次數", "統計目前資料範圍內各格局在男女命盤中的出現次數；不是出生人口機率。", `SELECT TOP 1000
  d."名稱" AS "格局", d."類型", d."吉凶", d."結構稀有度",
  SUM(CASE WHEN m."性別"='女' THEN 1 ELSE 0 END) AS "女命次數",
  SUM(CASE WHEN m."性別"='男' THEN 1 ELSE 0 END) AS "男命次數",
  COUNT(*) AS "總次數", d."成格條件", d."教材結果"
FROM "命盤格局明細" d JOIN "命盤" m ON m."KEY"=d."KEY"
WHERE d."吉凶" IN ('吉','凶') AND d."結構稀有度" BETWEEN 1 AND 5
GROUP BY d."規則ID", d."名稱", d."類型", d."吉凶", d."結構稀有度", d."成格條件", d."教材結果"
ORDER BY d."結構稀有度" DESC, "總次數", d."名稱";`),
    raw("month_frequency", "compare", "每月吉凶格", "按年月比較吉格、凶格命中次數與最高結構稀有度。", `SELECT TOP 1000
  m."年", m."月",
  SUM(CASE WHEN d."吉凶"='吉' THEN 1 ELSE 0 END) AS "吉格次數",
  SUM(CASE WHEN d."吉凶"='凶' THEN 1 ELSE 0 END) AS "凶格次數",
  MAX(CASE WHEN d."吉凶"='吉' THEN d."結構稀有度" END) AS "最高吉格稀有度",
  MAX(CASE WHEN d."吉凶"='凶' THEN d."結構稀有度" END) AS "最高凶格稀有度"
FROM "命盤" m JOIN "命盤格局明細" d ON d."KEY"=m."KEY"
WHERE d."吉凶" IN ('吉','凶') AND d."結構稀有度" BETWEEN 1 AND 5
GROUP BY m."年", m."月" ORDER BY m."年", m."月";`),
    raw("pattern_catalog", "catalog", "格局規則目錄", "檢查格局類別、結構稀有度、證據完整度與是否可計算。", `SELECT TOP 1000
  "名稱", "類型", "嚴格度", "結構稀有度", "稀有度說明", "吉凶",
  "完整解釋", "可計算", "相關星曜", "成格條件", "教材結果"
FROM "格局規則" ORDER BY "可計算" DESC, "結構稀有度" DESC, "名稱";`),
    raw("incomplete_catalog", "catalog", "未完整格名", "教材提過名稱但條件或結果不足者，只進目錄，不生成命盤旗標。", `SELECT TOP 1000
  "名稱", "類型", "嚴格度", "結構稀有度", "吉凶",
  "完整解釋", "可計算", "相關星曜", "成格條件", "教材結果"
FROM "格局規則" WHERE "完整解釋"=0 OR "可計算"=0 ORDER BY "名稱";`),
    raw("relationship_catalog", "catalog", "兩盤關係格目錄", "母子格等是兩人命盤關係，不進入單盤吉凶圖。", `SELECT TOP 1000
  "名稱", "類型", "適用範圍", "完整解釋", "條件說明"
FROM "關係格局規則" ORDER BY "完整解釋" DESC, "名稱";`),
  ];

  const queries = Object.fromEntries(definitions.map((item) => [item.key, item.sql]));
  const labels = Object.fromEntries(definitions.map((item) => [item.key, item.label]));
  const metadata = Object.fromEntries(definitions.map((item) => [item.key, Object.freeze({ key: item.key, group: item.group, label: item.label, description: item.description })]));
  const groups = Object.fromEntries(GROUPS.map(([id, title]) => [title, definitions.filter((item) => item.group === id).map((item) => item.key)]));
  window.BAZI_QUERY_LIBRARY = Object.freeze({ definitions: Object.freeze(definitions), metadata: Object.freeze(metadata), queries: Object.freeze(queries), groups: Object.freeze(groups), labels: Object.freeze(labels), defaultQuery: "rare_all" });
})();
