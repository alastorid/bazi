"""Counterfactual timing tests: same palace quality, different age placement."""
from life_timing import assess_timing, parse_range

def chart(good, bad=(), mixed=()):
    return [{'name':f'宮{i}','range':f'{2+i*10}-{11+i*10}',
             'quality':'吉' if i in good else '凶' if i in bad else '吉凶並見' if i in mixed else '平',
             'reason':'人工反事實測試，非教材命例'} for i in range(12)]

early=assess_timing(chart([2,3,4]))
late=assess_timing(chart([6,7,8]))
assert early['good_palaces']==late['good_palaces']==3
assert early['qualified'] and early['prime_good_years']==28
assert early['timing_score']>late['timing_score']
assert late['timing_score']==0 and late['late_only'] and not late['qualified']
assert late['first_good_age']==62
assert assess_timing(chart([8]))['first_good_age']==82
assert late['late_good_years']==18  # Presentation horizon ends at 79.
assert assess_timing(chart([]))['qualified'] is False
assert assess_timing(chart([2,3]))['qualified'] is False
assert assess_timing(chart([6,7,8],bad=[2,3,4]))['timing_score']<0
mixed=assess_timing(chart([3,4,5],mixed=[2]))
assert mixed['prime_bad_years']==10 and mixed['good_palaces']==3
# An interval straddling 60 is split by actual age, not wholly credited or dropped.
boundary=assess_timing(chart([5]))
assert boundary['weighted_good_years']==4 # Ages 52–59 at half weight, 60–61 at zero.
assert boundary['late_good_years']==2
# Sex/sequence differences are represented only by different source ranges.
male=chart([2,3,4]);female=[dict(p,range=male[11-i]['range']) for i,p in enumerate(male)]
assert assess_timing(male)['timing_score']>assess_timing(female)['timing_score']
for value in ['', '2-12', '0-9', '十至十九']:
    try:parse_range(value)
    except ValueError:pass
    else:raise AssertionError(value)
overlap=chart([2,3,4]);overlap[1]['range']=overlap[0]['range']
try:assess_timing(overlap)
except ValueError:pass
else:raise AssertionError('overlapping ranges accepted')
print('Timing policy verified: early/late counterfactual, sex sequence, 60 boundary, mixed risk, missing ages, strict range validation.')
