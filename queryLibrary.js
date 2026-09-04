(() => {
  "use strict";
const SAMPLE_QUERIES = {
  // ============================================================
  // 👑 SSR / SSS 綜合頂配
  // ============================================================
  ssr_all: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "財帛主星", "官祿主星", "田宅主星",
  "命宮全部星", "財帛全部星", "官祿全部星", "田宅全部星",
  "化祿星", "化祿宮位",
  "化權星", "化權宮位",
  "化科星", "化科宮位",
  "化忌星", "化忌宮位"
FROM "命盤"
WHERE "化忌宮位" NOT IN ('命宮', '財帛', '官祿', '田宅')
  AND "化祿宮位" IN ('命宮', '財帛', '官祿', '田宅')
  AND (
       ("武曲宮位" IN ('財帛', '官祿', '田宅')
        AND "武曲星等" IN ('廟', '旺'))
    OR ("天府宮位" IN ('財帛', '官祿', '田宅')
        AND "天府星等" IN ('廟', '旺'))
    OR ("太陰宮位" IN ('財帛', '官祿', '田宅')
        AND "太陰星等" IN ('廟', '旺'))
  )
  AND (
       "財帛全部星" LIKE '%祿存%'
    OR "官祿全部星" LIKE '%祿存%'
    OR "田宅全部星" LIKE '%祿存%'
    OR "化權宮位" IN ('命宮', '財帛', '官祿', '田宅')
    OR "化科宮位" IN ('命宮', '財帛', '官祿', '田宅')
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  sss_all: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "財帛主星", "官祿主星", "田宅主星",
  "命宮全部星", "財帛全部星", "官祿全部星", "田宅全部星",
  "化祿星", "化祿宮位",
  "化權星", "化權宮位",
  "化科星", "化科宮位",
  "化忌星", "化忌宮位"
FROM "命盤"
WHERE "化祿宮位" IN ('命宮', '財帛', '官祿', '田宅')
  AND "化權宮位" IN ('命宮', '財帛', '官祿', '田宅')
  AND "化科宮位" IN ('命宮', '財帛', '官祿', '田宅', '遷移')
  AND "化忌宮位" NOT IN ('命宮', '財帛', '官祿', '田宅')
  AND (
       "財帛全部星" LIKE '%祿存%'
    OR "官祿全部星" LIKE '%祿存%'
    OR "田宅全部星" LIKE '%祿存%'
  )
  AND (
       ("武曲宮位" IN ('財帛', '官祿', '田宅')
         AND "武曲星等" IN ('廟', '旺'))
    OR ("天府宮位" IN ('財帛', '官祿', '田宅')
         AND "天府星等" IN ('廟', '旺'))
  )
  AND (
       "命宮全部星" LIKE '%左輔%'
    OR "命宮全部星" LIKE '%右弼%'
    OR "命宮全部星" LIKE '%天魁%'
    OR "命宮全部星" LIKE '%天鉞%'
    OR "官祿全部星" LIKE '%左輔%'
    OR "官祿全部星" LIKE '%右弼%'
    OR "官祿全部星" LIKE '%天魁%'
    OR "官祿全部星" LIKE '%天鉞%'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  ssr_noble: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "命宮全部星",
  "官祿主星", "官祿全部星",
  "化祿星", "化祿宮位",
  "化權星", "化權宮位",
  "化科星", "化科宮位",
  "化忌宮位"
FROM "命盤"
WHERE (
       "命宮主星" LIKE '%紫微%'
    OR "命宮主星" LIKE '%天府%'
    OR "命宮主星" LIKE '%武曲%'
    OR "命宮主星" LIKE '%天相%'
  )
  AND (
       "官祿主星" LIKE '%紫微%'
    OR "官祿主星" LIKE '%天府%'
    OR "官祿主星" LIKE '%武曲%'
    OR "官祿主星" LIKE '%天相%'
  )
  AND "化忌宮位" NOT IN ('命宮', '官祿', '財帛')
  AND (
       "命宮全部星" LIKE '%左輔%'
    OR "命宮全部星" LIKE '%右弼%'
    OR "命宮全部星" LIKE '%天魁%'
    OR "命宮全部星" LIKE '%天鉞%'
    OR "官祿全部星" LIKE '%左輔%'
    OR "官祿全部星" LIKE '%右弼%'
    OR "官祿全部星" LIKE '%天魁%'
    OR "官祿全部星" LIKE '%天鉞%'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  // ============================================================
  // 💰 財富
  // ============================================================
  sr_income: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "財帛主星", "財帛全部星",
  "官祿主星", "官祿全部星",
  "田宅主星",
  "武曲星等", "天府星等",
  "化祿星", "化祿宮位",
  "化權星", "化權宮位",
  "化忌宮位"
FROM "命盤"
WHERE (
       ("武曲宮位" = '財帛' AND "武曲星等" IN ('廟', '旺'))
    OR ("天府宮位" = '財帛' AND "天府星等" IN ('廟', '旺'))
  )
  AND (
       "財帛全部星" LIKE '%祿存%'
    OR "化祿宮位" = '財帛'
  )
  AND "化忌宮位" <> '財帛'
ORDER BY "公曆日期", "時辰序號", "性別";`,
  sr_super_income: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "財帛主星", "財帛全部星",
  "官祿主星", "官祿全部星",
  "武曲星等", "天府星等",
  "化祿星", "化祿宮位",
  "化權星", "化權宮位",
  "化科宮位", "化忌宮位"
FROM "命盤"
WHERE (
       ("武曲宮位" = '財帛' AND "武曲星等" IN ('廟', '旺'))
    OR ("天府宮位" = '財帛' AND "天府星等" IN ('廟', '旺'))
  )
  AND "財帛全部星" LIKE '%祿存%'
  AND "化祿宮位" IN ('財帛', '官祿')
  AND "化權宮位" IN ('命宮', '財帛', '官祿')
  AND "化忌宮位" NOT IN ('財帛', '官祿')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  sr_asset: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "財帛主星", "財帛全部星",
  "田宅主星", "田宅全部星",
  "天府星等", "太陰星等", "武曲星等",
  "化祿星", "化祿宮位", "化忌宮位"
FROM "命盤"
WHERE (
       "田宅主星" LIKE '%天府%'
    OR "田宅主星" LIKE '%太陰%'
    OR "田宅主星" LIKE '%武曲%'
  )
  AND (
       "財帛主星" LIKE '%天府%'
    OR "財帛主星" LIKE '%太陰%'
    OR "財帛主星" LIKE '%武曲%'
  )
  AND "化祿宮位" IN ('財帛', '田宅')
  AND "化忌宮位" NOT IN ('財帛', '田宅')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  sr_property_king: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "田宅主星", "田宅全部星",
  "財帛主星", "財帛全部星",
  "太陰星等", "天府星等", "武曲星等",
  "化祿宮位", "化權宮位", "化忌宮位"
FROM "命盤"
WHERE (
       ("太陰宮位" = '田宅' AND "太陰星等" IN ('廟', '旺'))
    OR ("天府宮位" = '田宅' AND "天府星等" IN ('廟', '旺'))
    OR ("武曲宮位" = '田宅' AND "武曲星等" IN ('廟', '旺'))
  )
  AND (
       "田宅全部星" LIKE '%祿存%'
    OR "化祿宮位" = '田宅'
  )
  AND "化忌宮位" <> '田宅'
ORDER BY "公曆日期", "時辰序號", "性別";`,
  sr_wealth_storage: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "財帛主星", "財帛全部星",
  "田宅主星", "田宅全部星",
  "化祿宮位", "化權宮位", "化科宮位", "化忌宮位"
FROM "命盤"
WHERE (
       "財帛主星" LIKE '%天府%'
    OR "財帛主星" LIKE '%武曲%'
    OR "財帛主星" LIKE '%太陰%'
  )
  AND (
       "田宅主星" LIKE '%天府%'
    OR "田宅主星" LIKE '%武曲%'
    OR "田宅主星" LIKE '%太陰%'
  )
  AND (
       "財帛全部星" LIKE '%祿存%'
    OR "田宅全部星" LIKE '%祿存%'
  )
  AND "化忌宮位" NOT IN ('財帛', '田宅')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  // ============================================================
  // 🎰 橫財 / 爆發財 / 創業
  // ============================================================
  sr_windfall: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "財帛主星", "財帛全部星",
  "遷移主星", "遷移全部星",
  "貪狼星等", "破軍星等", "七殺星等",
  "化祿星", "化祿宮位",
  "化權星", "化權宮位"
FROM "命盤"
WHERE (
       "財帛主星" LIKE '%貪狼%'
    OR "財帛主星" LIKE '%破軍%'
    OR "財帛主星" LIKE '%七殺%'
  )
  AND (
       "財帛全部星" LIKE '%火星%'
    OR "財帛全部星" LIKE '%鈴星%'
    OR "遷移全部星" LIKE '%火星%'
    OR "遷移全部星" LIKE '%鈴星%'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  ssr_windfall: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星",
  "財帛主星", "財帛全部星",
  "官祿主星", "官祿全部星",
  "遷移主星", "遷移全部星",
  "貪狼星等", "破軍星等", "七殺星等",
  "化祿星", "化祿宮位",
  "化權星", "化權宮位",
  "化忌宮位"
FROM "命盤"
WHERE (
       "財帛主星" LIKE '%貪狼%'
    OR "財帛主星" LIKE '%破軍%'
    OR "財帛主星" LIKE '%七殺%'
    OR "官祿主星" LIKE '%貪狼%'
    OR "官祿主星" LIKE '%破軍%'
    OR "官祿主星" LIKE '%七殺%'
  )
  AND "化祿宮位" IN ('財帛', '官祿', '遷移')
  AND "化權宮位" IN ('命宮', '財帛', '官祿', '遷移')
  AND "化忌宮位" NOT IN ('財帛', '官祿')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  fire_greed: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "財帛主星", "官祿主星", "遷移主星",
  "命宮全部星", "財帛全部星", "官祿全部星", "遷移全部星",
  "貪狼星等", "化祿宮位", "化權宮位"
FROM "命盤"
WHERE "貪狼宮位" IN ('命宮', '財帛', '官祿', '遷移')
  AND (
       "命宮全部星" LIKE '%火星%'
    OR "財帛全部星" LIKE '%火星%'
    OR "官祿全部星" LIKE '%火星%'
    OR "遷移全部星" LIKE '%火星%'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  bell_greed: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "財帛主星", "官祿主星", "遷移主星",
  "命宮全部星", "財帛全部星", "官祿全部星", "遷移全部星",
  "貪狼星等", "化祿宮位", "化權宮位"
FROM "命盤"
WHERE "貪狼宮位" IN ('命宮', '財帛', '官祿', '遷移')
  AND (
       "命宮全部星" LIKE '%鈴星%'
    OR "財帛全部星" LIKE '%鈴星%'
    OR "官祿全部星" LIKE '%鈴星%'
    OR "遷移全部星" LIKE '%鈴星%'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  sr_business: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "財帛主星", "財帛全部星",
  "遷移主星", "遷移全部星",
  "貪狼星等", "巨門星等", "武曲星等",
  "化祿星", "化祿宮位",
  "化權星", "化權宮位"
FROM "命盤"
WHERE (
       "財帛主星" LIKE '%貪狼%'
    OR "財帛主星" LIKE '%巨門%'
    OR "財帛主星" LIKE '%武曲%'
  )
  AND (
       "化祿宮位" IN ('財帛', '遷移')
    OR "化權宮位" IN ('財帛', '遷移')
  )
  AND (
       "財帛全部星" LIKE '%文昌%'
    OR "財帛全部星" LIKE '%文曲%'
    OR "財帛全部星" LIKE '%左輔%'
    OR "財帛全部星" LIKE '%右弼%'
    OR "遷移全部星" LIKE '%文昌%'
    OR "遷移全部星" LIKE '%文曲%'
    OR "遷移全部星" LIKE '%左輔%'
    OR "遷移全部星" LIKE '%右弼%'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  startup_boss: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "官祿主星", "財帛主星", "遷移主星",
  "官祿全部星", "財帛全部星",
  "七殺星等", "破軍星等", "貪狼星等", "武曲星等",
  "化祿宮位", "化權宮位", "化忌宮位"
FROM "命盤"
WHERE (
       "官祿主星" LIKE '%七殺%'
    OR "官祿主星" LIKE '%破軍%'
    OR "官祿主星" LIKE '%貪狼%'
    OR "官祿主星" LIKE '%武曲%'
  )
  AND "化權宮位" IN ('命宮', '官祿', '財帛')
  AND "化祿宮位" IN ('官祿', '財帛', '遷移')
  AND "化忌宮位" NOT IN ('官祿', '財帛')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  // ============================================================
  // 👸 外貌 / 顏值 / 桃花
  // ============================================================
  beauty_sweet: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "命宮全部星",
  "天同星等", "太陰星等",
  "化祿星", "化祿宮位",
  "化科星", "化科宮位"
FROM "命盤"
WHERE "天同宮位" = '命宮'
  AND (
       "天同星等" IN ('廟', '旺')
    OR "太陰宮位" = '命宮'
    OR "命宮全部星" LIKE '%太陰%'
  )
  AND (
       "命宮全部星" LIKE '%文昌%'
    OR "命宮全部星" LIKE '%文曲%'
    OR "命宮全部星" LIKE '%紅鸞%'
    OR "命宮全部星" LIKE '%天喜%'
    OR "命宮全部星" LIKE '%天姚%'
    OR "化科宮位" = '命宮'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  beauty_elegant: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "命宮全部星",
  "太陰星等", "天相星等",
  "化科星", "化科宮位"
FROM "命盤"
WHERE (
       ("太陰宮位" = '命宮' AND "太陰星等" IN ('廟', '旺'))
    OR ("天相宮位" = '命宮' AND "天相星等" IN ('廟', '旺'))
  )
  AND (
       "命宮全部星" LIKE '%文昌%'
    OR "命宮全部星" LIKE '%文曲%'
    OR "命宮全部星" LIKE '%天魁%'
    OR "命宮全部星" LIKE '%天鉞%'
    OR "化科宮位" = '命宮'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  beauty_glamour: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "命宮全部星",
  "貪狼星等", "廉貞星等",
  "化祿宮位", "化科宮位"
FROM "命盤"
WHERE (
       "貪狼宮位" = '命宮'
    OR "廉貞宮位" = '命宮'
  )
  AND (
       "命宮全部星" LIKE '%紅鸞%'
    OR "命宮全部星" LIKE '%天喜%'
    OR "命宮全部星" LIKE '%天姚%'
    OR "命宮全部星" LIKE '%咸池%'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  beauty_noble: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "命宮全部星",
  "紫微星等", "天府星等", "天相星等",
  "化科宮位", "化祿宮位"
FROM "命盤"
WHERE (
       "紫微宮位" = '命宮'
    OR "天府宮位" = '命宮'
    OR "天相宮位" = '命宮'
  )
  AND (
       "命宮全部星" LIKE '%左輔%'
    OR "命宮全部星" LIKE '%右弼%'
    OR "命宮全部星" LIKE '%天魁%'
    OR "命宮全部星" LIKE '%天鉞%'
    OR "命宮全部星" LIKE '%文昌%'
    OR "命宮全部星" LIKE '%文曲%'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  peach_blossom: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "命宮全部星",
  "夫妻主星", "夫妻全部星",
  "貪狼星等", "廉貞星等"
FROM "命盤"
WHERE (
       "命宮全部星" LIKE '%紅鸞%'
    OR "命宮全部星" LIKE '%天喜%'
    OR "命宮全部星" LIKE '%天姚%'
    OR "命宮全部星" LIKE '%咸池%'
    OR "夫妻全部星" LIKE '%紅鸞%'
    OR "夫妻全部星" LIKE '%天喜%'
    OR "夫妻全部星" LIKE '%天姚%'
    OR "夫妻全部星" LIKE '%咸池%'
  )
  AND (
       "命宮主星" LIKE '%貪狼%'
    OR "命宮主星" LIKE '%廉貞%'
    OR "命宮主星" LIKE '%太陰%'
    OR "命宮主星" LIKE '%天同%'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  // ============================================================
  // 💖 顏值 + 財運混合
  // ============================================================
  sweet_rich: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "命宮全部星",
  "財帛主星", "官祿主星", "田宅主星",
  "天同星等", "太陰星等", "武曲星等", "天府星等",
  "化祿宮位", "化權宮位", "化科宮位", "化忌宮位"
FROM "命盤"
WHERE "天同宮位" = '命宮'
  AND (
       "天同星等" IN ('廟', '旺')
    OR "命宮全部星" LIKE '%太陰%'
    OR "命宮全部星" LIKE '%文昌%'
    OR "命宮全部星" LIKE '%文曲%'
  )
  AND "化祿宮位" IN ('命宮', '財帛', '官祿', '田宅')
  AND "化忌宮位" NOT IN ('命宮', '財帛', '官祿', '田宅')
  AND (
       ("武曲宮位" IN ('財帛', '官祿', '田宅')
         AND "武曲星等" IN ('廟', '旺'))
    OR ("天府宮位" IN ('財帛', '官祿', '田宅')
         AND "天府星等" IN ('廟', '旺'))
    OR ("太陰宮位" IN ('財帛', '官祿', '田宅')
         AND "太陰星等" IN ('廟', '旺'))
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  princess_rich: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "命宮全部星",
  "財帛主星", "官祿主星", "田宅主星",
  "化祿宮位", "化權宮位", "化科宮位", "化忌宮位"
FROM "命盤"
WHERE (
       "命宮主星" LIKE '%紫微%'
    OR "命宮主星" LIKE '%天府%'
    OR "命宮主星" LIKE '%天相%'
    OR "命宮主星" LIKE '%太陰%'
  )
  AND (
       "命宮全部星" LIKE '%左輔%'
    OR "命宮全部星" LIKE '%右弼%'
    OR "命宮全部星" LIKE '%天魁%'
    OR "命宮全部星" LIKE '%天鉞%'
    OR "命宮全部星" LIKE '%文昌%'
    OR "命宮全部星" LIKE '%文曲%'
  )
  AND "化祿宮位" IN ('命宮', '財帛', '官祿', '田宅')
  AND "化忌宮位" NOT IN ('命宮', '財帛', '官祿', '田宅')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  // ============================================================
  // 🧠 聰明 / 學業 / 技術
  // ============================================================
  s_smart: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "官祿主星",
  "命宮全部星", "官祿全部星",
  "天機星等", "巨門星等", "太陽星等",
  "化科星", "化科宮位",
  "化祿星", "化祿宮位"
FROM "命盤"
WHERE (
       "命宮主星" LIKE '%天機%'
    OR "命宮主星" LIKE '%巨門%'
    OR "命宮主星" LIKE '%太陽%'
    OR "官祿主星" LIKE '%天機%'
    OR "官祿主星" LIKE '%巨門%'
    OR "官祿主星" LIKE '%太陽%'
  )
  AND (
       "化科宮位" IN ('命宮', '官祿')
    OR "化祿宮位" IN ('命宮', '官祿')
  )
  AND (
       "命宮全部星" LIKE '%文昌%'
    OR "命宮全部星" LIKE '%文曲%'
    OR "命宮全部星" LIKE '%天魁%'
    OR "命宮全部星" LIKE '%天鉞%'
    OR "官祿全部星" LIKE '%文昌%'
    OR "官祿全部星" LIKE '%文曲%'
    OR "官祿全部星" LIKE '%天魁%'
    OR "官祿全部星" LIKE '%天鉞%'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  academic_elite: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "命宮全部星",
  "官祿主星", "官祿全部星",
  "化科星", "化科宮位"
FROM "命盤"
WHERE "化科宮位" IN ('命宮', '官祿', '福德')
  AND (
       "命宮全部星" LIKE '%文昌%'
    OR "命宮全部星" LIKE '%文曲%'
  )
  AND (
       "命宮全部星" LIKE '%天魁%'
    OR "命宮全部星" LIKE '%天鉞%'
    OR "官祿全部星" LIKE '%天魁%'
    OR "官祿全部星" LIKE '%天鉞%'
  )
  AND "化忌宮位" NOT IN ('命宮', '官祿')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  // ============================================================
  // 🏛️ 事業 / 權力 / 領導
  // ============================================================
  career_power: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "官祿主星",
  "命宮全部星", "官祿全部星",
  "紫微星等", "武曲星等", "七殺星等",
  "化權星", "化權宮位",
  "化祿宮位", "化科宮位", "化忌宮位"
FROM "命盤"
WHERE "化權宮位" IN ('命宮', '官祿')
  AND (
       "命宮主星" LIKE '%紫微%'
    OR "命宮主星" LIKE '%武曲%'
    OR "命宮主星" LIKE '%七殺%'
    OR "官祿主星" LIKE '%紫微%'
    OR "官祿主星" LIKE '%武曲%'
    OR "官祿主星" LIKE '%七殺%'
  )
  AND "化忌宮位" NOT IN ('命宮', '官祿')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  leadership_noble: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "命宮全部星",
  "官祿主星", "官祿全部星",
  "化權宮位", "化科宮位"
FROM "命盤"
WHERE (
       "命宮主星" LIKE '%紫微%'
    OR "命宮主星" LIKE '%天府%'
    OR "命宮主星" LIKE '%天相%'
  )
  AND "化權宮位" IN ('命宮', '官祿')
  AND (
       "命宮全部星" LIKE '%左輔%'
    OR "命宮全部星" LIKE '%右弼%'
  )
  AND (
       "命宮全部星" LIKE '%天魁%'
    OR "命宮全部星" LIKE '%天鉞%'
    OR "官祿全部星" LIKE '%天魁%'
    OR "官祿全部星" LIKE '%天鉞%'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  // ============================================================
  // 👶 旺父母 / 旺家庭
  // ============================================================
  s_parents: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "父母主星", "父母全部星",
  "田宅主星", "田宅全部星",
  "紫微星等", "天府星等", "太陽星等", "太陰星等",
  "化祿星", "化祿宮位", "化忌宮位"
FROM "命盤"
WHERE (
       "父母主星" LIKE '%紫微%'
    OR "父母主星" LIKE '%天府%'
    OR "父母主星" LIKE '%太陽%'
    OR "父母主星" LIKE '%太陰%'
  )
  AND (
       "化祿宮位" = '父母'
    OR "父母全部星" LIKE '%祿存%'
  )
  AND "化忌宮位" <> '父母'
  AND (
       "田宅主星" <> ''
    OR "化祿宮位" = '田宅'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  ssr_parents: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "父母主星", "父母全部星",
  "田宅主星", "田宅全部星",
  "財帛主星", "官祿主星",
  "化祿宮位", "化權宮位", "化科宮位", "化忌宮位"
FROM "命盤"
WHERE (
       "父母主星" LIKE '%紫微%'
    OR "父母主星" LIKE '%天府%'
    OR "父母主星" LIKE '%太陽%'
    OR "父母主星" LIKE '%太陰%'
  )
  AND (
       "父母全部星" LIKE '%祿存%'
    OR "化祿宮位" = '父母'
  )
  AND (
       "父母全部星" LIKE '%左輔%'
    OR "父母全部星" LIKE '%右弼%'
    OR "父母全部星" LIKE '%天魁%'
    OR "父母全部星" LIKE '%天鉞%'
    OR "化權宮位" = '父母'
    OR "化科宮位" = '父母'
  )
  AND "化忌宮位" NOT IN ('父母', '田宅')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  s_family: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "父母主星", "田宅主星",
  "命宮全部星", "父母全部星", "田宅全部星",
  "化祿宮位", "化權宮位", "化科宮位", "化忌宮位"
FROM "命盤"
WHERE (
       "命宮主星" LIKE '%紫微%'
    OR "命宮主星" LIKE '%天府%'
    OR "命宮主星" LIKE '%武曲%'
    OR "命宮主星" LIKE '%天相%'
  )
  AND (
       "父母主星" LIKE '%紫微%'
    OR "父母主星" LIKE '%天府%'
    OR "父母主星" LIKE '%太陽%'
    OR "父母主星" LIKE '%太陰%'
  )
  AND (
       "田宅主星" LIKE '%天府%'
    OR "田宅主星" LIKE '%太陰%'
    OR "田宅主星" LIKE '%武曲%'
  )
  AND "化祿宮位" IN ('命宮', '父母', '田宅')
  AND "化忌宮位" NOT IN ('命宮', '父母', '田宅')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  family_wealth_boost: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "父母主星", "父母全部星",
  "田宅主星", "田宅全部星",
  "財帛主星", "官祿主星",
  "化祿宮位", "化權宮位", "化科宮位", "化忌宮位"
FROM "命盤"
WHERE "化忌宮位" NOT IN ('父母', '田宅')
  AND (
       "化祿宮位" IN ('父母', '田宅')
    OR "父母全部星" LIKE '%祿存%'
    OR "田宅全部星" LIKE '%祿存%'
  )
  AND (
       "父母主星" LIKE '%紫微%'
    OR "父母主星" LIKE '%天府%'
    OR "父母主星" LIKE '%太陽%'
    OR "父母主星" LIKE '%太陰%'
  )
  AND (
       "田宅主星" LIKE '%天府%'
    OR "田宅主星" LIKE '%太陰%'
    OR "田宅主星" LIKE '%武曲%'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  // ============================================================
  // 🍀 福氣 / 舒服命
  // ============================================================
  lucky_life: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "命宮全部星",
  "福德主星", "福德全部星",
  "天同星等", "天府星等", "太陰星等",
  "化祿宮位", "化科宮位", "化忌宮位"
FROM "命盤"
WHERE (
       "命宮主星" LIKE '%天同%'
    OR "命宮主星" LIKE '%天府%'
    OR "命宮主星" LIKE '%太陰%'
    OR "福德主星" LIKE '%天同%'
    OR "福德主星" LIKE '%天府%'
    OR "福德主星" LIKE '%太陰%'
  )
  AND "化忌宮位" NOT IN ('命宮', '福德')
  AND (
       "化祿宮位" IN ('命宮', '福德')
    OR "化科宮位" IN ('命宮', '福德')
    OR "福德全部星" LIKE '%祿存%'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  no_worry_rich: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "福德主星",
  "財帛主星", "田宅主星",
  "命宮全部星", "福德全部星",
  "財帛全部星", "田宅全部星",
  "化祿宮位", "化忌宮位"
FROM "命盤"
WHERE "化忌宮位" NOT IN ('命宮', '福德', '財帛', '田宅')
  AND "化祿宮位" IN ('命宮', '福德', '財帛', '田宅')
  AND (
       "福德主星" LIKE '%天同%'
    OR "福德主星" LIKE '%天府%'
    OR "福德主星" LIKE '%太陰%'
  )
  AND (
       "財帛主星" LIKE '%武曲%'
    OR "財帛主星" LIKE '%天府%'
    OR "田宅主星" LIKE '%太陰%'
    OR "田宅主星" LIKE '%天府%'
  )
ORDER BY "公曆日期", "時辰序號", "性別";`,
  // ============================================================
  // ⚠️ 避雷 / 高波動
  // ============================================================
  risk_core_huaji: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "財帛主星", "官祿主星", "田宅主星",
  "化忌星", "化忌宮位"
FROM "命盤"
WHERE "化忌宮位" IN ('命宮', '財帛', '官祿', '田宅')
ORDER BY "化忌宮位", "公曆日期", "時辰序號", "性別";`,
  risk_wealth: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "財帛主星", "財帛全部星",
  "田宅主星", "田宅全部星",
  "化忌星", "化忌宮位"
FROM "命盤"
WHERE "化忌宮位" IN ('財帛', '田宅')
   OR "財帛全部星" LIKE '%地空%'
   OR "財帛全部星" LIKE '%地劫%'
   OR "田宅全部星" LIKE '%地空%'
   OR "田宅全部星" LIKE '%地劫%'
ORDER BY "公曆日期", "時辰序號", "性別";`,
  // ============================================================
  // 📊 Score Queries
  // ============================================================
  wealth_score: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "財帛主星", "官祿主星", "田宅主星",
  (
      CASE WHEN "武曲宮位" IN ('財帛','官祿','田宅')
             AND "武曲星等" IN ('廟','旺')
           THEN 20 ELSE 0 END
    + CASE WHEN "天府宮位" IN ('財帛','官祿','田宅')
             AND "天府星等" IN ('廟','旺')
           THEN 20 ELSE 0 END
    + CASE WHEN "太陰宮位" IN ('財帛','田宅')
             AND "太陰星等" IN ('廟','旺')
           THEN 15 ELSE 0 END
    + CASE WHEN "化祿宮位" IN ('財帛','官祿','田宅')
           THEN 20 ELSE 0 END
    + CASE WHEN "化權宮位" IN ('財帛','官祿')
           THEN 10 ELSE 0 END
    + CASE WHEN "財帛全部星" LIKE '%祿存%'
             OR "官祿全部星" LIKE '%祿存%'
             OR "田宅全部星" LIKE '%祿存%'
           THEN 15 ELSE 0 END
    - CASE WHEN "化忌宮位" = '財帛'
           THEN 25 ELSE 0 END
    - CASE WHEN "化忌宮位" = '官祿'
           THEN 20 ELSE 0 END
    - CASE WHEN "化忌宮位" = '田宅'
           THEN 20 ELSE 0 END
  ) AS "財富分"
FROM "命盤"
ORDER BY "財富分" DESC,
         "公曆日期", "時辰序號", "性別";`,
  beauty_score: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星", "命宮全部星",
  (
      CASE WHEN "天同宮位" = '命宮'
           THEN 20 ELSE 0 END
    + CASE WHEN "太陰宮位" = '命宮'
             AND "太陰星等" IN ('廟','旺')
           THEN 25 ELSE 0 END
    + CASE WHEN "天相宮位" = '命宮'
             AND "天相星等" IN ('廟','旺')
           THEN 18 ELSE 0 END
    + CASE WHEN "貪狼宮位" = '命宮'
             AND "貪狼星等" IN ('廟','旺')
           THEN 20 ELSE 0 END
    + CASE WHEN "廉貞宮位" = '命宮'
             AND "廉貞星等" IN ('廟','旺')
           THEN 15 ELSE 0 END
    + CASE WHEN "命宮全部星" LIKE '%文昌%'
           THEN 8 ELSE 0 END
    + CASE WHEN "命宮全部星" LIKE '%文曲%'
           THEN 8 ELSE 0 END
    + CASE WHEN "命宮全部星" LIKE '%紅鸞%'
           THEN 8 ELSE 0 END
    + CASE WHEN "命宮全部星" LIKE '%天喜%'
           THEN 7 ELSE 0 END
    + CASE WHEN "命宮全部星" LIKE '%天姚%'
           THEN 10 ELSE 0 END
    + CASE WHEN "命宮全部星" LIKE '%咸池%'
           THEN 5 ELSE 0 END
    + CASE WHEN "化科宮位" = '命宮'
           THEN 8 ELSE 0 END
  ) AS "顏值魅力分"
FROM "命盤"
ORDER BY "顏值魅力分" DESC,
         "公曆日期", "時辰序號", "性別";`,
  parents_score: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "父母主星", "父母全部星",
  "田宅主星", "田宅全部星",
  (
      CASE WHEN "父母主星" LIKE '%紫微%' THEN 15 ELSE 0 END
    + CASE WHEN "父母主星" LIKE '%天府%' THEN 15 ELSE 0 END
    + CASE WHEN "父母主星" LIKE '%太陽%' THEN 10 ELSE 0 END
    + CASE WHEN "父母主星" LIKE '%太陰%' THEN 10 ELSE 0 END
    + CASE WHEN "化祿宮位" = '父母' THEN 25 ELSE 0 END
    + CASE WHEN "化權宮位" = '父母' THEN 10 ELSE 0 END
    + CASE WHEN "化科宮位" = '父母' THEN 10 ELSE 0 END
    + CASE WHEN "父母全部星" LIKE '%祿存%' THEN 15 ELSE 0 END
    + CASE WHEN "父母全部星" LIKE '%左輔%' THEN 5 ELSE 0 END
    + CASE WHEN "父母全部星" LIKE '%右弼%' THEN 5 ELSE 0 END
    + CASE WHEN "父母全部星" LIKE '%天魁%' THEN 5 ELSE 0 END
    + CASE WHEN "父母全部星" LIKE '%天鉞%' THEN 5 ELSE 0 END
    + CASE WHEN "化祿宮位" = '田宅' THEN 10 ELSE 0 END
    - CASE WHEN "化忌宮位" = '父母' THEN 30 ELSE 0 END
  ) AS "旺父母分"
FROM "命盤"
ORDER BY "旺父母分" DESC,
         "公曆日期", "時辰序號", "性別";`,
  ultimate_score: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "命宮主星",
  "財帛主星",
  "官祿主星",
  "田宅主星",
  "父母主星",
  "福德主星",
  (
      /* 財富 */
      CASE WHEN "武曲宮位" IN ('財帛','官祿','田宅')
             AND "武曲星等" IN ('廟','旺')
           THEN 15 ELSE 0 END
    + CASE WHEN "天府宮位" IN ('財帛','官祿','田宅')
             AND "天府星等" IN ('廟','旺')
           THEN 15 ELSE 0 END
    + CASE WHEN "太陰宮位" IN ('財帛','田宅')
             AND "太陰星等" IN ('廟','旺')
           THEN 12 ELSE 0 END
    + CASE WHEN "化祿宮位" IN ('命宮','財帛','官祿','田宅')
           THEN 18 ELSE 0 END
    + CASE WHEN "化權宮位" IN ('命宮','財帛','官祿')
           THEN 10 ELSE 0 END
    + CASE WHEN "化科宮位" IN ('命宮','官祿')
           THEN 8 ELSE 0 END
      /* 貴人 */
    + CASE WHEN "命宮全部星" LIKE '%左輔%'
           THEN 5 ELSE 0 END
    + CASE WHEN "命宮全部星" LIKE '%右弼%'
           THEN 5 ELSE 0 END
    + CASE WHEN "命宮全部星" LIKE '%天魁%'
           THEN 5 ELSE 0 END
    + CASE WHEN "命宮全部星" LIKE '%天鉞%'
           THEN 5 ELSE 0 END
      /* 顏值 / 氣質 */
    + CASE WHEN "天同宮位" = '命宮'
           THEN 8 ELSE 0 END
    + CASE WHEN "太陰宮位" = '命宮'
             AND "太陰星等" IN ('廟','旺')
           THEN 10 ELSE 0 END
    + CASE WHEN "天相宮位" = '命宮'
             AND "天相星等" IN ('廟','旺')
           THEN 8 ELSE 0 END
    + CASE WHEN "命宮全部星" LIKE '%文昌%'
           THEN 4 ELSE 0 END
    + CASE WHEN "命宮全部星" LIKE '%文曲%'
           THEN 4 ELSE 0 END
      /* 旺父母 */
    + CASE WHEN "化祿宮位" = '父母'
           THEN 12 ELSE 0 END
    + CASE WHEN "父母全部星" LIKE '%祿存%'
           THEN 8 ELSE 0 END
      /* 福氣 */
    + CASE WHEN "福德主星" LIKE '%天同%'
             OR "福德主星" LIKE '%天府%'
             OR "福德主星" LIKE '%太陰%'
           THEN 8 ELSE 0 END
      /* 核心扣分 */
    - CASE WHEN "化忌宮位" = '命宮'
           THEN 12 ELSE 0 END
    - CASE WHEN "化忌宮位" = '財帛'
           THEN 20 ELSE 0 END
    - CASE WHEN "化忌宮位" = '官祿'
           THEN 18 ELSE 0 END
    - CASE WHEN "化忌宮位" = '田宅'
           THEN 18 ELSE 0 END
    - CASE WHEN "化忌宮位" = '父母'
           THEN 12 ELSE 0 END
  ) AS "綜合SSR分"
FROM "命盤"
ORDER BY "綜合SSR分" DESC,
         "公曆日期", "時辰序號", "性別";`,
  ranking_top: `SELECT TOP 100
  m."KEY", m."命盤連結", m."性別", m."命宮主星",
  r."財富分", r."財富排名", r."財富百分位",
  r."幸運分", r."幸運排名", r."幸運百分位",
  r."外貌分", r."外貌排名", r."外貌百分位",
  r."事業分", r."事業排名", r."社交分", r."社交排名",
  r."家庭助力分", r."家庭助力排名", r."福體分", r."福體排名",
  r."綜合分", r."綜合排名", r."綜合百分位"
FROM "命盤評分" r
JOIN "命盤" m ON m."KEY" = r."KEY"
ORDER BY r."綜合分" DESC, m."KEY";`,
  ranking_elite: `SELECT TOP 1000
  m."KEY", m."命盤連結", m."性別", m."命宮主星",
  r."財富分", r."財富排名", r."幸運分", r."幸運排名",
  r."外貌分", r."外貌排名", r."綜合分", r."綜合排名"
FROM "命盤評分" r
JOIN "命盤" m ON m."KEY" = r."KEY"
WHERE r."財富排名" IN ('SSS', 'SSR')
  AND r."幸運排名" IN ('SSS', 'SSR')
  AND r."外貌排名" IN ('SSS', 'SSR')
ORDER BY r."綜合分" DESC, m."KEY";`,
  ranking_balanced: `SELECT TOP 1000
  m."KEY", m."命盤連結", m."性別", m."命宮主星",
  r."財富百分位", r."幸運百分位", r."外貌百分位", r."事業百分位",
  r."社交百分位", r."家庭助力百分位", r."福體百分位",
  r."綜合分", r."綜合排名", r."綜合百分位"
FROM "命盤評分" r
JOIN "命盤" m ON m."KEY" = r."KEY"
WHERE r."財富百分位" >= 80 AND r."幸運百分位" >= 80
  AND r."事業百分位" >= 80 AND r."家庭助力百分位" >= 80
  AND r."福體百分位" >= 80
ORDER BY r."綜合分" DESC, m."KEY";`,
  ranking_dimensions: `SELECT TOP 1000
  "KEY", "財富分", "財富排名", "財富百分位",
  "幸運分", "幸運排名", "幸運百分位",
  "外貌分", "外貌排名", "外貌百分位",
  "事業分", "事業排名", "事業百分位",
  "社交分", "社交排名", "社交百分位",
  "家庭助力分", "家庭助力排名", "家庭助力百分位",
  "福體分", "福體排名", "福體百分位",
  "綜合分", "綜合排名", "綜合百分位"
FROM "命盤評分"
ORDER BY "綜合分" DESC, "KEY";`,
  ranking_distribution: `SELECT
  "綜合排名", COUNT(*) AS "盤數",
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM "命盤評分"), 2) AS "占比"
FROM "命盤評分"
GROUP BY "綜合排名"
ORDER BY CASE "綜合排名"
  WHEN 'SSS' THEN 1 WHEN 'SSR' THEN 2 WHEN 'SS' THEN 3 WHEN 'S' THEN 4
  WHEN 'A' THEN 5 WHEN 'B' THEN 6 WHEN 'C' THEN 7 WHEN 'D' THEN 8
  WHEN 'E' THEN 9 ELSE 10 END;`,
  // ============================================================
  // 🔍 基礎 / Debug / Exploration
  // ============================================================
  top: `SELECT TOP 1000 *
FROM "命盤";`,
  sihua: `SELECT TOP 1000
  "KEY", "命盤連結",
  "化祿星", "化祿宮位",
  "化權星", "化權宮位",
  "化科星", "化科宮位",
  "化忌星", "化忌宮位"
FROM "命盤"
WHERE "化忌宮位" = '命宮'
ORDER BY "公曆日期", "時辰序號", "性別";`,
  sihua_core: `SELECT TOP 1000
  "KEY", "命盤連結", "性別",
  "化祿星", "化祿宮位",
  "化權星", "化權宮位",
  "化科星", "化科宮位",
  "化忌星", "化忌宮位"
FROM "命盤"
WHERE "化祿宮位" IN ('命宮','財帛','官祿','田宅')
   OR "化權宮位" IN ('命宮','財帛','官祿','田宅')
   OR "化科宮位" IN ('命宮','財帛','官祿','田宅')
   OR "化忌宮位" IN ('命宮','財帛','官祿','田宅')
ORDER BY "公曆日期", "時辰序號", "性別";`,
  daxian: `SELECT TOP 1000
  "KEY", "命盤連結",
  "命宮大限", "兄弟大限", "夫妻大限", "子女大限",
  "財帛大限", "疾厄大限", "遷移大限", "僕役大限",
  "官祿大限", "田宅大限", "福德大限", "父母大限"
FROM "命盤";`,
  key: `SELECT *
FROM "命盤"
WHERE "KEY" = '20270810-子時-女';`,
  female: `SELECT TOP 1000 *
FROM "命盤"
WHERE "性別" = '女'
ORDER BY "公曆日期", "時辰序號";`,
  male: `SELECT TOP 1000 *
FROM "命盤"
WHERE "性別" = '男'
ORDER BY "公曆日期", "時辰序號";`,
  date_range: `SELECT TOP 1000 *
FROM "命盤"
WHERE "公曆日期" BETWEEN '2027-01-01' AND '2027-12-31'
ORDER BY "公曆日期", "時辰序號", "性別";`,
  count: `SELECT
  COUNT(*) AS "資料筆數",
  COUNT(DISTINCT "KEY") AS "唯一KEY"
FROM "命盤";`,
  count_by_day: `SELECT
  "公曆日期",
  COUNT(*) AS "盤數"
FROM "命盤"
GROUP BY "公曆日期"
ORDER BY "公曆日期";`,
  count_ming_star: `SELECT
  "命宮主星",
  COUNT(*) AS "數量"
FROM "命盤"
GROUP BY "命宮主星"
ORDER BY "數量" DESC;`,
  count_hualu_palace: `SELECT
  "化祿宮位",
  COUNT(*) AS "數量"
FROM "命盤"
GROUP BY "化祿宮位"
ORDER BY "數量" DESC;`,
  count_huaji_palace: `SELECT
  "化忌宮位",
  COUNT(*) AS "數量"
FROM "命盤"
GROUP BY "化忌宮位"
ORDER BY "數量" DESC;`
};
const QUERY_GROUPS = {
  "👑 頂級綜合": [
    "sss_all",
    "ssr_all",
    "ssr_noble",
    "ultimate_score",
  ],
  "📊 全年排名": [
    "ranking_top",
    "ranking_elite",
    "ranking_balanced",
    "ranking_dimensions",
    "ranking_distribution",
  ],
  "💰 財富": [
    "sr_income",
    "sr_super_income",
    "sr_asset",
    "sr_property_king",
    "sr_wealth_storage",
    "wealth_score",
  ],
  "🎰 橫財創業": [
    "sr_windfall",
    "ssr_windfall",
    "fire_greed",
    "bell_greed",
    "sr_business",
    "startup_boss",
  ],
  "👸 顏值桃花": [
    "beauty_sweet",
    "beauty_elegant",
    "beauty_glamour",
    "beauty_noble",
    "peach_blossom",
    "beauty_score",
  ],
  "💖 又美又有錢": [
    "sweet_rich",
    "princess_rich",
  ],
  "🧠 聰明學業": [
    "s_smart",
    "academic_elite",
  ],
  "🏛️ 權力事業": [
    "career_power",
    "leadership_noble",
  ],
  "👶 旺父母家族": [
    "s_parents",
    "ssr_parents",
    "s_family",
    "family_wealth_boost",
    "parents_score",
  ],
  "🍀 福氣": [
    "lucky_life",
    "no_worry_rich",
  ],
  "⚠️ 避雷": [
    "risk_core_huaji",
    "risk_wealth",
  ],
  "🔍 基礎": [
    "top",
    "sihua",
    "sihua_core",
    "daxian",
    "key",
    "female",
    "male",
    "date_range",
    "count",
    "count_by_day",
    "count_ming_star",
    "count_hualu_palace",
    "count_huaji_palace",
  ],
};
const QUERY_LABELS = {
  "sss_all": "綜合 SSS",
  "ssr_all": "綜合 SSR",
  "ssr_noble": "紫府武相權貴",
  "ultimate_score": "綜合評分",
  "ranking_top": "綜合排名 TOP 100",
  "ranking_elite": "財富幸運外貌雙R以上",
  "ranking_balanced": "五維前20%均衡盤",
  "ranking_dimensions": "完整八維評分",
  "ranking_distribution": "綜合排名分布",
  "sr_income": "超強正財",
  "sr_super_income": "頂級正財",
  "sr_asset": "資產型巨富",
  "sr_property_king": "田宅資產王",
  "sr_wealth_storage": "守財聚庫",
  "wealth_score": "財富評分",
  "sr_windfall": "橫財爆發",
  "ssr_windfall": "頂級橫財",
  "fire_greed": "火貪格",
  "bell_greed": "鈴貪格",
  "sr_business": "商業型富命",
  "startup_boss": "創業老闆",
  "beauty_sweet": "甜妹顏值",
  "beauty_elegant": "氣質美人",
  "beauty_glamour": "魅力型",
  "beauty_noble": "貴氣顏值",
  "peach_blossom": "桃花魅力",
  "beauty_score": "顏值魅力評分",
  "sweet_rich": "甜妹富命",
  "princess_rich": "公主富命",
  "s_smart": "聰明賺錢",
  "academic_elite": "學業菁英",
  "career_power": "事業權力",
  "leadership_noble": "權貴領導",
  "s_parents": "旺父母",
  "ssr_parents": "頂級旺父母",
  "s_family": "旺家族",
  "family_wealth_boost": "家運帶財",
  "parents_score": "旺父母評分",
  "lucky_life": "福氣舒服命",
  "no_worry_rich": "富足無憂",
  "risk_core_huaji": "核心宮化忌",
  "risk_wealth": "財產高波動",
  "top": "TOP 1000 全欄",
  "sihua": "化忌在命宮",
  "sihua_core": "核心宮四化",
  "daxian": "十二宮大限",
  "key": "KEY 反查",
  "female": "全部女命",
  "male": "全部男命",
  "date_range": "日期範圍",
  "count": "資料筆數",
  "count_by_day": "每日盤數",
  "count_ming_star": "命宮主星統計",
  "count_hualu_palace": "化祿宮位統計",
  "count_huaji_palace": "化忌宮位統計"
};
window.BAZI_QUERY_LIBRARY = Object.freeze({
  queries: Object.freeze(SAMPLE_QUERIES),
  groups: Object.freeze(QUERY_GROUPS),
  labels: Object.freeze(QUERY_LABELS),
  defaultQuery: "ranking_top",
});
})();
