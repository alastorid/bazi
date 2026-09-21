from palace_evidence import assess_palace

def star(name,light='',hua=''):
    return dict(name=name,brightness=light,siHua=hua)

good=[star('太陰','廟'),star('左輔')]
assert assess_palace(good)['quality']=='吉'
assert assess_palace([star('太陰','廟')])['quality']=='平'
assert assess_palace([star('太陰','陷'),star('左輔')])['quality']=='平'
assert assess_palace(good+[star('天機','旺','忌')])['quality']=='吉凶並見'
assert assess_palace(good,[star('巨門','陷','忌')])['quality']=='吉凶並見'
assert assess_palace([star('火星','廟')])['quality']=='凶' # Solitary sha, not high dignity = good.
assert assess_palace([star('地空','陷')])['quality']=='平' # No invented universal meaning.
assert assess_palace([star('七殺','廟')])['quality']=='平'
assert assess_palace([star('七殺','廟')],positive_patterns=['七殺朝斗'])['quality']=='吉'
assert assess_palace([star('七殺','廟'),star('左輔')])['quality']=='吉'
assert assess_palace([star('左輔')],[star('太陰','廟')])['borrowed']
assert assess_palace([star('左輔')],[star('太陰','廟')])['quality']=='吉'
assert assess_palace([star('太陰','廟','祿'),star('地劫')])['quality']=='吉凶並見'
print('Palace evidence verified: multiple independent supports, dignity, 化忌 coexistence/opposition, empty-palace provenance, scoped 地空 and solitary sha.')
