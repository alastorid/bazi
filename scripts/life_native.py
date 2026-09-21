"""Actions-only persistence of natal palace evidence and actual decadal timing."""
from dataclasses import asdict
import pyarrow as pa
from life_timing import assess_timing, DEFAULT_POLICY, MODEL_VERSION
from palace_evidence import assess_palace

SCHEMAS={
 '命盤宮位判讀': [('KEY','VARCHAR'),('宮位','VARCHAR'),('判讀','VARCHAR'),('吉據','VARCHAR'),('凶據','VARCHAR'),('風險備註','VARCHAR'),('借照','INTEGER'),('殺星獨守','INTEGER'),('依據','VARCHAR')],
 '命盤大限明細': [('KEY','VARCHAR'),('宮位','VARCHAR'),('起始年齡','INTEGER'),('終止年齡','INTEGER'),('判讀','VARCHAR'),('年齡權重合計','DOUBLE'),('得時作用','DOUBLE'),('壯年吉限年數','INTEGER'),('壯年風險年數','INTEGER'),('依據','VARCHAR'),('計算範圍','VARCHAR')],
 '命盤時運': [('KEY','VARCHAR'),('吉宮數','INTEGER'),('壯年吉限年數','INTEGER'),('壯年風險年數','INTEGER'),('加權吉限年數','DOUBLE'),('加權風險年數','DOUBLE'),('得時分','DOUBLE'),('首次吉限年齡','INTEGER'),('晚發限定','INTEGER'),('起限前年數','INTEGER'),('評選合格','INTEGER'),('未達門檻原因','VARCHAR'),('晚年吉限年數','INTEGER'),('晚年風險年數','INTEGER')],
 '大限模型政策': [('版本','VARCHAR'),('參數','VARCHAR'),('數值','DOUBLE'),('來源性質','VARCHAR')],
}

def build_life_tables(db,meta):
    def quote(s):return '"'+s.replace('"','""')+'"'
    for name,fields in SCHEMAS.items():
        db.execute(f'CREATE OR REPLACE TABLE {quote(name)} ('+','.join(quote(n)+' '+t for n,t in fields)+')')
        meta['tables'][name]=[{'name':n,'type':{'VARCHAR':'TEXT','DOUBLE':'REAL','INTEGER':'INTEGER'}[t]} for n,t in fields]
    db.executemany('INSERT INTO "大限模型政策" VALUES (?,?,?,?)',[(MODEL_VERSION,k,float(v),'產品模型設定；非教材定量原文') for k,v in asdict(DEFAULT_POLICY).items()])
    buffers={name:[] for name in SCHEMAS if name!='大限模型政策'}
    def flush():
        types={'VARCHAR':pa.string(),'DOUBLE':pa.float64(),'INTEGER':pa.int32()}
        for name,rows in buffers.items():
            if not rows:continue
            fields=SCHEMAS[name]
            batch=pa.table({n:pa.array([r[i] for r in rows],type=types[t]) for i,(n,t) in enumerate(fields)})
            db.register('life_batch',batch)
            db.execute(f'INSERT INTO {quote(name)} SELECT * FROM life_batch')
            db.unregister('life_batch');rows.clear()
    pairs=[('命宮','遷移'),('兄弟','僕役' if '僕役' in meta['palaces'] else '交友'),('夫妻','官祿'),('子女','田宅'),('財帛','福德'),('疾厄','父母')]
    opposite={a:b for a,b in pairs}|{b:a for a,b in pairs}
    # Only explicitly palace-scoped, already verified formations. Never spread a
    # chart-wide 三方格 into every palace, or recompute weakened pattern conditions.
    scoped={}
    if db.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name='命盤格局明細'").fetchone()[0]:
        for key,name in db.execute('''SELECT "KEY","名稱" FROM "命盤格局明細" WHERE "規則ID" IN ('F-ZIFU-YAN','F-SHA-CHAO') AND "吉凶"='吉' ''').fetchall():
            scoped.setdefault(key,[]).append(name)
    # Fully consume each page before writing. A separate streaming cursor keeps
    # a read transaction alive and can block the writer's automatic checkpoint.
    columns=[d[0] for d in db.execute('SELECT * FROM "命盤" LIMIT 0').description]
    last_key=None
    count=qualified=0
    while True:
        batch=db.execute('SELECT * FROM "命盤" '+('WHERE "KEY">? ' if last_key is not None else '')+'ORDER BY "KEY" LIMIT 256',
                         [last_key] if last_key is not None else []).fetchall()
        if not batch:break
        for values in batch:
            row=dict(zip(columns,values));key=row['KEY']
            stars={p:[] for p in meta['palaces']}
            for name in meta['stars']:
                palace=row[name+'宮位']
                if palace not in stars:raise ValueError(f'{key}: {name} 宮位缺失')
                hua=next((h for h in ['祿','權','科','忌'] if row['化'+h+'星']==name),'')
                stars[palace].append({'name':name,'brightness':row[name+'星等'] or '', 'siHua':hua})
            inputs=[]
            for palace in meta['palaces']:
                e=assess_palace(stars[palace],stars[opposite[palace]],scoped.get(key,[]) if palace=='命宮' else ())
                buffers['命盤宮位判讀'].append((key,palace,e['quality'],'；'.join(e['good']),'；'.join(e['bad']),'；'.join(e['warnings']),int(e['borrowed']),int(e['solitary_sha']),e['reason']))
                inputs.append({'name':palace,'range':row[palace+'大限'],'quality':e['quality'],'reason':e['reason']})
            result=assess_timing(inputs)
            for period in result['periods']:
                buffers['命盤大限明細'].append((key,period['palace'],period['start'],period['end'],period['quality'],period['weight'],period['contribution'],period['prime_good'],period['prime_bad'],period['reason'],period['scope']))
            buffers['命盤時運'].append((key,result['good_palaces'],result['prime_good_years'],result['prime_bad_years'],result['weighted_good_years'],result['weighted_bad_years'],result['timing_score'],result['first_good_age'],int(result['late_only']),result['unassigned_years'],int(result['qualified']),'；'.join(result['reasons']),result['late_good_years'],result['late_bad_years']))
            count+=1;qualified+=int(result['qualified'])
        flush()
        last_key=row['KEY']
        if count%4096==0 or count==meta['rowCount']:
            print(f'Timing progress: {count}/{meta["rowCount"]}',flush=True)
    assert count==meta['rowCount']
    assert db.execute('SELECT COUNT(*),COUNT(DISTINCT "KEY") FROM "命盤時運"').fetchone()==(count,count)
    for name in ['命盤宮位判讀','命盤大限明細']:
        assert db.execute(f'SELECT COUNT(*) FROM {quote(name)}').fetchone()[0]==count*12
    meta['timing']={'version':MODEL_VERSION,'policy':asdict(DEFAULT_POLICY),'rows':count,'qualified':qualified,
                    'ageConvention':'沿用原始大限歲數；未轉為精確公曆周歲',
                    'scope':'本命宮位判讀乘以實際大限到達年齡；不冒充大限飛化或流年預測'}
    print(f'Timing evidence persisted: {count} charts, {qualified} qualify',flush=True)
    return meta['timing']
