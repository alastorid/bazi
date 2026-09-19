import fs from 'node:fs';
const range=process.env.DATA_YEAR??'2026-2035';
if(!/^\d{4}(?:-\d{4})?$/.test(range))throw new Error('Invalid year range');
const [start,end=start]=range.split('-').map(Number);
if(start<1900||end>2200||end<start||end-start>40)throw new Error('Range must be 1–41 years');
const years=Array.from({length:end-start+1},(_,i)=>start+i);
fs.appendFileSync(process.env.GITHUB_OUTPUT,'years='+JSON.stringify(years)+'\n');
