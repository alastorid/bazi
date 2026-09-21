"""Read-only checks on the final runner-built database; no chart generation."""
import json
import os
from pathlib import Path
import sys
import duckdb

meta=json.loads(Path('data/metadata.json').read_text())
db=duckdb.connect(meta['duckdb'].removesuffix('.gz'),read_only=True)
if sys.argv[1]=='queries':
    for query in json.load(sys.stdin):
        result=db.execute(query['sql'])
        assert result.description,query['name']
        rows=result.fetchall()
        print(f"Verified {query['name']}: {len(rows)} rows")
else:
    n=meta['rowCount']
    minimum=int(os.environ.get('MIN_SAMPLE','10000'))
    assert n>=minimum,(n,minimum)
    assert db.execute('SELECT COUNT(*),COUNT(DISTINCT "KEY"),COUNT(DISTINCT "總序") FROM "命盤排名"').fetchone()==(n,n,n)
    assert db.execute('SELECT COUNT(*) FROM "命盤比較宮位"').fetchone()[0]==12*n
    assert db.execute('SELECT COUNT(*) FROM "命盤對比明細"').fetchone()[0]==12*n
    eligible=db.execute('SELECT SUM("評選合格") FROM "命盤排名"').fetchone()[0]
    assert db.execute('''SELECT COUNT(*) FROM "命盤排名" WHERE ABS("百分位"-100.0*(1-("排名序"-1)/GREATEST(?-1,1)))>0.000001''',[eligible]).fetchone()[0]==0
    assert db.execute('''SELECT COUNT(*) FROM (SELECT "評選合格","加權分","吉宮數",COUNT(DISTINCT "排名序") n FROM "命盤排名" GROUP BY 1,2,3 HAVING n<>1)''').fetchone()[0]==0
    assert db.execute('SELECT COUNT(*) FROM "排名敏感度"').fetchone()[0]==6
    assert db.execute('SELECT COUNT(*) FROM "參考盤驗證" WHERE "排序差異數"=0 AND "樣本數"=?',[n]).fetchone()[0]==len(set([0,n//4,n//2,3*n//4,n-1]))
    assert db.execute('SELECT COUNT(*) FROM "命盤大限明細"').fetchone()[0]==12*n
    assert db.execute('SELECT COUNT(*) FROM "命盤排名" WHERE "評選合格"=0 AND "百分位" IS NOT NULL').fetchone()[0]==0
    assert db.execute('''SELECT COUNT(*) FROM "命盤排名" WHERE "百分位">=99 AND ("吉宮數"<3 OR "壯年吉限年數"<10 OR "壯年風險年數">10 OR "晚發限定"=1)''').fetchone()[0]==0
    assert db.execute('SELECT SUM("樣本數") FROM "排名驗證" WHERE "分組"=\'全期\'').fetchone()[0]==n
    print(json.dumps({'verifiedRows':n,'minimumSample':minimum,'subgroupDiagnostics':db.execute('SELECT "結論",COUNT(*) FROM "排名驗證結論" GROUP BY "結論"').fetchall()},ensure_ascii=False))
db.close()
