# Family, marriage, and children scoring

This model compares traditional Zi Wei chart features across generated birth times. It is not medical, fertility, relationship, financial, or life-outcome advice.

## Single source of truth

- `src/scoring/config.mjs`: age range, all composite weights, the parent-negative weight, and star groups.
- `src/scoring/family-scoring.mjs`: natal parents, wealth, appearance, romance, marriage, children, family composite, and evidence rules.
- `src/scoring/timing-scoring.mjs`: per-age major-period, minor-period, yearly, Hongluan, and Tianxi triggers.
- `src/scoring-model.mjs`: shared star nature and brightness response functions.

Queries and Visualization never implement these formulas. They only read the yearly precomputed database.

## Generated columns

`命盤家庭評分` contains normalized 0–100 scores for:

- 父母、父母財富、父母負向、父母品質
- 穩定財富、爆發財富、自身財富
- 外貌、戀愛
- 婚姻、婚姻時機
- 子女、真子女宮強度、子女時機
- 家庭時機、家庭品質、家庭平衡

It also stores yearly percentiles for every positive/composite component, Family Quality and Family Balance grades, the best marriage/children age and year, marriage window, trigger count and flags, `真子女宮有主星`, its source, and concise reasons. `家庭品質全域百分位` is intentionally `NULL`: independently generated yearly artifacts cannot provide a valid cross-year denominator.

`命盤婚育時機` stores one row per chart per configured age. The default range is nominal age 25–35, or eleven rows per chart. `命盤家庭評分明細` stores each natal and timing contribution used in the score.

The read-only `family_scores` view exposes the same outputs with stable English SQL names such as `parents_quality_score`, `stable_wealth_score`, `marriage_timing_score`, `family_quality_pr_year`, and `children_palace_has_major_star`, together with `birth_datetime` and `metis_url`.

## Brightness behavior

The family scorer uses the same context-sensitive response curves as the core scorer. A rule first defines a signed effect for a specific star and palace. Brightness then modifies that effect according to whether the star is benefic, mixed, or challenging and whether the rule is positive or negative. Stars without a brightness supplied by the pinned chart engine remain explicit and use a neutral factor; no brightness is invented.

## Component rules

- Parents: parent-palace major stars, their brightness, support stars, transformations, and compound negative patterns.
- Parents Wealth: wealth/resource stars in 父母 or 田宅 plus transformations.
- Parents Negative: number of challenging stars, fallen major stars, 化忌, and compound conditions. Severe risk requires multiple rule families; a single star cannot create the full penalty.
- Stable Wealth: wealth, career, life, and property palaces; 財庫 stars, 祿存, transformations, brightness, and core disruption.
- Explosive Wealth: 貪狼、破軍、七殺 and strict original-palace 火貪／鈴貪 synergies. Borrowed palaces do not form these patterns.
- Self Wealth: `78% stable + 22% explosive`, configured independently.
- Appearance: the existing brightness-aware appearance score plus lower-weight body-palace effects.
- Romance: 紅鸞、天喜、天姚、咸池、貪狼、廉貞 in relationship-relevant palaces; this is independent of appearance.
- Marriage: natal 夫妻 conditions combined with the strongest configured-age timing score.
- Children: 真子女宮 major-star strength, brightness, support/challenging stars, transformations, and the strongest children timing score.

真子女宮 means the original 子女宮 when it has a major star; otherwise it borrows the opposite 田宅宮 major stars at a reduced factor. `真子女宮有主星` is a positive signal only, never a claim that a person will have children.

## Timing definition

The pinned `iztro` horoscope API supplies the decadal period, annualized minor-period index, yearly transformations, 運鸞／運喜, and 流鸞／流喜. For each age in the configured range:

- major-period Hongluan/Tianxi means 運鸞／運喜 is in a marriage/family-relevant dynamic palace;
- minor-period Hongluan/Tianxi means the actual natal palace reached by that year's 小限 contains natal 紅鸞／天喜, because this `iztro` version does not expose a separate small-period moving-star array;
- yearly Hongluan/Tianxi uses 流鸞／流喜 from the horoscope response;
- marriage and children triggers also consider the natal palace reached by the major/minor period and 流羊／流陀 disruption;
- Family Timing rewards ages where marriage and children triggers overlap.

The best age is the maximum trigger score, with the earlier age breaking ties. `iztro` defines these periods by nominal (East Asian) age, not elapsed Gregorian years. Each requested nominal age is therefore resolved from the birth lunar year and sampled on July 1 of that annual period; family scoring does not consume the monthly or daily period. This avoids Lunar New Year boundary cases in which a fixed Gregorian birthday can skip a nominal age. Verification checks the resolved age/year window and that every requested age lies inside `iztro`'s returned decadal range.

## Family composites

Positive weights are configurable and total 15 by default:

```text
Parents Wealth 2.0      Parents Quality 2.5
Self Wealth 2.5         Appearance 1.0
Romance 1.0             Marriage 2.0
Children 2.0            Family Timing 2.0
```

The configured parent penalty is exactly 9:

```text
Family Quality raw = (Σ normalized_component × component_weight
                      - Parents Negative × 9) / 15
Family Quality     = clamp(raw, 0, 100)
```

Family Balance uses the weighted harmonic mean of the same positive components, then applies the same normalized parent penalty. The harmonic mean was selected because it strongly exposes one low component without making the absolute minimum the whole score.

All PR values use the entire generated year as the denominator. For 2027 that is 8,760 gender-specific birth-time rows; percentiles are never recalculated per month.

## Visualization

`visualization.js` renders an SVG date × 24-hour heatmap inside the existing Results pane. It queries one month and gender from SQLite, colors cells with precomputed yearly PR, and supports:

- Weighted Family PR versus Balanced Family PR;
- thirteen selectable family/core PR metrics;
- minimum Parents, Wealth, Appearance, Marriage, and Children filters that fade rather than remove cells;
- hover summaries, Top Times, single-click detail selection, evidence breakdown bars, and a Metis link;
- double-click to open the Metis chart.

The raw dataset has twelve traditional two-hour periods, not twenty-four independently calculated charts. The visualization expands each period into its two clock-hour cells and keeps both cells tied to the same key and Metis chart.
