"""Rank by actual timing, with explicit admission rather than fabricated PR caps."""

def create_timing_rank(db,meta):
    count=db.execute('SELECT COUNT(*) FROM "命盤時運"').fetchone()[0]
    qualified=db.execute('SELECT COUNT(*) FROM "命盤時運" WHERE "評選合格"=1').fetchone()[0]
    # Lexicographic priority is visible: admission, timely years, then natal breadth.
    # KEY determines display order only, never the shared rank of equal evidence.
    db.execute('''CREATE OR REPLACE TABLE "命盤排名" AS WITH r AS (
      SELECT *,ROW_NUMBER() OVER(ORDER BY "評選合格" DESC,"得時分" DESC,"吉宮數" DESC,"KEY")::INTEGER AS "總序",
      RANK() OVER(ORDER BY "評選合格" DESC,"得時分" DESC,"吉宮數" DESC)::INTEGER AS "排名序"
      FROM "命盤時運"
    ) SELECT "KEY","總序","排名序",
      CASE WHEN "評選合格"=1 THEN ROUND(100.0*(1-("排名序"-1)/GREATEST(?-1,1)),6) ELSE NULL END AS "百分位",
      CASE WHEN "評選合格"=1 THEN ROUND(1.0*(1-("排名序"-1)/GREATEST(?-1,1)),8) ELSE NULL END AS "PR",
      "得時分" AS "加權分",
      ROUND(100.0*(1-("排名序"-1)/GREATEST(?-1,1)),6) AS "相對百分位",
      "評選合格","未達門檻原因","吉宮數","壯年吉限年數","壯年風險年數","首次吉限年齡","晚發限定"
      FROM r''',[qualified,qualified,count])
    assert db.execute('SELECT COUNT(*),COUNT(DISTINCT "KEY"),COUNT(DISTINCT "總序") FROM "命盤排名"').fetchone()==(count,count,count)
    assert db.execute('SELECT COUNT(*) FROM "命盤排名" WHERE ("評選合格"=0 AND "百分位" IS NOT NULL) OR ("評選合格"=1 AND "百分位" IS NULL)').fetchone()[0]==0
    assert db.execute('''SELECT COUNT(*) FROM "命盤排名" WHERE "百分位">=99 AND
      ("吉宮數"<3 OR "壯年吉限年數"<10 OR "壯年風險年數">10 OR "晚發限定"=1)''').fetchone()[0]==0
    meta['tables']['命盤排名']=[{'name':n,'type':'TEXT' if t=='VARCHAR' else 'INTEGER' if t=='INTEGER' else 'REAL'} for n,t,*_ in db.execute('DESCRIBE "命盤排名"').fetchall()]
    meta['ranking']={'method':'適時資格優先，再按得時分、吉宮數排序；同值並列',
                     'scope':'全資料範圍；適時PR僅在合格群體內計算',
                     'prDefinition':'未達門檻者PR為空；相對百分位另列，不冒稱好命',
                     'rankedCount':count,'qualifiedCount':qualified,
                     'model':'timing-v1','weightsAreModelParameters':True}
    return {'rows':count,'qualified':qualified}
