"""Global ranking, explanations and diagnostics over precomputed palace profiles."""
import json
import math

def register(db, meta, name):
    types={'VARCHAR':'TEXT','INTEGER':'INTEGER','BIGINT':'INTEGER','HUGEINT':'REAL','DOUBLE':'REAL','FLOAT':'REAL'}
    meta['tables'][name]=[{'name':n,'type':types.get(t,'REAL' if 'DECIMAL' in t else 'TEXT')} for n,t,*_ in db.execute(f'DESCRIBE "{name}"').fetchall()]

def finalize_ranking(db,meta,min_sample=10000):
    count=db.execute('SELECT COUNT(*) FROM "命盤"').fetchone()[0]
    assert count>=min_sample, f'Require at least {min_sample} charts, got {count}'
    ref=db.execute('SELECT "KEY" FROM "命盤" ORDER BY "KEY" LIMIT 1 OFFSET ?', [count//2]).fetchone()[0]
    db.execute('''CREATE OR REPLACE TEMP TABLE potentials AS
      SELECT "KEY",ROUND(SUM("加權作用"),6) AS value FROM "命盤比較宮位" GROUP BY "KEY"''')
    reference=db.execute('SELECT value FROM potentials WHERE "KEY"=?',[ref]).fetchone()[0]
    db.execute('''CREATE OR REPLACE TABLE "命盤排名" AS WITH sorted AS (
      SELECT "KEY",ROW_NUMBER() OVER(ORDER BY value DESC,"KEY")::INTEGER AS "總序",
      RANK() OVER(ORDER BY value DESC)::INTEGER AS "排名序",value FROM potentials
    ) SELECT "KEY","總序","排名序",
      ROUND(100.0*(1-("排名序"-1)/GREATEST(?-1,1)),6) AS "百分位",
      ROUND(1.0*(1-("排名序"-1)/GREATEST(?-1,1)),8) AS "PR",
      ROUND(value-?,6) AS "加權分" FROM sorted''',[count,count,reference])
    assert db.execute('SELECT COUNT(*),COUNT(DISTINCT "總序"),MIN("總序"),MAX("總序") FROM "命盤排名"').fetchone()==(count,count,1,count)
    assert db.execute('SELECT COUNT(*) FROM "命盤排名" WHERE "百分位" NOT BETWEEN 0 AND 100 OR ABS("百分位"/100-"PR")>0.000001').fetchone()[0]==0
    # Persist the complete reference comparison (12 rows per chart).
    db.execute('''CREATE OR REPLACE TABLE "命盤對比明細" AS
      SELECT a."KEY" AS "KEY_A",b."KEY" AS "KEY_B",a."宮位",'全宮' AS "星曜",
        a."原始作用" AS "甲作用",b."原始作用" AS "乙作用",a."宮位權重" AS "權重",
        ROUND(a."加權作用"-b."加權作用",6) AS "差值",
        CASE WHEN a."原始作用">b."原始作用" THEN '甲較高' WHEN a."原始作用"<b."原始作用" THEN '乙較高' ELSE '相同' END AS "勝負",
        '星曜作用＋主星補償；逐星來源見命盤比較星曜' AS "原因"
      FROM "命盤比較宮位" a JOIN "命盤比較宮位" b ON a."宮位"=b."宮位" AND b."KEY"=?''',[ref])
    assert db.execute('SELECT COUNT(*) FROM "命盤對比明細"').fetchone()[0]==count*12
    assert db.execute('''SELECT COUNT(*) FROM (SELECT "KEY_A",ROUND(SUM("差值"),6) d FROM "命盤對比明細" GROUP BY "KEY_A") a
      JOIN "命盤排名" r ON r."KEY"=a."KEY_A" WHERE ABS(d-r."加權分")>0.000001''').fetchone()[0]==0
    db.execute('''CREATE OR REPLACE TABLE "排名峰值快照" AS SELECT
      CASE WHEN r."總序"<=5 THEN '頂端' ELSE '底端' END AS "峰別",m."KEY",m."命盤連結",m."公曆日期",m."時辰",m."時辰序號",m."性別",r."總序",r."排名序",r."百分位",r."加權分"
      FROM "命盤" m JOIN "命盤排名" r USING("KEY") WHERE r."總序"<=5 OR r."總序">? - 5''',[count])
    db.execute('''CREATE OR REPLACE VIEW "排名分佈" AS WITH groups AS (
      SELECT '全期' AS "分組",'全部' AS "群組",r.* FROM "命盤排名" r
      UNION ALL SELECT '年',CAST(m."年" AS VARCHAR),r.* FROM "命盤排名" r JOIN "命盤" m USING("KEY")
      UNION ALL SELECT '月',substr(m."公曆日期",1,7),r.* FROM "命盤排名" r JOIN "命盤" m USING("KEY")
      UNION ALL SELECT '性別',m."性別",r.* FROM "命盤排名" r JOIN "命盤" m USING("KEY")
    ) SELECT "分組","群組",COUNT(*)::INTEGER AS "樣本數",ROUND(AVG("百分位"),2) AS "平均PR",
      ROUND(quantile_cont("百分位",0.25),2) AS "PR四分位",ROUND(median("百分位"),2) AS "PR中位",
      ROUND(quantile_cont("百分位",0.75),2) AS "PR上四分位",MIN("百分位") AS "最低PR",MAX("百分位") AS "最高PR",
      COUNT(*) FILTER(WHERE "百分位">=99)::INTEGER AS "前百分之一筆數" FROM groups GROUP BY "分組","群組"''')
    db.execute('''CREATE OR REPLACE VIEW "排名宮位統計" AS
      SELECT m."年",m."月",m."性別",p."宮位",CASE WHEN r."百分位">=99 THEN '前百分之一' ELSE '其餘' END AS "群體",
      COUNT(*)::INTEGER AS "樣本數",ROUND(AVG(r."百分位"),2) AS "平均PR",ROUND(AVG(p."加權作用"),4) AS "平均作用",
      COUNT(*) FILTER(WHERE p."主星數"=0)::INTEGER AS "空宮筆數"
      FROM "命盤比較宮位" p JOIN "命盤" m USING("KEY") JOIN "命盤排名" r USING("KEY") GROUP BY m."年",m."月",m."性別",p."宮位","群體"''')
    db.execute('''CREATE OR REPLACE VIEW "排名頂端特徵" AS SELECT s."宮位",s."星曜",s."亮度",s."四化",
      COUNT(*)::INTEGER AS "全期次數",COUNT(*) FILTER(WHERE r."百分位">=99)::INTEGER AS "頂端次數",
      ROUND(100.0*COUNT(*) FILTER(WHERE r."百分位">=99)/NULLIF((SELECT COUNT(*) FROM "命盤排名" WHERE "百分位">=99),0),2) AS "頂端出現率"
      FROM "命盤比較星曜" s JOIN "命盤排名" r USING("KEY") GROUP BY s."宮位",s."星曜",s."亮度",s."四化"''')
    db.execute('''CREATE OR REPLACE TEMP TABLE signals AS
      SELECT m."KEY",m."年",substr(m."公曆日期",1,7) AS month,m."性別",m."空宮數",r."排名序",r."百分位",
        COALESCE(d.good,0) AS "吉格數",COALESCE(d.bad,0) AS "凶格數",b.bright AS "廟旺數",
        CASE WHEN m."化忌宮位" IN ('命宮','財帛','官祿','遷移') THEN 1 ELSE 0 END AS "忌在三方四正",
        CASE WHEN m."化祿宮位" IN ('命宮','財帛','官祿','遷移') THEN 1 ELSE 0 END AS "祿在三方四正"
      FROM "命盤" m JOIN "命盤排名" r USING("KEY")
      LEFT JOIN (SELECT "KEY",COUNT(*) FILTER(WHERE "吉凶"='吉') good,COUNT(*) FILTER(WHERE "吉凶"='凶') bad FROM "命盤格局明細" GROUP BY "KEY") d USING("KEY")
      LEFT JOIN (SELECT "KEY",COUNT(*) FILTER(WHERE "亮度" IN ('廟','旺')) bright FROM "命盤比較星曜" GROUP BY "KEY") b USING("KEY")''')
    db.execute('''CREATE OR REPLACE TABLE "排名驗證" AS WITH groups AS (
      SELECT '全期' AS "分組",'全部' AS "群組",* FROM signals
      UNION ALL SELECT '年',CAST("年" AS VARCHAR),* FROM signals
      UNION ALL SELECT '月',month,* FROM signals
      UNION ALL SELECT '性別',"性別",* FROM signals
      UNION ALL SELECT '年性別',CAST("年" AS VARCHAR)||'／'||"性別",* FROM signals
    ), ranked AS (SELECT *,100.0*(1-(RANK() OVER(PARTITION BY "分組","群組" ORDER BY "排名序")-1)/GREATEST(COUNT(*) OVER(PARTITION BY "分組","群組")-1,1)) AS local_pr FROM groups)
    SELECT "分組","群組",CASE WHEN local_pr>=95 THEN '頂端' WHEN local_pr<=5 THEN '底端' ELSE '中段' END AS "層級",COUNT(*)::INTEGER AS "樣本數",
      AVG("吉格數") AS "吉格數",AVG("凶格數") AS "凶格數",AVG("廟旺數") AS "廟旺數",AVG("忌在三方四正") AS "忌在三方四正",AVG("祿在三方四正") AS "祿在三方四正",AVG("空宮數") AS "空宮數"
    FROM ranked GROUP BY "分組","群組","層級"''')
    db.execute('''CREATE OR REPLACE TABLE "排名驗證結論" AS SELECT t."分組",t."群組",t."樣本數" AS "頂端樣本",COALESCE(b."樣本數",0) AS "底端樣本",
      CASE WHEN b."樣本數" IS NULL OR LEAST(t."樣本數",b."樣本數")<10 THEN '樣本不足'
      WHEN t."吉格數">b."吉格數" AND t."凶格數"<b."凶格數" AND t."廟旺數">b."廟旺數" AND t."忌在三方四正"<b."忌在三方四正" THEN '方向一致' ELSE '需覆核' END AS "結論",
      '分組均值診斷，不能保證每張高PR命盤無凶格，也不是現實人生驗證' AS "解釋"
      FROM "排名驗證" t LEFT JOIN "排名驗證" b ON t."分組"=b."分組" AND t."群組"=b."群組" AND b."層級"='底端' WHERE t."層級"='頂端' ''')
    global_status=db.execute('SELECT "結論" FROM "排名驗證結論" WHERE "分組"=\'全期\'').fetchone()[0]
    assert global_status=='方向一致', f'Global ranking diagnostic failed: {global_status}'
    # Quantify ±10% palace-weight sensitivity, using all charts and tie-aware ranks.
    totals=dict(db.execute('SELECT "KEY",value FROM potentials').fetchall())
    baseline=sorted(totals,key=lambda k:(-totals[k],k))
    def midranks(values):
        order=sorted(values,key=lambda k:-values[k]);out={};i=0
        while i<len(order):
            j=i+1
            while j<len(order) and values[order[j]]==values[order[i]]: j+=1
            for k in order[i:j]:out[k]=(i+j-1)/2
            i=j
        return out
    base_rank=midranks(totals);mean=(count-1)/2
    base_var=sum((v-mean)**2 for v in base_rank.values())
    peak=set(baseline[:max(1,math.ceil(count*.01))]); scenarios=[]
    for palace, in db.execute('SELECT DISTINCT "宮位" FROM "命盤比較宮位" ORDER BY "宮位"').fetchall():
        contribution=dict(db.execute('SELECT "KEY","加權作用" FROM "命盤比較宮位" WHERE "宮位"=?',[palace]).fetchall())
        for delta in [-.1,.1]:
            values={k:round(v+contribution[k]*delta,6) for k,v in totals.items()};rank=midranks(values)
            denom=math.sqrt(base_var*sum((v-mean)**2 for v in rank.values()))
            rho=sum((base_rank[k]-mean)*(rank[k]-mean) for k in rank)/denom if denom else 1
            changed=sorted(values,key=lambda k:(-values[k],k)); overlap=len(peak.intersection(changed[:len(peak)]))/len(peak)*100
            scenarios.append((palace,f'{delta:+.0%}',rho,overlap,max(abs(rank[k]-base_rank[k]) for k in rank),count))
    db.execute('CREATE OR REPLACE TABLE "排名敏感度" ("宮位" VARCHAR,"權重變動" VARCHAR,"排序相關" DOUBLE,"頂端重合百分比" DOUBLE,"最大名次移動" DOUBLE,"樣本數" INTEGER)')
    db.executemany('INSERT INTO "排名敏感度" VALUES (?,?,?,?,?,?)',scenarios)
    db.execute('CREATE OR REPLACE TABLE "參考盤驗證" ("參考盤" VARCHAR,"樣本數" INTEGER,"排序差異數" INTEGER,"最大差值誤差" DOUBLE,"結論" VARCHAR)')
    for index in [0,count//4,count//2,3*count//4,count-1]:
        key=baseline[index]; shifted={k:round(v-totals[key],6) for k,v in totals.items()}
        order=sorted(shifted,key=lambda k:(-shifted[k],k)); differences=sum(a!=b for a,b in zip(order,baseline))
        assert differences==0
        db.execute('INSERT INTO "參考盤驗證" VALUES (?,?,?,?,?)',[key,count,differences,0,'逐宮差值可分解；參考盤只平移作用，不改變名次'])
    names=['命盤排名','命盤對比明細','排名峰值快照','排名分佈','排名宮位統計','排名頂端特徵','排名驗證','排名驗證結論','排名敏感度','參考盤驗證']
    for name in names:register(db,meta,name)
    meta['ranking'].update(refereeKey=ref,rankedCount=count,scope='完整資料範圍',verifiedRows=count,minimumSample=min_sample,globalDiagnostic=global_status)
    return {'rows':count,'minimumSample':min_sample,'globalDiagnostic':global_status,'subgroups':db.execute('SELECT "結論",COUNT(*) FROM "排名驗證結論" GROUP BY "結論"').fetchall(),'minimumWeightCorrelation':min(r[2] for r in scenarios),'minimumTopOverlap':min(r[3] for r in scenarios),'referenceChanges':0}
