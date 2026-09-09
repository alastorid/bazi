# Brightness-aware scoring

This project treats Zi Wei Dou Shu scoring as an inspectable traditional-model research aid, not as a scientific, medical, financial, or life-outcome prediction.

## Source of brightness

`src/ziwei-algorithm.mjs` calls the pinned `iztro` engine with `astro.bySolar(..., "zh-TW")` and preserves each returned `star.brightness` label exactly. The yearly build does not infer a different brightness from the rendered palace text.

`src/scoring-model.mjs` is the single version-controlled source for:

- the ordinal query scale `陷 < 不 < 平 < 利 < 得 < 旺 < 廟`;
- star nature (`benefic`, `mixed`, or `challenging`);
- palace-specific signed rules for each scoring dimension;
- nature-, polarity-, and brightness-specific response curves;
- four-transformation and source-backed named-formation rules;
- overall weights and annual percentile grade thresholds.

The ordinal is for comparisons, not a universal point value. A bright benefic strengthens a positive effect; a fallen benefic weakens it. A challenging star at high brightness is not relabelled as auspicious. For negative rules, its brightness changes the strength or manageability of that negative meaning instead of applying a blanket “廟 = bonus, 陷 = penalty”.

## Database schema

The raw, wide `命盤` table keeps every `${星曜}星等` and `${星曜}宮位` column and a direct `${宮位}地支` column for branch-specific formations.

The build adds these separate tables:

- `亮度等級(亮度, 亮度序)`: stable ordinal lookup for SQL.
- `星曜亮度(KEY, 星曜, 宮位, 星曜類型, 星性質, 亮度, 亮度序, 四化)`: normalized long-form data, indexed by star, palace, brightness, and key.
- `格局規則` and `命盤格局`: source-backed named rules and one independently queryable flag per chart.
- `命盤評分`: one row per chart with independent score, grade, and annual percentile columns for 格局、財富、事業、婚姻、六親、科甲、健康、綜合.
- `命盤評分明細`: one row per triggered rule, including brightness, factor, signed base effect, actual contribution, and explanation.
- `評分規則`, `評分維度`, `排名門檻`: auditable rule catalog and configuration.

Only stars for which the chart engine returns a brightness label appear in `星曜亮度`; the original wide star and palace data still remains available for every star.

## Formula

For a dimension `d`:

```text
raw(d) = base(d)
       + Σ palace_effect(star, palace) × response(star_nature, sign, brightness)
       + Σ contextual_effect(four_transformations, strict_synergies, brightness)

score(d) = clamp(raw(d), 0, 100)
overall  = weighted mean of the seven dimension scores
```

Four-transformation effects use a moderated brightness response because the transformation is its own context while the transformed star still contributes through any matching star/palace rule. Named formations require their actual original palace, branch, meeting, or flanking conditions; empty-palace borrowing never creates a formation.

The former 火貪／鈴貪財帛 bonuses were removed. In the supplied 《天紀》 material, 火貪／鈴貪 is explicitly a 命宮武貴／武職 pattern, not a standalone 財帛爆發財 rule. The model therefore retains `火貴格` and `鈴貴格` under 事業 only. See [NIHAIXIA_SCORING.md](NIHAIXIA_SCORING.md).

Grades are based on the generated year's percentile distribution: SSS ≥ 99, SSR ≥ 96, SS ≥ 90, S ≥ 80, then A through F. Scores and ranks are not stored in `命盤`, so the scorer can be replaced and rebuilt without modifying raw charts.

## Updated rankings and queries

The scoring engine follows the supplied lesson order: 格局, 財富, 事業, 婚姻, 六親, 科甲, 健康, then 綜合. The Query Library is rebuilt around the same dimensions and joins `命盤格局` for named formations. The default query starts with the year's highest 格局 ranks and exposes 命財官遷, four transformations, and auspicious/inauspicious formation counts.

## Regression checks

`scripts/verify-data.mjs` automatically finds annual chart pairs with the same scoring rule, star, and palace but different brightness, then verifies that the contribution differs. It reconciles every final dimension score against `命盤評分明細` and independently recomputes every named-formation flag in SQL. Missing SQL predicates fail the build. It also asserts that the removed 火貪／鈴貪財帛 rule IDs cannot re-enter the generated catalog.

`scripts/verify-queries.mjs` executes every sample query against the newly generated database and separately verifies an ordinal `貪狼 / 財帛 / >= 旺` query.
