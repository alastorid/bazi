# bazi — 紫微限定時間範圍反查

Static GitHub Pages Web SQL terminal for querying every Zi Wei Dou Shu chart in a generated year range.

## Dataset

- 17,520 rows for 2026—2027: 730 days × 12 Chinese two-hour periods × 2 genders.
- Primary key format: `YYYYMMDD-時辰-性別`, for example `20270810-子時-女`.
- Every row has a direct `命盤連結` to its Metis Zi Wei chart.
- One deliberately wide, first-normal-form SQLite table named `命盤`.
- Separate brightness and palace columns for exactly the 36 stars explicitly explained by the designated teaching materials; unexplained chart labels are excluded.
- Separate columns for every palace's major stars and all stars.
- Twelve palace-specific decadal range columns (`命宮大限` through `父母大限`).
- Four transformation star/palace pairs: `化祿`, `化權`, `化科`, `化忌`.
- Direct columns for `命宮`, `身宮`, and `身宮宮位`.
- First-class 空宮 data for every palace: empty flag, opposite palace and stars, effective borrowed stars, and provenance.
- A direct terrestrial-branch column for every palace, used to verify branch-specific formations such as 日月並明 and 明珠出海.
- `空宮數` for direct multi-empty-palace research. See [PALACE_SEMANTICS.md](PALACE_SEMANTICS.md).
- A normalized `星曜亮度` table, ordinal `亮度等級` lookup, and auditable `星曜定義` whitelist with evidence levels (`直接`、`分組`、`組合`).
- Separate `格局規則`, `命盤格局`, `命盤格局明細`, `關係格局規則`, and `格局規則作用` tables. The query library and visualization focus only on auspicious/inauspicious patterns and structural rarity; incomplete named patterns and two-chart relationship patterns cannot silently affect a single-chart result.
- Separate family-planning scores, yearly PRs, per-age marriage/children timing, and an auditable evidence table. See [FAMILY_SCORING.md](FAMILY_SCORING.md).

The chart generator is a batch-oriented port of `ziwei-doushu/lib/ziwei/algorithm.ts`. It uses the same `iztro` `astro.bySolar` call and `lunar-javascript`; exact traditional Chinese brightness labels are retained for filtering.

## Run locally

```sh
npm install
npm run build -- 2026-2027
npm run serve
```

Serve `dist/` through an HTTP server. Do not open `index.html` directly because SQLite WASM and the database are fetched by a Web Worker.

`build` is the single entry point: it generates SQLite + gzip + metadata, copies the browser SQLite WASM runtime, and verifies row count, unique keys, four transformations, 命宮／身宮, all 12 opposite-palace mappings, empty-palace borrowing, normalized brightness, score reconciliation, brightness regression pairs, and every sample query.

Brightness is an input to the scoring engine rather than a display-only label. Only the 36-star evidence whitelist can enter raw columns, palace star lists, brightness data, scoring, queries, or autocomplete; the four transformations remain separate objects. The engine applies star-placement rules, four-transformation rules, then much stronger multi-dimensional combination/formation rules. Raw points are not clamped; the annual percentile assigns SSS–F. See [SCORING.md](SCORING.md) and the source boundary in [NIHAIXIA_SCORING.md](NIHAIXIA_SCORING.md).

SQL Query and Visualization are separate outer tabs. The sample-query panel belongs only to SQL Query and disappears in Visualization. The visualization is a vertically scrolling 2026—2027 calendar timeline with twelve two-hour bands inside every date. Red means more inauspicious patterns, green means more auspicious patterns, and mixed counts naturally meet in yellow; stronger colors represent more matched patterns. A single 女／男／女＋男 switch controls the view, with male on the left and female on the right in the combined mode. Details stay on the right, and double-clicking a band opens its chart. The viewport canvas renders only visible months, while SQL data is fetched and cached in 31-day chunks.

## Generate another year

```sh
npm run build -- 2028
```

No source or UI dates need editing. The site reads its year and date bounds from generated metadata.

## GitHub Pages

The repository does not commit a precomputed database. On every deployment,
GitHub Actions installs the pinned dependencies, runs `npm run build -- 2026-2027`,
generates the database on the Actions runner, and publishes only `dist/`.
The manual workflow accepts a different year input.

## Example SQL

```sql
SELECT "KEY", "紫微星等", "紫微宮位", "化祿宮位", "化忌宮位"
FROM "命盤"
WHERE "紫微星等" IN ('廟', '旺')
  AND "化祿宮位" = '財帛'
ORDER BY "公曆日期";
```

The sample-query library deliberately contains no rating queries. Its default query is:

```sql
SELECT TOP 1000
  m."KEY", m."命盤連結", m."公曆日期", m."時辰", m."性別",
  d."名稱" AS "格局", d."類型", d."吉凶", d."結構稀有度",
  d."成格條件", d."教材結果"
FROM "命盤" m
JOIN "命盤格局明細" d ON d."KEY" = m."KEY"
WHERE d."吉凶" IN ('吉','凶')
ORDER BY d."結構稀有度" DESC, m."公曆日期", m."時辰序號", m."性別";
```

The browser terminal is read-only. The bundled queries use `SELECT TOP 1000`; custom queries return their exact result without a hidden row cap. CSV export exports the currently displayed result.

## Credits

- Algorithm basis: [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu) (MIT)
- Terminal UI/SQLite WASM architecture: [alastorid/houseEx](https://github.com/alastorid/houseEx)
- Chart engine: [SylarLong/iztro](https://github.com/SylarLong/iztro)

Traditional divination software is provided for research and reference only.
