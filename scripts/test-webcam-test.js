/* Node load smoke test for webcam-test (no pure engine; verify IIFE + buildUI don't throw). */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({ innerHTML:'', textContent:'', value:'', className:'', style:{}, appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; }, pause(){}, classList:{toggle(){},add(){},remove(){}} });
global.document = { readyState:'loading', getElementById:()=>el(), createElement:()=>el(), addEventListener(){}, body:{appendChild(){}} };
global.window = {};

let threw=false;
try {
  const src = fs.readFileSync(path.resolve(__dirname,'../public/assets/js/webcam-test.js'),'utf8');
  new Function('document','window',src)(global.document, global.window);
} catch(e){ threw=true; console.log('  THREW: '+e.message); }

if(!threw){ console.log('  ok webcam-test loads + buildUI without exception'); process.exit(0); }
else { console.log('  FAIL webcam-test threw on load'); process.exit(1); }
