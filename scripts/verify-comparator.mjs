import assert from 'node:assert/strict';
import {compareCharts,starStrength,chartProfile,assignRanks,mergeSortResults} from '../src/bazi-comparator.mjs';
import {generateChart} from '../src/ziwei-algorithm.mjs';
assert.equal(starStrength({name:'天姚',brightness:'廟'}),0);
assert.equal(starStrength({name:'地空',brightness:'陷'}),0);
assert.equal(starStrength({name:'火星',brightness:'廟'}),0);
assert.ok(starStrength({name:'太陰',brightness:'廟'})>starStrength({name:'太陰',brightness:'陷'}));
const charts=[1,4,7,10].map(month=>generateChart({year:2027,month,day:15,hour:4,gender:'female'}));
for(const a of charts)for(const b of charts){
  const ab=compareCharts(a,b),ba=compareCharts(b,a);
  assert.ok(Math.abs(ab.weightedScore+ba.weightedScore)<1e-8);
  assert.equal(compareCharts(a,a).weightedScore,0);
  const total=c=>chartProfile(c).reduce((n,p)=>n+p.weighted,0);
  assert.ok(Math.abs(ab.weightedScore-(total(a)-total(b)))<1e-8);
  for(const ref of charts)assert.ok(Math.abs(compareCharts(a,ref).weightedScore-compareCharts(b,ref).weightedScore-ab.weightedScore)<1e-8);
}
const ties=assignRanks(mergeSortResults([{key:'a',weightedScore:3},{key:'b',weightedScore:3},{key:'c',weightedScore:-1}]));
assert.deepEqual(ties.map(r=>r.rankIndex),[1,1,3]);
assert.deepEqual(ties.map(r=>r.rankPercentile),[100,100,0]);
assert.equal(assignRanks([{weightedScore:0}])[0].prRatio,1);
console.log('Comparator verified: whitelist, scoped evidence, dignity, antisymmetry, exact transitivity, reference invariance, ties and PR direction.');
