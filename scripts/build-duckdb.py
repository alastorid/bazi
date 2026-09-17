"""Actions-only: convert the verified staging database to a native DuckDB file."""
import gzip
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import duckdb
import pyarrow as pa

root = Path(__file__).resolve().parent.parent
meta_path = root / 'data/metadata.json'
meta = json.loads(meta_path.read_text())
source = root / meta['sqlite'].removesuffix('.gz')
if not source.exists():
    source.write_bytes(gzip.decompress((root / meta['sqlite']).read_bytes()))
target = source.with_suffix('.duckdb')
if target.exists():
    target.unlink()
sql = sqlite3.connect(f'file:{source}?mode=ro', uri=True)
db = duckdb.connect(str(target))
quote = lambda value: '"' + value.replace('"', '""') + '"'
counts = {}
for name, columns in meta['tables'].items():
    types = {'TEXT': ('VARCHAR', pa.string()), 'INTEGER': ('INTEGER', pa.int32()), 'REAL': ('DOUBLE', pa.float64())}
    fields = [(column['name'], *types[column['type']]) for column in columns]
    db.execute(f'CREATE TABLE {quote(name)} (' + ','.join(f'{quote(n)} {t}' for n, t, _ in fields) + ')')
    cursor = sql.execute(f'SELECT ' + ','.join(quote(n) for n, _, _ in fields) + f' FROM {quote(name)}')
    total = 0
    while batch := cursor.fetchmany(20000):
        arrow_batch = pa.table({n: pa.array([row[i] for row in batch], type=typ) for i, (n, _, typ) in enumerate(fields)})
        db.register('transfer_batch', arrow_batch)
        db.execute(f'INSERT INTO {quote(name)} SELECT * FROM transfer_batch')
        db.unregister('transfer_batch')
        total += len(batch)
    actual = db.execute(f'SELECT COUNT(*) FROM {quote(name)}').fetchone()[0]
    assert actual == total, (name, actual, total)
    counts[name] = total
    print(f'{name}: {total:,}', flush=True)

db.execute('''CREATE VIEW "命盤總覽" AS
SELECT m.*, COALESCE(p."吉格數",0)::INTEGER AS "吉格數",
 COALESCE(p."凶格數",0)::INTEGER AS "凶格數",
 p."最高稀有度",p."吉格",p."凶格"
FROM "命盤" m LEFT JOIN (
 SELECT "KEY", COUNT(*) FILTER (WHERE "吉凶"='吉') AS "吉格數",
 COUNT(*) FILTER (WHERE "吉凶"='凶') AS "凶格數",MAX("結構稀有度") AS "最高稀有度",
 string_agg("名稱", '、' ORDER BY "名稱") FILTER (WHERE "吉凶"='吉') AS "吉格",
 string_agg("名稱", '、' ORDER BY "名稱") FILTER (WHERE "吉凶"='凶') AS "凶格"
 FROM "命盤格局明細" WHERE "吉凶" IN ('吉','凶') AND "結構稀有度" BETWEEN 1 AND 5 GROUP BY "KEY"
) p USING ("KEY")''')
meta['tables']['命盤總覽'] = meta['columns'] + [
    {'name': n, 'type': t} for n, t in [('吉格數','INTEGER'),('凶格數','INTEGER'),('最高稀有度','INTEGER'),('吉格','TEXT'),('凶格','TEXT')]
]
counts['命盤總覽'] = db.execute('SELECT COUNT(*) FROM "命盤總覽"').fetchone()[0]
assert counts['命盤總覽'] == meta['rowCount']
for item in json.loads(Path(sys.argv[1]).read_text()):
    result = db.execute(item['sql']).fetchall()
    assert result, f"Empty result: {item['name']}"
    print(f"Verified {item['name']}: {len(result):,} rows", flush=True)
db.execute('CHECKPOINT')
db.close()
sql.close()
compressed = gzip.compress(target.read_bytes(), compresslevel=9, mtime=0)
target.with_suffix('.duckdb.gz').write_bytes(compressed)
meta.update(engine='duckdb', engineVersion=duckdb.__version__, duckdb=f'data/{target.name}.gz',
            hash=hashlib.sha256(compressed).hexdigest(), compressedBytes=len(compressed),
            uncompressedBytes=target.stat().st_size, tableCounts=counts)
meta.pop('sqlite', None)
meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
print(f'DuckDB ready: {len(compressed)/1048576:.1f} MB compressed', flush=True)
