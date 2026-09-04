# bazi — 紫微限定時間範圍反查

Static GitHub Pages Web SQL terminal for querying every Zi Wei Dou Shu chart in a generated year.

## Dataset

- 8,760 rows: 365 days × 12 Chinese two-hour periods × 2 genders.
- Primary key format: `YYYYMMDD-時辰-性別`, for example `20270810-子時-女`.
- One deliberately wide, first-normal-form SQLite table named `命盤`.
- Separate columns for every star's exact brightness and palace.
- Separate columns for every palace's major stars and all stars.
- Twelve palace-specific decadal range columns (`命宮大限` through `父母大限`).
- Four transformation star/palace pairs: `化祿`, `化權`, `化科`, `化忌`.
- Direct columns for `命宮`, `身宮`, and `身宮宮位`.

The chart generator is a batch-oriented port of `ziwei-doushu/lib/ziwei/algorithm.ts`. It uses the same `iztro` `astro.bySolar` call and `lunar-javascript`; exact traditional Chinese brightness labels are retained for filtering.

## Run locally

```sh
npm install
npm run build -- 2027
npm run serve
```

Serve `dist/` through an HTTP server. Do not open `index.html` directly because SQLite WASM and the database are fetched by a Web Worker.

`build` is the single entry point: it generates SQLite + gzip + metadata, copies the browser SQLite WASM runtime, and verifies row count, unique keys, four transformations, 命宮 and 身宮.

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

The browser terminal is read-only and caps displayed results at 1,000 rows. CSV export exports the currently displayed result.

## Credits

- Algorithm basis: [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu) (MIT)
- Terminal UI/SQLite WASM architecture: [alastorid/houseEx](https://github.com/alastorid/houseEx)
- Chart engine: [SylarLong/iztro](https://github.com/SylarLong/iztro)

Traditional divination software is provided for research and reference only.
