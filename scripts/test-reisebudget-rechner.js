/* Node unit tests for reisebudget-rechner pure computeBudget engine (DOM + window stubbed). */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({ innerHTML: '', value: '', appendChild(){}, addEventListener(){},
  querySelector(){ return { addEventListener(){} }; } });
global.document = { readyState: 'complete', getElementById: () => el(), createElement: () => el(), addEventListener(){} };
global.window = {};

const toolSrc = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/reisebudget-rechner.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', toolSrc)(mod, mod.exports, global.document, global.window);
const { computeBudget } = mod.exports;

let pass = 0, fail = 0;
function assert(name, cond) { if (cond) { pass++; console.log('  ok ' + name); } else { fail++; console.log('  FAIL ' + name); } }

// 2 Personen, 5 Nächte, Hotel 100, Essen 28, Transport 200, Lokal 8, Act 50
{
  const r = computeBudget({ persons: 2, nights: 5, hotel: 100, food: 28, transport: 200, local: 8, act: 50 });
  assert('kein Fehler', r.error === null);
  assert('2 Personen = 1 Zimmer', r.roomNights === 1);
  assert('6 Verpflegungstage (5+1)', r.days === 6);
  // hotel: 100*1*5 = 500 ; food: 28*2*6=336 ; local: 8*2*6=96 ; +200+50
  assert('Hotel = 500', r.hotelCost === 500);
  assert('Essen = 336', r.foodCost === 336);
  assert('Stadtverkehr = 96', r.localCost === 96);
  assert('Gesamt = 1182', r.total === 500 + 336 + 96 + 200 + 50); // 1182
  assert('Pro Person = 591', r.perPerson === 591);
  assert('Pro Nacht = 236.4', Math.abs(r.perNight - 236.4) < 1e-9);
  assert('Pro Pers/Nacht = 118.2', Math.abs(r.perPersonPerNight - 118.2) < 1e-9);
}

// 3 Personen (ungerade) -> 2 Zimmer
{
  const r = computeBudget({ persons: 3, nights: 2, hotel: 80, food: 25, transport: 0, local: 5, act: 0 });
  assert('ungerade 3 Pers = 2 Zimmer', r.roomNights === 2);
  assert('Hotel = 320', r.hotelCost === 80 * 2 * 2);
}

// Validierung
{
  assert('Personen=0 -> Fehler persons', computeBudget({ persons: 0, nights: 3 }).error === 'persons');
  assert('Personen negativ -> Fehler persons', computeBudget({ persons: -2, nights: 3 }).error === 'persons');
  assert('Nächte=0 -> Fehler nights', computeBudget({ persons: 2, nights: 0 }).error === 'nights');
  assert('Nächte negativ -> Fehler nights', computeBudget({ persons: 2, nights: -1 }).error === 'nights');
}

// Dezimal-Eingaben in computeBudget (Personenzahl ganzzahlig in der Engine)
{
  const r = computeBudget({ persons: 2, nights: 7, hotel: 92.5, food: 30, transport: 150, local: 6, act: 20 });
  assert('Hotel Dezimal', Math.abs(r.hotelCost - 92.5 * 1 * 7) < 1e-9);
  assert('Kein Fehler', r.error === null);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
