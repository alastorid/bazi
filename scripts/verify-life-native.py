"""Small synthetic persistence test; never computes the production dataset."""
import duckdb
from life_native import build_life_tables
from timing_rank import create_timing_rank
from ranking_native import finalize_ranking

palaces=['命宮','兄弟','夫妻','子女','財帛','疾厄','遷移','僕役','官祿','田宅','福德','父母']
names=['太陰','天機','太陽','左輔','右弼','祿存']
fields=['KEY','命盤連結','公曆日期','時辰','時辰序號','性別','年','月']+[h+'星' for h in ['化祿','化權','化科','化忌']]+[f'{s}{suffix}' for s in names for suffix in ['宮位','星等']]+[p+'大限' for p in palaces]
db=duckdb.connect()
db.execute('CREATE TABLE "命盤" ('+','.join('"'+n+'" VARCHAR' for n in fields)+')')
for key,late in [('早得',False),('晚得',True)]:
    row={n:'' for n in fields};row['KEY']=key
    for i,name in enumerate(names):
        row[name+'宮位']=palaces[2+i%3];row[name+'星等']='廟' if i<3 else ''
    indices=list(range(12))
    if late:
        for i in [2,3,4]:indices[i],indices[i+4]=indices[i+4],indices[i]
    for i,p in enumerate(palaces):row[p+'大限']=f'{2+indices[i]*10}-{11+indices[i]*10}'
    db.execute('INSERT INTO "命盤" VALUES ('+','.join('?' for _ in fields)+')',[row[n] for n in fields])
meta={'palaces':palaces,'stars':names,'tables':{},'rowCount':2}
build_life_tables(db,meta)
rows={r[0]:r[1:] for r in db.execute('SELECT "KEY","評選合格","得時分","吉宮數","首次吉限年齡" FROM "命盤時運"').fetchall()}
assert rows['早得'][0]==1 and rows['晚得'][0]==0
assert rows['早得'][1]>rows['晚得'][1]
assert rows['早得'][2]==rows['晚得'][2]==3
assert rows['早得'][3]==22 and rows['晚得'][3]==62
assert db.execute('SELECT COUNT(*) FROM "命盤大限明細"').fetchone()[0]==24
assert len(meta['tables'])==4
create_timing_rank(db,meta)
ranked=db.execute('SELECT "KEY","百分位","評選合格" FROM "命盤排名" ORDER BY "總序"').fetchall()
assert ranked==[('早得',100.0,1),('晚得',None,0)]
# All-unqualified populations must not invent an attractive PR99/100 chart.
db.execute('UPDATE "命盤時運" SET "評選合格"=0')
create_timing_rank(db,meta)
assert db.execute('SELECT COUNT("百分位") FROM "命盤排名"').fetchone()[0]==0
build_life_tables(db,meta)
report=finalize_ranking(db,meta,min_sample=2)
assert report['rows']==2 and report['qualified']==1
assert report['ageIntersectionErrors']==0 and report['referenceChanges']==0
assert db.execute('SELECT SUM("樣本數") FROM "排名驗證" WHERE "分組"=\'全期\'').fetchone()[0]==2
print('Native timing adapter verified: exact source ranges, unchanged palace quality, early/late qualification and persistence.')
