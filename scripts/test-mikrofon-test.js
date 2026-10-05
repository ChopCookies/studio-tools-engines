/* Node unit tests for mikrofon-test pure engine (levelFromTimeDomain). */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({ innerHTML:'', textContent:'', value:'', style:{}, appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; } });
global.document = { readyState:'loading', getElementById:()=>el(), createElement:()=>el(), addEventListener(){}, body:{appendChild(){}} };
global.window = {};
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};

const src = fs.readFileSync(path.resolve(__dirname,'../public/assets/js/mikrofon-test.js'),'utf8');
const mod = { exports:{} };
new Function('module','exports','document','window',src)(mod, mod.exports, global.document, global.window);
const { levelFromTimeDomain } = mod.exports;

let pass=0, fail=0;
function assert(name, cond){ if(cond){pass++;console.log('  ok '+name);} else {fail++;console.log('  FAIL '+name);} }

// Silence in Uint8Array (analyser default) = value 128 every sample.
{
  const silence = new Uint8Array(512).fill(128);
  const lvl = levelFromTimeDomain(silence);
  assert('silence rms near 0', lvl.rms < 0.01);
  assert('silence peak near 0', lvl.peak < 0.01);
}
// Loud signal: Uint8Array alternating near 0 and 255 (offset 128 => +/-127).
{
  const loud = new Uint8Array(512);
  for (let i=0;i<512;i++) loud[i] = i%2 ? 255 : 0;
  const lvl = levelFromTimeDomain(loud);
  assert('loud rms > 0.5', lvl.rms > 0.5);
  assert('loud peak ~1', lvl.peak > 0.9);
}
// 404 noise (very quiet): Uint8Array ~ value 129-130
{
  const quiet = new Uint8Array(512).fill(130);
  const lvl = levelFromTimeDomain(quiet);
  assert('quiet rms < loud rms', lvl.rms < 0.2);
}
// Float32Array handling (values -1..1)
{
  const f = new Float32Array(512).fill(0.5);
  const lvl = levelFromTimeDomain(f);
  assert('float 0.5 => rms 0.5, scale 1.0', Math.abs(lvl.rms-0.5)<0.02);
  assert('empty array => 0 (number)', levelFromTimeDomain([]) === 0);
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
