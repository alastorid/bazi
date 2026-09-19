/**
 * Bazi One-to-One Comparator
 * 
 * Compares two natal charts feature-by-feature — palace against palace, star
 * against star — rather than collapsing everything into one numeric score.
 * 
 * Returns a verdict for the whole chart AND a per-palace breakdown:
 *   verdict: -1 (A worse), 0 (even/tie), 1 (A better)
 * 
 * Comparison signals, in strength order (strongest first):
 *   1. 四化 (化祿/化權/化科 good; 化忌 bad)
 *   2. 廟旺 vs 陷 / 吉星 vs 煞星 brightness & nature
 *   3. 主星 presence (空宮 vs 有主星)
 *   4. palace pair verdicts aggregated with 命宮 weighted highest
 */

import { STAR_NATURE, BRIGHTNESS_LEVELS } from "./scoring-model.mjs";
import { EXPLAINED_STAR_SET } from './explained-stars.mjs';

const BRIGHTNESS_ORDER = new Map(BRIGHTNESS_LEVELS);

/** Palace priority weight in the final aggregation. 命宮方四方正 weighted highest. */
export const PALACE_WEIGHT = {
  命宮: 3, 財帛: 2, 官祿: 2, 遷移: 2, 夫妻: 1.5, 田宅: 1, 子女: 1,
  兄弟: 0.8, 福德: 1.2, 父母: 0.8, 交友: 0.8, 疾厄: 0.6, 僕役: 0.8,
};

/** Per-star polarity/brightness strength for the one-to-one palace compare. */
export function starStrength(star) {
  if (!EXPLAINED_STAR_SET.has(star.name)) return 0;
  // 地空 has combination-scoped evidence, not a universal single-star score.
  if (star.name === '地空') return 0;
  const nature = STAR_NATURE[star.name] ?? "mixed";
  const level = BRIGHTNESS_ORDER.get(star.brightness) ?? 0; // 陷=1 … 廟=7, 0=unknown
  const mutagen = star.siHua || "";

  // Four-transformation dominates: 祿權科 strongly positive, 忌 strongly negative.
  switch (mutagen) {
    case "祿": return 4;
    case "權": return 3;
    case "科": return 2;
    case "忌": return -4;
    default: break;
  }

  if (nature === "benefic") return level >= 6 ? 3 : level >= 4 ? 2 : level >= 1 ? 0 : 0;
  if (nature === "challenging") return level >= 4 ? 0 : level >= 1 ? -2 : 0;
  // mixed
  return level >= 6 ? 2 : level >= 4 ? 1 : level >= 1 ? -1 : 0;
}

/**
 * Compare two palaces directly, star-by-star.
 * Returns { verdict, points, detail }.
 */
export function comparePalaces(palaceA, palaceB) {
  const starsA = palaceA?.stars ?? [];
  const starsB = palaceB?.stars ?? [];

  let totalA = 0;
  let totalB = 0;
  const detail = [];
  const seen = new Set();

  // Pair each star in A against the same star in B where it exists.
  for (const starA of starsA) {
    seen.add(starA.name);
    const counterpart = starsB.find((s) => s.name === starA.name);
    const sA = starStrength(starA);
    const sB = counterpart ? starStrength(counterpart) : 0;
    totalA += sA;
    totalB += sB;
    if (sA !== sB) {
      detail.push({ palace: palaceA?.name ?? "", star: starA.name, a: sA, b: sB,
        note: sA > sB ? "A勝此星" : "B勝此星" });
    }
  }
  // Any stars only in B.
  for (const starB of starsB) {
    if (seen.has(starB.name)) continue;
    const sB = starStrength(starB);
    totalB += sB;
    if (sB !== 0) {
      detail.push({ palace: palaceA?.name ?? "", star: starB.name, a: 0, b: sB, note: "B獨有此星" });
    }
  }

  // 主星 presence tiebreak: empty palace (借對宮) is weaker than it has a major star.
  const majorA = (palaceA?.stars ?? []).filter((s) => s.type === "major");
  const majorB = (palaceB?.stars ?? []).filter((s) => s.type === "major");
  const presenceA = majorA.length ? 0.5 : 0;
  const presenceB = majorB.length ? 0.5 : 0;

  const verdict = Math.sign(totalA + presenceA - (totalB + presenceB));
  return { verdict, points: { a: totalA + presenceA, b: totalB + presenceB }, detail };
}

/**
 * Compare two natal charts one-to-one.
 * Returns { verdict, palaceVerdicts, weightedScore, detail }.
 */
