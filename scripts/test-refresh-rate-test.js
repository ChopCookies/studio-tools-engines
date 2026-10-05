/* Node unit tests for refresh-rate-test pure engine (computeFps). */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({ innerHTML:'', textContent:'', value:'', style:{}, appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; } });
global.document = { readyState:'complete', getElementById:()=>el(), createElement:()=>el(), addEventListener(){}, body:{appendChild(){}} };
global.window = {};
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};

const src = fs.readFileSync(path.resolve(__dirname,'../public/assets/js/refresh-rate-test.js'),'utf8');
const mod = { exports:{} };
new Function('module','exports','document','window',src)(mod, mod.exports, global.document, global.window);
const { computeFps } = mod.exports;

let pass=0, fail=0;
function assert(name, cond){ if(cond){pass++;console.log('  ok '+name);} else {fail++;console.log('  FAIL '+name);} }

// 2 frames, 1000ms apart => 60ish? No: 1000ms interval => 1 fps. Build 60fps-like: intervals of ~16ms.
{
  const ts=[];
  for(let i=0;i<61;i++) ts.push(i*16.666);
  const r=computeFps(ts);
  assert('61 frames @16.66ms => ~60 fps avg', Math.abs(r.avg-60)<1.5);
  assert('frames count = 61', r.frames===61);
  assert('min higher than 55 (no jitter)', r.min>50);
}
// <2 frames => zeros
{
  const r=computeFps([100]);
  assert('single frame => avg 0', r.avg===0);
  assert('empty => all 0', computeFps(null).avg===0);
}
// outlier jitter affects min
{
  const r=computeFps([0,16,32,48,250]);
  assert('min reflects slowest interval (1000/202 ~ 4.9)', r.min<6);
  assert('max reflects fastest (1000/16 ~ 62)', r.max>55);
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
