"""Synthetic SQL regression, not a generated production dataset."""
import duckdb
from ranking_native import finalize_ranking

db=duckdb.connect()
db.execute('''CREATE TABLE "命盤" AS SELECT CAST(i AS VARCHAR) "KEY",'https://example.invalid/' "命盤連結",
 '2026-01-01' "公曆日期",'子時' "時辰",0 "時辰序號",CASE WHEN i%2=0 THEN '女' ELSE '男' END "性別",2026 "年",1 "月",0 "空宮數",
 CASE WHEN i<100 THEN '命宮' ELSE '兄弟' END "化忌宮位",'財帛' "化祿宮位" FROM range(240) t(i)''')
db.execute('''CREATE TABLE "命盤比較宮位" AS SELECT "KEY",'宮'||CAST(p AS VARCHAR) "宮位",CAST("KEY" AS DOUBLE) "原始作用",1.0 "宮位權重",CAST("KEY" AS DOUBLE) "加權作用",1 "主星數" FROM "命盤" CROSS JOIN range(12) t(p)''')
db.execute('''CREATE TABLE "命盤比較星曜" AS SELECT "KEY",'宮0' "宮位",'紫微' "星曜",CASE WHEN CAST("KEY" AS INTEGER)>100 THEN '廟' ELSE '陷' END "亮度",'' "四化" FROM "命盤"''')
db.execute('''CREATE TABLE "命盤格局明細" AS SELECT "KEY",CASE WHEN CAST("KEY" AS INTEGER)>100 THEN '吉' ELSE '凶' END "吉凶" FROM "命盤"''')
meta={'tables':{},'ranking':{}}
report=finalize_ranking(db,meta,240)
assert report['rows']==240
assert len(meta['tables'])==10
assert db.execute('SELECT MAX("百分位"),MIN("百分位") FROM "命盤排名"').fetchone()==(100,0)
ties=db.execute('''WITH s(v) AS (VALUES (9),(9),(2)),r AS (SELECT RANK() OVER(ORDER BY v DESC) n,COUNT(*) OVER() c FROM s)
 SELECT n,100.0*(1-(n-1)/(c-1)) FROM r ORDER BY n''').fetchall()
assert ties==[(1,100),(1,100),(3,0)]
assert db.execute("SELECT SUM(date_diff('day',make_date(y,1,1),make_date(y+1,1,1)))*24 FROM UNNEST(?) t(y)",[list(range(2026,2036))]).fetchone()[0]==87648
print(report)
