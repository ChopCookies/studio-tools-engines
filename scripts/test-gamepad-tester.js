/* Node unit tests for gamepad-tester pure engine (gamepadState). */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({ innerHTML:'', textContent:'', value:'', style:{}, appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; }, classList:{toggle(){},add(){},remove(){}} });
global.document = { readyState:'loading', getElementById:()=>el(), createElement:()=>el(), addEventListener(){}, body:{appendChild(){}} };
global.window = {};
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};

const src = fs.readFileSync(path.resolve(__dirname,'../public/assets/js/gamepad-tester.js'),'utf8');
const mod = { exports:{} };
new Function('module','exports','document','window',src)(mod, mod.exports, global.document, global.window);
const { gamepadState, STD_BUTTONS } = mod.exports;

let pass=0, fail=0;
function assert(name, cond){ if(cond){pass++;console.log('  ok '+name);} else {fail++;console.log('  FAIL '+name);} }

// Standard 17-button gamepad.
{
  const gp = {
    id:'Xbox Controller', index:0, mapping:'standard',
    buttons:Array.from({length:17},(_,i)=>({pressed:i===2, value: i===2?1:0})),
    axes:[0,0,0.5,0]
  };
  const st = gamepadState(gp);
  assert('id carried', st.id==='Xbox Controller');
  assert('mapping carried', st.mapping==='standard');
  assert('17 buttons', st.buttons.length===17);
  assert('button 2 (X) pressed', st.buttons[2].pressed===true);
  assert('button 0 not pressed', st.buttons[0].pressed===false);
  assert('axes copied', st.axes.length===4 && st.axes[2]===0.5);
}
// null gamepad => null
{
  assert('null gp => null', gamepadState(null)===null);
}
// edge: button value threshold 0.5
{
  const st = gamepadState({ id:'x', index:1, mapping:'', buttons:[{pressed:false, value:0.4}], axes:[] });
  assert('value 0.4 => not pressed', st.buttons[0].pressed===false);
}
// STD_BUTTONS sanity
{
  assert('STD_BUTTONS[0]===A', STD_BUTTONS[0]==='A');
  assert('STD_BUTTONS[4]===LB', STD_BUTTONS[4]==='LB');
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
