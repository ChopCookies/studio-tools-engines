/* Node unit tests for skonto-rechner pure engine (DOM stubbed). */
'use strict';
const fs = require('fs');
const path = require('path');

// Minimal DOM stub so require() doesn't throw on buildUI()
const el = () => ({ innerHTML: '', value: '', appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; }, querySelectorAll(){ return []; } });
global.document = {
  readyState: 'complete',
  getElementById: () => el(),
  createElement: () => el(),
  addEventListener() {},
};
global.window = {};

const src = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/skonto-rechner.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', src)(mod, mod.exports, global.document, global.window);
const { compute, fmtEuro } = mod.exports;

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

// (a) 1000 @2% / 14 / 30 days  => skonto 20, zahlbetrag 980, 16 days saved, ~45.918% p.a.
{
  const r = compute({ brutto: 1000, skontoProzent: 2, skontofristTage: 14, zahlzielTage: 30 });
  assert('skontoBetrag = 20', Math.abs(r.skontoBetrag - 20) < 0.001);
  assert('zahlbetragSkonto = 980', Math.abs(r.zahlbetragSkonto - 980) < 0.001);
  assert('tageErspart = 16', r.tageErspart === 16);
  assert('effektiverJahreszins ~ 45.918', Math.abs(r.effektiverJahreszins - 45.918) < 0.5);
}

// (b) days saved <= 0  => effektiverJahreszins null
{
  const r = compute({ brutto: 1000, skontoProzent: 2, skontofristTage: 30, zahlzielTage: 30 });
  assert('tageErspart = 0 (clamped)', r.tageErspart === 0);
  assert('effektiverJahreszins === null', r.effektiverJahreszins === null);
}

// (c) 500 @3% / 10 / 30 days  => skonto 15, zahlbetrag 485
{
  const r = compute({ brutto: 500, skontoProzent: 3, skontofristTage: 10, zahlzielTage: 30 });
  assert('skontoBetrag = 15', Math.abs(r.skontoBetrag - 15) < 0.001);
  assert('zahlbetragSkonto = 485', Math.abs(r.zahlbetragSkonto - 485) < 0.001);
}

// (d) fmtEuro(1234.5) contains '1.234,50'
{
  const s = fmtEuro(1234.5);
  assert('fmtEuro contains 1.234,50', s.includes('1.234,50'));
}

// (e) days saved clamped to non-negative even when frist exceeds target
{
  const r = compute({ brutto: 1000, skontoProzent: 2, skontofristTage: 40, zahlzielTage: 30 });
  assert('tageErspart clamped to 0', r.tageErspart === 0);
  assert('effektiverJahreszins null when no savings window', r.effektiverJahreszins === null);
}

// (f) alternativZins comparison: 8% refi -> Skonto (45.9%) clearly worth it
{
  const r = compute({ brutto: 1000, skontoProzent: 2, skontofristTage: 14, zahlzielTage: 30, alternativZins: 8 });
  assert('lohntSich true at 8% refi', r.lohntSich === true);
  assert('zinsdifferenz = 45.9 - 8 > 0', r.zinsdifferenz > 37);
  assert('alternativZins echoed', r.alternativZins === 8);
}

// (g) alternativZins above effektivzins -> not worth it
{
  const r = compute({ brutto: 1000, skontoProzent: 2, skontofristTage: 14, zahlzielTage: 30, alternativZins: 50 });
  assert('lohntSich false at 50% refi', r.lohntSich === false);
  assert('zinsdifferenz < 0', r.zinsdifferenz < 0);
}

// (h) alternativZins 0 / absent -> no verdict (null), no crash
{
  const r0 = compute({ brutto: 1000, skontoProzent: 2, skontofristTage: 14, zahlzielTage: 30, alternativZins: 0 });
  assert('lohntSich null when refi 0', r0.lohntSich === null);
  assert('zinsdifferenz null when refi 0', r0.zinsdifferenz === null);
  const rN = compute({ brutto: 1000, skontoProzent: 2, skontofristTage: 14, zahlzielTage: 30 });
  assert('lohntSich null when refi absent', rN.lohntSich === null);
}

// (i) no savings window + refi -> still null verdict, no crash
{
  const r = compute({ brutto: 1000, skontoProzent: 2, skontofristTage: 30, zahlzielTage: 30, alternativZins: 8 });
  assert('lohntSich null when no effektivzins even with refi', r.lohntSich === null);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
