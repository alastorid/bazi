"""Versioned timing policy. Pure functions; yearly production builds run on Actions.

This module makes no new astrological formation claims. Palace judgements are
explicit inputs, and timing answers WHEN an already assessed palace is reached.
Age weights/qualification thresholds are product policy, not textbook quotations.
"""
from dataclasses import dataclass
import re

MODEL_VERSION = 'timing-v1'

@dataclass(frozen=True)
class TimingPolicy:
    childhood_end: int = 19
    prime_end: int = 49
    working_end: int = 59
    display_end: int = 79
    childhood_weight: float = .5
    prime_weight: float = 1.0
    later_work_weight: float = .5
    retirement_weight: float = 0.0
    minimum_good_palaces: int = 3
    minimum_prime_good_years: int = 10
    maximum_prime_bad_years: int = 10

DEFAULT_POLICY = TimingPolicy()

def age_weight(age, policy=DEFAULT_POLICY):
    if age < 1:
        raise ValueError('年齡須為沿用原始大限的正整數')
    if age <= policy.childhood_end:
        return policy.childhood_weight
    if age <= policy.prime_end:
        return policy.prime_weight
    if age <= policy.working_end:
        return policy.later_work_weight
    return policy.retirement_weight

def parse_range(value):
    match = re.fullmatch(r'(\d+)-(\d+)', str(value))
    if not match:
        raise ValueError(f'缺失或無效的大限年齡：{value!r}')
    start, end = map(int, match.groups())
    if start < 1 or end - start != 9:
        raise ValueError(f'大限必須連續十年：{value!r}')
    return start, end

def assess_timing(palaces, policy=DEFAULT_POLICY):
    """Each input: name, range, quality ('吉'/'凶'/'平'/'吉凶並見'), reason.

    All 12 source ranges must be present, contiguous and disjoint. No guessing
    forward/reverse direction or assuming identical male/female schedules.
    The interval before the first actual 大限 remains unknown, never favorable.
    A mixed palace contributes both opportunity and risk, never a clean 吉限.
    """
    if len(palaces) != 12 or len({p['name'] for p in palaces}) != 12:
        raise ValueError('須有十二個不重複的本命宮位')
    ranges = sorted(((*parse_range(p['range']), p) for p in palaces), key=lambda r:r[0])
    if any(b[0] != a[1]+1 for a,b in zip(ranges,ranges[1:])):
        raise ValueError('大限年齡重疊或不連續')
    if ranges[0][0] not in range(2,7):
        raise ValueError('起限歲數應為原始五行局數二至六')
    periods=[]
    good_ages=[]
    bad_ages=[]
    mixed_ages=[]
    prime_good=prime_bad=0
    weighted_good=weighted_bad=0.0
    for start,end,p in ranges:
        quality=p['quality']
        if quality not in ('吉','凶','平','吉凶並見'):
            raise ValueError(f'未定義的宮位判讀：{quality}')
        years=list(range(start,min(end,policy.display_end)+1))
        weight=sum(age_weight(age,policy) for age in years)
        is_good=quality=='吉'
        is_bad=quality in ('凶','吉凶並見')
        good_ages.extend(years if is_good else [])
        bad_ages.extend(years if is_bad else [])
        mixed_ages.extend(years if quality=='吉凶並見' else [])
        pg=sum(policy.childhood_end<age<=policy.prime_end for age in years) if is_good else 0
        pb=sum(policy.childhood_end<age<=policy.prime_end for age in years) if is_bad else 0
        prime_good+=pg;prime_bad+=pb
        contribution=weight*(int(is_good)-int(is_bad))
        weighted_good+=weight if is_good else 0
        weighted_bad+=weight if is_bad else 0
        periods.append({'palace':p['name'],'start':start,'end':end,'quality':quality,
                        'weight':weight,'contribution':contribution,'prime_good':pg,
                        'prime_bad':pb,'reason':p.get('reason',''),
                        'scope':'晚年另列，不補成年得時分' if start>policy.working_end else '依逐歲交集計入，非整段套年齡權重'})
    good_palaces=sum(p['quality']=='吉' for p in palaces)
    reasons=[]
    if good_palaces<policy.minimum_good_palaces:reasons.append('可核對的吉宮不足')
    if prime_good<policy.minimum_prime_good_years:reasons.append('二十至四十九歲吉限不足十年')
    if prime_bad>policy.maximum_prime_bad_years:reasons.append('二十至四十九歲凶或吉凶並見限超過十年')
    if weighted_good<=weighted_bad:reasons.append('六十歲前加權吉限未多於風險限')
    first_good=min((start for start,end,p in ranges if p['quality']=='吉'),default=None)
    # Fixed denominator: missing pre-cycle years cannot improve a chart's mean.
    denominator=sum(age_weight(age,policy) for age in range(1,policy.working_end+1))
    return {'periods':periods,'good_palaces':good_palaces,'prime_good_years':prime_good,
            'prime_bad_years':prime_bad,'weighted_good_years':weighted_good,
            'weighted_bad_years':weighted_bad,'timing_score':round(100*(weighted_good-weighted_bad)/denominator,6),
            'first_good_age':first_good,'late_only':first_good is not None and first_good>policy.working_end,
            'unassigned_years':ranges[0][0]-1,'qualified':not reasons,'reasons':reasons,
            'late_good_years':sum(age>policy.working_end for age in good_ages),
            'late_bad_years':sum(age>policy.working_end for age in bad_ages)}
