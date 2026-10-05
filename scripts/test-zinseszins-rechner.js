/* Node unit tests for zinseszins-rechner pure engine (DOM stubbed). */
'use strict';
const fs = require('fs');
const path = require('path');

// Minimal DOM stub so require() doesn't throw on buildUI()
const el = () => ({ innerHTML: '', value: '', style: {}, disabled: false,
  appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; } });
global.document = {
  readyState: 'complete',
  getElementById: () => el(),
  createElement: () => el(),
  addEventListener() {},
};
global.window = { __siteLang: 'de' };

const src = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/zinseszins-rechner.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', src)(mod, mod.exports, global.document, global.window);
const { compute, fmtEuro } = mod.exports;

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

// (a) 1000 @5% over 10 years no deposits => ~1628.89
{
  const r = compute({ startKapital: 1000, zinssatz: 5, laufzeitJahre: 10, einzahlungJaehrlich: 0, sparrhythmus: 'keine' });
  assert('1000 @5% 10yr endKapital ~1628.89', Math.abs(r.endKapital - 1628.89) < 1.0);
  assert('zinsertrag = endKapital - eingezahlt', Math.abs(r.zinsertrag - (r.endKapital - 1000)) < 0.01);
}

// (b) deposits jaehrlich 100 @0% over 5 years startKapital 0 => endKapital 500
{
  const r = compute({ startKapital: 0, zinssatz: 0, laufzeitJahre: 5, einzahlungJaehrlich: 100, sparrhythmus: 'jaehrlich' });
  assert('5 x 100 @0% endKapital = 500', r.endKapital === 500);
  assert('eingezahlt = 500', r.eingezahlt === 500);
}

// (c) zinsertrag = endKapital - eingezahlt
{
  const r = compute({ startKapital: 1000, zinssatz: 5, laufzeitJahre: 10, einzahlungJaehrlich: 0, sparrhythmus: 'keine' });
  assert('zinsertrag = endKapital - eingezahlt', Math.abs(r.zinsertrag - (r.endKapital - r.eingezahlt)) < 0.001);
}

// (d) fmtEuro(1234.5) contains '1.234,50'
{
  const s = fmtEuro(1234.5);
  assert('fmtEuro contains 1.234,50', s.includes('1.234,50'));
}

// REGRESSION: sparrhythmus='keine' must IGNORE a non-zero deposit field.
// Previously the annual branch added `deposit` whenever it was non-zero, so a
// user who picked "keine" but left a value in the deposit field got deposits
// counted anyway. 'keine' with deposit 500 over 5y @0% must stay at startKapital.
{
  const r = compute({ startKapital: 1000, zinssatz: 0, laufzeitJahre: 5, einzahlungJaehrlich: 500, sparrhythmus: 'keine' });
  assert("keine ignores deposit: endKapital stays 1000", r.endKapital === 1000);
  assert("keine ignores deposit: eingezahlt stays 1000", r.eingezahlt === 1000);
  assert("keine ignores deposit: zinsertrag = 0", r.zinsertrag === 0);
}

// REGRESSION: monthly rhythm with deposits
// 1000 @12% over 1 year, monthly deposits 1200/yr (100/mo) => compounded monthly.
// Verify data length and that monthly compounding exceeds annual at same rate.
{
  const mono = compute({ startKapital: 1000, zinssatz: 12, laufzeitJahre: 1, einzahlungJaehrlich: 1200, sparrhythmus: 'monatlich' });
  const annual = compute({ startKapital: 1000, zinssatz: 12, laufzeitJahre: 1, einzahlungJaehrlich: 1200, sparrhythmus: 'jaehrlich' });
  assert('monthly has 1 data row', mono.data.length === 1);
  assert('monthly endKapital > annual endKapital (more frequent compounding)', mono.endKapital > annual.endKapital);
  assert('monthly eingezahlt = 2200 (1000 + 1200)', Math.abs(mono.eingezahlt - 2200) < 0.001);
}

// data array has correct number of entries
{
  const r = compute({ startKapital: 1000, zinssatz: 5, laufzeitJahre: 10, einzahlungJaehrlich: 0, sparrhythmus: 'keine' });
  assert('data has 10 entries', r.data.length === 10);
  assert('data first entry jahr=1', r.data[0].jahr === 1);
  assert('data last entry jahr=10', r.data[9].jahr === 10);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
