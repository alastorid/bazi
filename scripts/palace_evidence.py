"""Conservative, traceable palace labels for timing, not a star-sum percentile.

Uses only already-stored explained stars, dignity and natal transformations.
These labels are model classifications, not claims about real-life outcomes.
Unknown dignity is never invented. 地空 has no universal contribution.
"""
MAJOR=set('紫微 天機 太陽 武曲 天同 廉貞 天府 太陰 天梁 天相 七殺 破軍 貪狼 巨門'.split())
HELPERS=set('左輔 右弼 天魁 天鉞 文昌 文曲 祿存'.split())
SHA=set('擎羊 陀羅 火星 鈴星 天空 地劫'.split())
MIXED_OR_MARTIAL=set('廉貞 貪狼 巨門 七殺 破軍'.split())
BRIGHT={'廟','旺'}
FALLEN={'陷','不'}

def assess_palace(stars, opposite_stars=(), positive_patterns=()):
    """stars: dictionaries with name/brightness/siHua.

    positive_patterns must be explicitly mapped to THIS palace by caller;
    an arbitrary chart-wide formation must never be copied into twelve palaces.
    Opposite-palace stars are used only for explicit 化忌沖 and 空宮借照.
    """
    names={s['name'] for s in stars}
    majors=[s for s in stars if s['name'] in MAJOR]
    good=[];bad=[];warnings=[]
    supported=bool(names&HELPERS)
    bright_major=[s for s in majors if s.get('brightness') in BRIGHT and
                  (s['name'] not in {'七殺','破軍'} or supported)]
    if bright_major:
        good.append('廟旺主星：'+'、'.join(s['name'] for s in bright_major))
    if supported:
        good.append('六吉／祿存實際同宮：'+'、'.join(sorted(names&HELPERS)))
    good_hua=[s for s in stars if s.get('siHua') in ('祿','權','科')]
    if good_hua:
        good.append('本命四化：'+'、'.join(s['name']+'化'+s['siHua'] for s in good_hua))
    if positive_patterns:
        good.append('明確定位本宮的成格：'+'、'.join(positive_patterns))
    for s in stars:
        name=s['name'];light=s.get('brightness','')
        if s.get('siHua')=='忌':bad.append(name+'化忌在本宮')
        if name in SHA:
            # High dignity is not a positive sign; retain a warning even if milder.
            (warnings if light in BRIGHT else bad).append(name+('廟旺，仍保留煞曜風險' if light in BRIGHT else '同宮'+('（'+light+'）' if light else '（未定義亮度）')))
        if name in MIXED_OR_MARTIAL and light in FALLEN:
            bad.append(name+light+'，保留弱勢／風險')
    if any(s.get('siHua')=='忌' for s in opposite_stars):bad.append('對宮本命化忌沖照')
    borrowed=False
    if not majors and any(s['name'] in MAJOR and s.get('brightness') in BRIGHT and s['name'] not in {'七殺','破軍'} for s in opposite_stars):
        borrowed=True;good.append('空宮借對宮廟旺主星照；不當成本宮成格')
    solitary=len(names&SHA)==1 and not majors and not supported and not good_hua
    if solitary:bad.append('殺星獨守本宮，無主星、六吉／祿存或祿權科化解；須按實際大限年齡看')
    # A lone bright major or one helper does not make a robust favorable palace.
    anchored=bool(bright_major or good_hua or positive_patterns or borrowed)
    has_good=bool(positive_patterns) or (anchored and len(good)>=2)
    quality='吉凶並見' if has_good and bad else '吉' if has_good else '凶' if bad else '平'
    return {'quality':quality,'good':good,'bad':bad,'warnings':warnings,
            'borrowed':borrowed,'solitary_sha':solitary,
            'reason':'；'.join(good+bad+warnings) or '未達可明確判吉或判凶的模型條件'}
