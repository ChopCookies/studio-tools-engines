/* Node unit tests for pendlerpauschale-rechner pure engine (DOM stubbed). */
'use strict';
const fs = require('fs');
const path = require('path');

// Minimal DOM stub so require() doesn't throw on buildUI()
const el = () => ({ innerHTML: '', value: '', appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; } });
global.document = {
  readyState: 'complete',
  getElementById: () => el(),
  createElement: () => el(),
  addEventListener() {},
};
global.window = {};

const src = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/pendlerpauschale-rechner.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', src)(mod, mod.exports, global.document, global.window);
const { compute, fmtEuro } = mod.exports;

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

// (a) year 2026: flat 0.38 from first km => 230 * 30 * 0.38 = 2622.0
{
  const r = compute({ km: 30, daysPerYear: 230, year: 2026 });
  assert('2026 km30 days230 annual = 2622.0', Math.abs(r.annual - 2622.0) < 0.01);
  assert('2026 monthly = annual/12', Math.abs(r.monthly - r.annual / 12) < 0.01);
}

// (b) year 2025: split 0.30/0.38 => 230*(20*0.30 + 10*0.38) = 230*9.8 = 2254.0
{
  const r = compute({ km: 30, daysPerYear: 230, year: 2025 });
  assert('2025 km30 days230 annual = 2254.0', Math.abs(r.annual - 2254.0) < 0.01);
  assert('2025 monthly = annual/12', Math.abs(r.monthly - r.annual / 12) < 0.01);
}

// (b2) year 2021: split 0.30/0.35 => 230*(20*0.30 + 10*0.35) = 230*9.5 = 2185.0
{
  const r = compute({ km: 30, daysPerYear: 230, year: 2021 });
  assert('2021 km30 days230 annual = 2185.0', Math.abs(r.annual - 2185.0) < 0.01);
  assert('2021 monthly = annual/12', Math.abs(r.monthly - r.annual / 12) < 0.01);
}

// (b3) year 2020: flat 0.30 all km => 230*30*0.30 = 2070.0
{
  const r = compute({ km: 30, daysPerYear: 230, year: 2020 });
  assert('2020 km30 days230 annual = 2070.0', Math.abs(r.annual - 2070.0) < 0.01);
  assert('2020 monthly = annual/12', Math.abs(r.monthly - r.annual / 12) < 0.01);
}

// (c) year 2025, km <= 20 => only 0.30 applies => 230*10*0.30 = 690.0
{
  const r = compute({ km: 10, daysPerYear: 230, year: 2025 });
  assert('2025 km10 days230 annual = 690.0', Math.abs(r.annual - 690.0) < 0.01);
  assert('2025 km10 monthly = annual/12', Math.abs(r.monthly - r.annual / 12) < 0.01);
}

// (f) Höchstgrenze: long ÖPNV commute capped at 4500, car not capped
{
  const car = compute({ km: 120, daysPerYear: 230, year: 2026, vehicle: 'car' });
  // 230*120*0.38 = 10488 (no cap, own car)
  assert('2026 car km120 days230 not capped = 10488.0', Math.abs(car.annual - 10488.0) < 0.01);
  assert('car capped flag = false', car.capped === false);

  const oev = compute({ km: 120, daysPerYear: 230, year: 2026, vehicle: 'oev' });
  assert('2026 oev km120 days230 capped at 4500', Math.abs(oev.annual - 4500.0) < 0.01);
  assert('oev capped flag = true', oev.capped === true);
  assert('oev capNote present', typeof oev.capNote === 'string' && oev.capNote.length > 0);
  assert('oev monthly = 375.0', Math.abs(oev.monthly - 375.0) < 0.01);
}

// (g) short ÖPNV commute below cap is NOT capped
{
  const r = compute({ km: 20, daysPerYear: 230, year: 2026, vehicle: 'oev' });
  // 230*20*0.38 = 1748 < 4500, unchanged
  assert('2026 oev km20 days230 annual = 1748.0 (no cap)', Math.abs(r.annual - 1748.0) < 0.01);
  assert('oev km20 capped flag = false', r.capped === false);
}

// (d) rateNote present for both rate regimes
{
  const r26 = compute({ km: 30, daysPerYear: 230, year: 2026 });
  const r25 = compute({ km: 30, daysPerYear: 230, year: 2025 });
  const r21 = compute({ km: 30, daysPerYear: 230, year: 2021 });
  const r20 = compute({ km: 30, daysPerYear: 230, year: 2020 });
  assert('2026 rateNote mentions 0,38', typeof r26.rateNote === 'string' && r26.rateNote.length > 0);
  assert('2025 rateNote mentions 0,30/0,38 split', typeof r25.rateNote === 'string' && r25.rateNote.length > 0);
  assert('2021 rateNote mentions 0,35', r21.rateNote.indexOf('0,35') !== -1);
  assert('2020 rateNote mentions flat 0,30', r20.rateNote.indexOf('0,30') !== -1);
}

// (e) fmtEuro formats in de-DE
{
  const s = fmtEuro(2622.0);
  assert('fmtEuro contains 2.622,00', s.includes('2.622,00'));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
