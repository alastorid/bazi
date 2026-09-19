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
    assert db.execute('''SELECT COUNT(*) FROM "命盤排名" WHERE ABS("百分位"-100.0*(1-("排名序"-1)/GREATEST(?-1,1)))>0.000001''',[n]).fetchone()[0]==0
    assert db.execute('''SELECT COUNT(*) FROM (SELECT "加權分",COUNT(DISTINCT "排名序") n FROM "命盤排名" GROUP BY "加權分" HAVING n<>1)''').fetchone()[0]==0
    assert db.execute('SELECT COUNT(*) FROM "排名敏感度"').fetchone()[0]==24
    assert db.execute('SELECT COUNT(*) FROM "參考盤驗證" WHERE "排序差異數"=0 AND "樣本數"=?',[n]).fetchone()[0]==5
    assert db.execute('SELECT SUM("樣本數") FROM "排名驗證" WHERE "分組"=\'全期\'').fetchone()[0]==n
    print(json.dumps({'verifiedRows':n,'minimumSample':minimum,'subgroupDiagnostics':db.execute('SELECT "結論",COUNT(*) FROM "排名驗證結論" GROUP BY "結論"').fetchall()},ensure_ascii=False))
db.close()
