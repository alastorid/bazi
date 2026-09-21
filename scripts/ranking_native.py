"""Timing-first ranking and auditable population checks (Actions runner)."""
import math
from timing_rank import create_timing_rank
from life_timing import DEFAULT_POLICY, age_weight

def register(db, meta, name):
    meta['tables'][name]=[{'name':n,'type':'TEXT' if t=='VARCHAR' else 'INTEGER' if t in ('INTEGER','BIGINT') else 'REAL'} for n,t,*_ in db.execute(f'DESCRIBE "{name}"').fetchall()]

def finalize_ranking(db,meta,min_sample=10000):
    if not db.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name='命盤時運'").fetchone()[0]:
        from life_native import build_life_tables
        build_life_tables(db,meta)
    summary=create_timing_rank(db,meta)
    count=summary['rows']
    assert count>=min_sample,(count,min_sample)
    policy=DEFAULT_POLICY
    denominator=sum(age_weight(a) for a in range(1,policy.working_end+1))
    # Recompute age intersections in SQL, independently of the Python interval loop.
    db.execute("""CREATE OR REPLACE TEMP TABLE age_audit AS
      SELECT d."KEY",COUNT(*) FILTER(WHERE d."判讀"='吉' AND age BETWEEN 20 AND 49) AS good,
       COUNT(*) FILTER(WHERE d."判讀" IN ('凶','吉凶並見') AND age BETWEEN 20 AND 49) AS bad,
       SUM(CASE WHEN d."判讀"='吉' THEN w WHEN d."判讀" IN ('凶','吉凶並見') THEN -w ELSE 0 END) AS net
      FROM "命盤大限明細" d JOIN
        (SELECT age,CASE WHEN age<=19 THEN .5 WHEN age<=49 THEN 1.0 WHEN age<=59 THEN .5 ELSE 0 END w FROM range(1,80) t(age)) a
        ON age BETWEEN d."起始年齡" AND d."終止年齡" GROUP BY d."KEY" """)
    violations=db.execute("""SELECT COUNT(*) FROM age_audit a JOIN "命盤時運" t USING("KEY")
      WHERE good<>t."壯年吉限年數" OR bad<>t."壯年風險年數" OR ABS(net*100/?-t."得時分")>0.000001""",[denominator]).fetchone()[0]
    assert violations==0,('逐歲 SQL 對照不符',violations)
    assert db.execute("""SELECT COUNT(*) FROM "命盤時運" WHERE "評選合格"<>
      CASE WHEN "吉宮數">=3 AND "壯年吉限年數">=10 AND "壯年風險年數"<=10 AND "加權吉限年數">"加權風險年數" THEN 1 ELSE 0 END""").fetchone()[0]==0
    assert db.execute("""SELECT COUNT(*) FROM (SELECT "KEY",SUM(CASE WHEN "判讀"='吉' THEN 1 ELSE 0 END) n FROM "命盤宮位判讀" GROUP BY "KEY") a
      JOIN "命盤時運" t USING("KEY") WHERE n<>t."吉宮數" """).fetchone()[0]==0
    assert db.execute('SELECT COUNT(*) FROM "命盤大限明細" WHERE "終止年齡"-"起始年齡"<>9').fetchone()[0]==0
    assert db.execute("""SELECT COUNT(*) FROM (SELECT *,LAG("終止年齡") OVER(PARTITION BY "KEY" ORDER BY "起始年齡") prev FROM "命盤大限明細") WHERE prev IS NOT NULL AND "起始年齡"<>prev+1""").fetchone()[0]==0
    ref=db.execute('SELECT "KEY" FROM "命盤排名" ORDER BY "總序" LIMIT 1 OFFSET ?',[count//2]).fetchone()[0]
    db.execute("""CREATE OR REPLACE TABLE "命盤對比明細" AS SELECT a."KEY" AS "KEY_A",b."KEY" AS "KEY_B",a."宮位",
      a."起始年齡" AS "甲起始年齡",b."起始年齡" AS "乙起始年齡",a."判讀" AS "甲判讀",b."判讀" AS "乙判讀",
      a."得時作用" AS "甲作用",b."得時作用" AS "乙作用",ROUND((a."得時作用"-b."得時作用")*100/?,6) AS "差值",
      a."依據" AS "甲依據",b."依據" AS "乙依據"
      FROM "命盤大限明細" a JOIN "命盤大限明細" b ON a."宮位"=b."宮位" AND b."KEY"=?""",[denominator,ref])
    db.execute("""CREATE OR REPLACE TABLE "排名峰值快照" AS SELECT CASE WHEN r."總序"<=5 THEN '頂端' ELSE '底端' END AS "峰別",
      m."命盤連結",m."公曆日期",m."時辰",m."時辰序號",m."性別",r.*
      FROM "命盤" m JOIN "命盤排名" r USING("KEY") WHERE r."總序"<=5 OR r."總序">?-5""",[count])
    db.execute("""CREATE OR REPLACE TEMP TABLE grouped_rank AS
      SELECT '全期' AS "分組",'全部' AS "群組",r.* FROM "命盤排名" r
      UNION ALL SELECT '年',CAST(m."年" AS VARCHAR),r.* FROM "命盤排名" r JOIN "命盤" m USING("KEY")
      UNION ALL SELECT '月',substr(m."公曆日期",1,7),r.* FROM "命盤排名" r JOIN "命盤" m USING("KEY")
      UNION ALL SELECT '性別',m."性別",r.* FROM "命盤排名" r JOIN "命盤" m USING("KEY")
      UNION ALL SELECT '年性別',CAST(m."年" AS VARCHAR)||'／'||m."性別",r.* FROM "命盤排名" r JOIN "命盤" m USING("KEY")""")
    # Persist aggregates; views must not depend on a temporary build table.
    db.execute("""CREATE OR REPLACE TABLE "排名分佈" AS SELECT "分組","群組",COUNT(*)::INTEGER AS "樣本數",
      SUM("評選合格")::INTEGER AS "合格數",ROUND(AVG("百分位"),2) AS "合格平均PR",
      ROUND(AVG("相對百分位"),2) AS "平均相對百分位",AVG("吉宮數") AS "平均吉宮數",
      AVG("壯年吉限年數") AS "平均壯年吉限年數",AVG("壯年風險年數") AS "平均壯年風險年數"
      FROM grouped_rank GROUP BY "分組","群組" """)
    db.execute("""CREATE OR REPLACE TABLE "排名驗證" AS SELECT "分組","群組",
      CASE WHEN "評選合格"=0 THEN '未達門檻' WHEN "百分位">=95 THEN '頂端' WHEN "百分位"<=5 THEN '合格底端' ELSE '合格中段' END AS "層級",
      COUNT(*)::INTEGER AS "樣本數",AVG("吉宮數") AS "吉宮數",AVG("壯年吉限年數") AS "壯年吉限年數",
      AVG("壯年風險年數") AS "壯年風險年數",AVG("加權分") AS "得時分"
      FROM grouped_rank GROUP BY "分組","群組","層級" """)
    db.execute("""CREATE OR REPLACE TABLE "排名驗證結論" AS SELECT "分組","群組",COUNT(*)::INTEGER AS "樣本數",
      SUM("評選合格")::INTEGER AS "合格數",
      CASE WHEN SUM(CASE WHEN "百分位">=99 AND ("評選合格"<>1 OR "吉宮數"<3 OR "壯年吉限年數"<10 OR "壯年風險年數">10 OR "晚發限定"=1) THEN 1 ELSE 0 END)>0
        THEN '門檻違反' WHEN SUM("評選合格")=0 THEN '無合格命盤' ELSE '門檻通過' END AS "結論",
      '逐盤驗證公開門檻，不以分組平均代替個別合格證據；不代表現實人生保證' AS "解釋"
      FROM grouped_rank GROUP BY "分組","群組" """)
    assert db.execute('SELECT COUNT(*) FROM "排名驗證結論" WHERE "結論"=\'門檻違反\'').fetchone()[0]==0
    db.execute("""CREATE OR REPLACE VIEW "排名宮位統計" AS SELECT m."年",m."月",m."性別",d."宮位",d."判讀",
      COUNT(*) AS "樣本數",AVG(d."起始年齡") AS "平均到達年齡",AVG(d."得時作用") AS "平均得時作用"
      FROM "命盤大限明細" d JOIN "命盤" m USING("KEY") GROUP BY m."年",m."月",m."性別",d."宮位",d."判讀" """)
    db.execute("""CREATE OR REPLACE VIEW "排名頂端特徵" AS SELECT p."宮位",p."判讀",COUNT(*) AS "次數",AVG(d."起始年齡") AS "平均到達年齡"
      FROM "命盤宮位判讀" p JOIN "命盤排名" r USING("KEY") JOIN "命盤大限明細" d ON d."KEY"=p."KEY" AND d."宮位"=p."宮位"
      WHERE r."百分位">=99 GROUP BY p."宮位",p."判讀" """)
    # Reference cannot alter admission or order: only display differences use it.
    baseline=db.execute('SELECT "KEY","評選合格","加權分","吉宮數" FROM "命盤排名" ORDER BY "總序"').fetchall()
    db.execute('CREATE OR REPLACE TABLE "參考盤驗證" ("參考盤" VARCHAR,"樣本數" INTEGER,"排序差異數" INTEGER,"結論" VARCHAR)')
    for index in sorted(set([0,count//4,count//2,3*count//4,count-1])):
        reference=baseline[index]
        order=sorted(baseline,key=lambda r:(-r[1],-round(r[2]-reference[2],6),-r[3],r[0]))
        errors=sum(a[0]!=b[0] for a,b in zip(baseline,order))
        assert errors==0
        db.execute('INSERT INTO "參考盤驗證" VALUES (?,?,?,?)',[reference[0],count,errors,'資格及大限排序不依賴參考盤'])
    # Sensitivity now changes AGE weights, not obsolete natal palace weights.
    components=db.execute('''SELECT d."KEY",
      SUM(CASE WHEN age<=19 THEN w*sgn ELSE 0 END),
      SUM(CASE WHEN age BETWEEN 20 AND 49 THEN w*sgn ELSE 0 END),
      SUM(CASE WHEN age BETWEEN 50 AND 59 THEN w*sgn ELSE 0 END),
      t."吉宮數",t."壯年吉限年數",t."壯年風險年數"
      FROM (SELECT *,CASE WHEN "判讀"='吉' THEN 1 WHEN "判讀" IN ('凶','吉凶並見') THEN -1 ELSE 0 END sgn FROM "命盤大限明細") d
      JOIN (SELECT age,CASE WHEN age<=19 OR age>=50 THEN .5 ELSE 1.0 END w FROM range(1,60) t(age)) a
      ON age BETWEEN d."起始年齡" AND d."終止年齡" JOIN "命盤時運" t USING("KEY")
      GROUP BY d."KEY",t."吉宮數",t."壯年吉限年數",t."壯年風險年數"''').fetchall()
    def midranks(values):
        order=sorted(values,key=lambda k:values[k],reverse=True);out={};i=0
        while i<len(order):
            j=i+1
            while j<len(order) and values[order[j]]==values[order[i]]:j+=1
            for k in order[i:j]:out[k]=(i+j-1)/2
            i=j
        return out
    base_values={r[0]:(r[1],r[2],r[3]) for r in baseline};base_rank=midranks(base_values)
    mean=(count-1)/2;base_var=sum((v-mean)**2 for v in base_rank.values())
    peak_size=math.ceil(summary['qualified']*.01)
    peak={r[0] for r in baseline[:peak_size]}
    db.execute('CREATE OR REPLACE TABLE "排名敏感度" ("時段" VARCHAR,"權重變動" VARCHAR,"排序相關" DOUBLE,"頂端重合百分比" DOUBLE,"合格數" INTEGER,"樣本數" INTEGER)')
    scenarios=[]
    for index,(label,mass) in enumerate([('1–19歲',9.5),('20–49歲',30),('50–59歲',5)]):
        for delta in [-.1,.1]:
            values={}
            for key,a,b,c,good,prime_good,prime_bad in components:
                a,b,c=map(float,(a,b,c))
                net=a+b+c+[a,b,c][index]*delta
                eligible=int(good>=3 and prime_good>=10 and prime_bad<=10 and net>0)
                values[key]=(eligible,round(net*100/(denominator+mass*delta),6),good)
            ranks=midranks(values);denom=math.sqrt(base_var*sum((v-mean)**2 for v in ranks.values()))
            rho=sum((base_rank[k]-mean)*(ranks[k]-mean) for k in ranks)/denom if denom else 1.0
            admitted=sum(v[0] for v in values.values())
            order=sorted(values,key=lambda k:(-values[k][0],-values[k][1],-values[k][2],k))
            new_peak=set(order[:math.ceil(admitted*.01)])
            overlap=100*len(peak&new_peak)/len(peak) if peak else None
            scenarios.append((label,f'{delta:+.0%}',rho,overlap,admitted,count))
    db.executemany('INSERT INTO "排名敏感度" VALUES (?,?,?,?,?,?)',scenarios)
    names=['命盤排名','命盤對比明細','排名峰值快照','排名分佈','排名宮位統計','排名頂端特徵','排名驗證','排名驗證結論','參考盤驗證','排名敏感度']
    for name in names:register(db,meta,name)
    meta['ranking'].update(verifiedRows=count,minimumSample=min_sample,refereeKey=ref,globalDiagnostic='逐盤時運門檻通過')
    return {**summary,'minimumSample':min_sample,'ageIntersectionErrors':violations,'referenceChanges':0,
            'diagnostics':db.execute('SELECT "結論",COUNT(*) FROM "排名驗證結論" GROUP BY "結論"').fetchall()}
