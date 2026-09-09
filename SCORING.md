# Brightness-aware scoring

This project treats Zi Wei Dou Shu scoring as an inspectable traditional-model research aid, not as a scientific, medical, financial, or life-outcome prediction.

## Source of brightness

`src/ziwei-algorithm.mjs` calls the pinned `iztro` engine with `astro.bySolar(..., "zh-TW")` and preserves each returned `star.brightness` label exactly. The yearly build does not infer a different brightness from the rendered palace text.

`src/scoring-model.mjs` is the single version-controlled source for:

- the ordinal query scale `陷 < 不 < 平 < 利 < 得 < 旺 < 廟`;
- star nature (`benefic`, `mixed`, or `challenging`);
- palace-specific signed rules for each scoring dimension;
- nature-, polarity-, and brightness-specific response curves;
- four-transformation and strict same-palace synergy rules;
- overall weights and annual percentile grade thresholds.

The ordinal is for comparisons, not a universal point value. A bright benefic strengthens a positive effect; a fallen benefic weakens it. A challenging star at high brightness is not relabelled as auspicious. For negative rules, its brightness changes the strength or manageability of that negative meaning instead of applying a blanket “廟 = bonus, 陷 = penalty”.

## Database schema

The raw, wide `命盤` table remains unchanged and keeps every `${星曜}星等` and `${星曜}宮位` column.

The build adds these separate tables:

- `亮度等級(亮度, 亮度序)`: stable ordinal lookup for SQL.
- `星曜亮度(KEY, 星曜, 宮位, 星曜類型, 星性質, 亮度, 亮度序, 四化)`: normalized long-form data, indexed by star, palace, brightness, and key.
- `命盤評分`: one row per chart with independent score, grade, and annual percentile columns for 財富、幸運、外貌、健康、事業、社交、家庭助力、綜合.
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

Four-transformation effects use a moderated brightness response because the transformation is its own context while the transformed star still contributes through any matching star/palace rule. 火貪 and 鈴貪 bonuses require the stars' actual original locations to be 財帛; empty-palace borrowing never creates a strict same-palace formation.

Grades are based on the generated year's percentile distribution: SSS ≥ 99, SSR ≥ 96, SS ≥ 90, S ≥ 80, then A through F. Scores and ranks are not stored in `命盤`, so the scorer can be replaced and rebuilt without modifying raw charts.

## Updated rankings and queries

The scoring engine covers Wealth, Luck, Appearance, Health, Career, Social/Relationship, Family support, and Overall. The Query Library joins `命盤評分`, shows score/rank/percentile, and adds brightness-aware examples for financial stars, 火貪/鈴貪, appearance, traditional health tendencies, career, social patterns, and family support. The default result keeps the most useful core-star brightness columns visible without selecting the entire wide table.

## Regression checks

`scripts/verify-data.mjs` automatically finds annual chart pairs with the same scoring rule, star, and palace but different brightness, then verifies that the contribution differs. It tests representative positive, mixed, challenging, and negative rules including 武曲財富、貪狼財富、太陰外貌、七殺事業、火星健康. It also reconciles every final dimension score against `命盤評分明細` and verifies strict 火貪/鈴貪 never came from borrowed-palace semantics.

`scripts/verify-queries.mjs` executes every sample query against the newly generated database and separately verifies an ordinal `貪狼 / 財帛 / >= 旺` query.
