# bazi — 紫微限定時間範圍反查

Static GitHub Pages Web SQL terminal for querying every Zi Wei Dou Shu chart in a generated year.

## Dataset

- 8,760 rows: 365 days × 12 Chinese two-hour periods × 2 genders.
- Primary key format: `YYYYMMDD-時辰-性別`, for example `20270810-子時-女`.
- Every row has a direct `命盤連結` to its Metis Zi Wei chart.
- One deliberately wide, first-normal-form SQLite table named `命盤`.
- Separate columns for every star's exact brightness and palace.
- Separate columns for every palace's major stars and all stars.
- Twelve palace-specific decadal range columns (`命宮大限` through `父母大限`).
- Four transformation star/palace pairs: `化祿`, `化權`, `化科`, `化忌`.
- Direct columns for `命宮`, `身宮`, and `身宮宮位`.
- First-class 空宮 data for every palace: empty flag, opposite palace and stars, effective borrowed stars, and provenance.
- `空宮數` for direct multi-empty-palace research. See [PALACE_SEMANTICS.md](PALACE_SEMANTICS.md).
- A normalized `星曜亮度` table and ordinal `亮度等級` lookup for direct SQL comparisons.
- Separate `命盤評分`, `命盤評分明細`, and `評分規則` tables; scores, annual percentiles, grades, and every contributing rule remain inspectable without changing the raw `命盤` table.
- Separate family-planning scores, yearly PRs, per-age marriage/children timing, and an auditable evidence table. See [FAMILY_SCORING.md](FAMILY_SCORING.md).

The chart generator is a batch-oriented port of `ziwei-doushu/lib/ziwei/algorithm.ts`. It uses the same `iztro` `astro.bySolar` call and `lunar-javascript`; exact traditional Chinese brightness labels are retained for filtering.

## Run locally

```sh
npm install
npm run build -- 2027
npm run serve
```

Serve `dist/` through an HTTP server. Do not open `index.html` directly because SQLite WASM and the database are fetched by a Web Worker.

`build` is the single entry point: it generates SQLite + gzip + metadata, copies the browser SQLite WASM runtime, and verifies row count, unique keys, four transformations, 命宮／身宮, all 12 opposite-palace mappings, empty-palace borrowing, normalized brightness, score reconciliation, brightness regression pairs, and every sample query.

Brightness is an input to the scoring engine rather than a display-only label. Its response depends on the star's nature, the signed palace-specific rule, four-transformation context, and strict same-palace synergies. See [SCORING.md](SCORING.md).

The Results pane also contains a Visualization tab with a month-by-24-hour PR heatmap, metric and ranking selectors, minimum filters, Top Times, score breakdowns, rule explanations, and direct Metis links. Because the source database uses the traditional twelve two-hour periods, adjacent clock-hour cells may intentionally point to the same chart; gender is selected separately.

## Generate another year

```sh
npm run build -- 2028
```

No source or UI dates need editing. The site reads its year and date bounds from generated metadata.

## GitHub Pages

The repository does not commit a precomputed database. On every deployment,
GitHub Actions installs the pinned dependencies, runs `npm run build -- 2027`,
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

For an ordered comparison such as `貪狼在財帛宮 AND 貪狼亮度 >= 旺`, use the normalized schema:

```sql
SELECT TOP 1000
  m."KEY", m."命盤連結", b."星曜", b."宮位", b."亮度", b."亮度序",
  r."財富分", r."財富排名", r."財富百分位"
FROM "命盤" m
JOIN "星曜亮度" b ON b."KEY" = m."KEY"
JOIN "命盤評分" r ON r."KEY" = m."KEY"
WHERE b."星曜" = '貪狼'
  AND b."宮位" = '財帛'
  AND b."亮度序" >= (
    SELECT "亮度序" FROM "亮度等級" WHERE "亮度" = '旺'
  )
ORDER BY r."財富分" DESC;
```

The browser terminal is read-only. The bundled queries use `SELECT TOP 1000`; custom queries return their exact result without a hidden row cap. CSV export exports the currently displayed result.

## Credits

- Algorithm basis: [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu) (MIT)
- Terminal UI/SQLite WASM architecture: [alastorid/houseEx](https://github.com/alastorid/houseEx)
- Chart engine: [SylarLong/iztro](https://github.com/SylarLong/iztro)

Traditional divination software is provided for research and reference only.
