"""Join runner-built annual databases, deduplicate designated dates, rank globally."""
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys
import duckdb
from ranking_native import finalize_ranking, register

label=sys.argv[1]
assert re.fullmatch(r'\d{4}(?:-\d{4})?',label)
parts=list(map(int,label.split('-')));years=list(range(parts[0],parts[-1]+1))
files=sorted(Path(sys.argv[2] if len(sys.argv)>2 else 'shards').glob('*/metadata.json'))
assert len(files)==len(years),(len(files),years)
target=Path(f'data/ziwei-{label}.duckdb');target.parent.mkdir(exist_ok=True)
if target.exists():target.unlink()
db=duckdb.connect(str(target));db.execute("SET memory_limit='3GB'")
quote=lambda s:'"'+s.replace('"','""')+'"'
meta=None;seen=[]
for file in files:
    part=json.loads(file.read_text());seen+=part['years']
    compressed=file.parent/Path(part['duckdb']).name
    assert hashlib.sha256(compressed.read_bytes()).hexdigest()==part['hash']
    raw=compressed.with_suffix('');raw.write_bytes(gzip.decompress(compressed.read_bytes()))
    db.execute("ATTACH '"+str(raw.resolve()).replace("'","''")+"' AS shard (READ_ONLY)")
    if meta is None:
        meta=part
        for name in part['tables']:
            if name=='命盤總覽':continue
            db.execute(f'CREATE TABLE {quote(name)} AS SELECT * FROM shard.{quote(name)}')
    else:
        for name,cols in part['tables'].items():
            if name=='命盤總覽' or not any(c['name']=='KEY' for c in cols):continue
            db.execute(f'INSERT INTO {quote(name)} SELECT s.* FROM shard.{quote(name)} s WHERE NOT EXISTS (SELECT 1 FROM {quote(name)} d WHERE d."KEY"=s."KEY")')
    db.execute('DETACH shard');raw.unlink()
    print('Merged',part['year'],flush=True)
assert sorted(seen)==years,(seen,years)
meta.update(year=label,years=years,calendarYears=years,includedYears=sorted(set(years+[int(d[:4]) for d in meta['supplementalDates']])))
meta['rowCount']=db.execute('SELECT COUNT(*) FROM "命盤"').fetchone()[0]
expected=db.execute('SELECT SUM(date_diff(\'day\',make_date(y,1,1),make_date(y+1,1,1)))*24 FROM UNNEST(?) t(y)',[years]).fetchone()[0]+len(meta['supplementalDates'])*24
assert meta['rowCount']==expected,(meta['rowCount'],expected)
assert db.execute('SELECT COUNT(DISTINCT "KEY") FROM "命盤"').fetchone()[0]==expected
report=finalize_ranking(db,meta,min(10000,expected))
db.execute('''CREATE OR REPLACE VIEW "命盤總覽" AS
SELECT m.*,r."百分位" AS "全域PR",r."排名序" AS "全域名次",r."總序",COALESCE(p."吉格數",0)::INTEGER AS "吉格數",COALESCE(p."凶格數",0)::INTEGER AS "凶格數",p."最高稀有度",p."吉格",p."凶格"
FROM "命盤" m JOIN "命盤排名" r USING("KEY") LEFT JOIN (
 SELECT "KEY",COUNT(*) FILTER(WHERE "吉凶"='吉') AS "吉格數",COUNT(*) FILTER(WHERE "吉凶"='凶') AS "凶格數",MAX("結構稀有度") AS "最高稀有度",
 string_agg("名稱",'、' ORDER BY "名稱") FILTER(WHERE "吉凶"='吉') AS "吉格",string_agg("名稱",'、' ORDER BY "名稱") FILTER(WHERE "吉凶"='凶') AS "凶格"
 FROM "命盤格局明細" WHERE "吉凶" IN ('吉','凶') AND "結構稀有度" BETWEEN 1 AND 5 GROUP BY "KEY"
) p USING("KEY")''')
register(db,meta,'命盤總覽')
meta['tableCounts']={n:db.execute(f'SELECT COUNT(*) FROM {quote(n)}').fetchone()[0] for n in meta['tables']}
db.execute('CHECKPOINT');db.close()
compressed=gzip.compress(target.read_bytes(),compresslevel=9,mtime=0)
target.with_suffix('.duckdb.gz').write_bytes(compressed)
meta.update(duckdb=str(target)+'.gz',hash=hashlib.sha256(compressed).hexdigest(),uncompressedBytes=target.stat().st_size,compressedBytes=len(compressed))
Path('data/metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
Path('data/ranking-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
print('Combined DuckDB MB:',target.stat().st_size/1048576,'compressed:',len(compressed)/1048576,flush=True)