export function compareCharts(chartA, chartB) {
  const palacesA = new Map((chartA.palaces ?? []).map((p) => [p.name, p]));
  const palacesB = new Map((chartB.palaces ?? []).map((p) => [p.name, p]));
  const allNames = [...new Set([...palacesA.keys(), ...palacesB.keys()])];

  const palaceVerdicts = {};
  let weightedScore = 0;
  const detail = [];

  for (const name of allNames) {
    const res = comparePalaces(palacesA.get(name), palacesB.get(name));
    const weight = PALACE_WEIGHT[name] ?? 1;
    palaceVerdicts[name] = res.verdict;
    weightedScore += res.points.a * weight - res.points.b * weight;
    if (res.verdict !== 0) detail.push({ ...res, weight });
  }

  weightedScore = Math.round(weightedScore * 1000000) / 1000000;
  const verdict = Math.sign(weightedScore);
  return { verdict, palaceVerdicts, weightedScore, detail };
}

// ===== Ranking helpers (built on the pairwise comparator) =====

/**
 * Compare by precomputed results to keep a stable total order.
 * Returns -1 / 0 / 1.
 */
export function compareChartResults(ra, rb) {
  return Math.sign(Math.round(((ra.weightedScore ?? 0) - (rb.weightedScore ?? 0))*1000000));
}

/**
 * Merge-sort (non-blind, pairwise) of chart results.
 * `results` are objects already scored by compareCharts against a fixed referee,
 * OR objects carrying {weightedScore, palaceVerdicts}.
 */
export function mergeSortResults(results, compare = compareChartResults) {
  if (!results.length) return results;
  function merge(left, right) {
    const out = [];
    let i = 0, j = 0;
    while (i < left.length && j < right.length) {
      if (compare(left[i], right[j]) >= 0) out.push(left[i++]);
      else out.push(right[j++]);
    }
    return out.concat(left.slice(i), right.slice(j));
  }
  function sort(arr) {
    if (arr.length <= 1) return arr;
    const mid = arr.length >> 1;
    return merge(sort(arr.slice(0, mid)), sort(arr.slice(mid)));
  }
  return sort(results);
}

/**
 * Assign rank index + PR ratio to pre-sorted chart results.
 * Higher weightedScore/lower loser-count => lower (better) rank.
 *
 * Also assigns a strict sequential 總序 (1..n, no ties) reflecting the
 * deterministic global total order, so any filtered subset can be re-ranked
 * on the fly with ROW_NUMBER via SQL. Ties in the competition rank are
 * broken by original array order (KEY order after a stable merge sort).
 */
export function assignRanks(sorted) {
  const n = sorted.length;
  let rank = 1;
  for (let i = 0; i < n; i++) {
    sorted[i].strictIndex = i + 1; // unique 1..n, deterministic
    sorted[i].rankIndex = rank;
    sorted[i].rankPercentile = n === 1 ? 100 : Math.round((1-(rank-1)/(n-1))*10000)/100;
    sorted[i].prRatio = sorted[i].rankPercentile / 100;
    if (i + 1 < n && compareChartResults(sorted[i], sorted[i + 1]) !== 0) {
      rank = i + 2;
    }
  }
  return sorted;
}

export default { compareCharts, comparePalaces, starStrength, compareChartResults, mergeSortResults, assignRanks, PALACE_WEIGHT };

// This comparator is mathematically additive: margin(A,B)=potential(A)-potential(B).
// That gives an exact transitive order, not an approximation to a tournament.
// The numerical weights are model parameters, not quotations from the teaching materials.
export function chartProfile(chart) {
  return chart.palaces.map(palace=>{
    const stars=palace.stars.filter(s=>EXPLAINED_STAR_SET.has(s.name)).map(star=>({
      ...star, strength:starStrength(star), nature:STAR_NATURE[star.name]??'mixed',
      reason:star.name==='地空'?'僅依明確組合解釋，單星作用為零':star.siHua?`四化${star.siHua}，採用四化優先權重`:!star.brightness?'亮度未定義，保留資料且單星作用為零':`${star.brightness}；依星性與亮度對照模型權重`,
    }));
    const majorCount=stars.filter(s=>s.type==='major').length;
    const starTotal=stars.reduce((n,s)=>n+s.strength,0);
    const presence=majorCount?0.5:0;
    const weight=PALACE_WEIGHT[palace.name]??1;
    return {name:palace.name,stars,majorCount,starTotal,presence,weight,raw:starTotal+presence,weighted:Math.round((starTotal+presence)*weight*1000000)/1000000};
  });
}
