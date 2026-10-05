/* Node unit tests for dead-pixel-test pure engine (PALETTE / colorAt). */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({ innerHTML:'', textContent:'', value:'', style:{}, appendChild(){}, addEventListener(){}, querySelector(){ return { textContent:'' }; }, classList:{toggle(){},add(){},remove(){}} });
global.document = { readyState:'loading', getElementById:()=>el(), createElement:()=>el(), addEventListener(){}, documentElement:{requestFullscreen(){return Promise.resolve();}}, body:{appendChild(){}} };
global.window = {};
Object.defineProperty(global.window,'document',{value:global.document});

const src = fs.readFileSync(path.resolve(__dirname,'../public/assets/js/dead-pixel-test.js'),'utf8');
const mod = { exports:{} };
new Function('module','exports','document','window',src)(mod, mod.exports, global.document, global.window);
const { PALETTE, colorAt } = mod.exports;

let pass=0, fail=0;
function assert(name, cond){ if(cond){pass++;console.log('  ok '+name);} else {fail++;console.log('  FAIL '+name);} }

assert('palette has 9 colors', PALETTE.length===9);
assert('color 0 = Rot/red', PALETTE[0].name==='Rot' && PALETTE[0].bg==='#ff0000');
assert('color 2 = Blau', PALETTE[2].name==='Blau' && PALETTE[2].bg==='#0000ff');
assert('color 4 = Schwarz', PALETTE[4].name==='Schwarz' && PALETTE[4].bg==='#000000');
assert('colorAt wraps (index 9 -> 0)', colorAt(9)===PALETTE[0]);
assert('colorAt(1) = Grün', colorAt(1)===PALETTE[1]);

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
