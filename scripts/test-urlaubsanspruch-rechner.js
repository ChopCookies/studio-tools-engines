/* Node unit tests for urlaubsanspruch-rechner pure engine (DOM stubbed). */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({ innerHTML: '', value: '', appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; } });
global.document = { readyState: 'complete', getElementById: () => el(), createElement: () => el(), addEventListener(){} };
global.window = {};

const src = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/urlaubsanspruch-rechner.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', src)(mod, mod.exports, global.document, global.window);
const { calcUrlaub } = mod.exports;

let pass = 0, fail = 0;
function assert(name, cond) { if (cond) { pass++; console.log('  ok ' + name); } else { fail++; console.log('  FAIL ' + name); } }

// Volljahr: angestellt über das ganze Jahr -> 20 Arbeitstage (BAG, 5-Tage)
{
  const r = calcUrlaub({ jahr: 2026, start: '2020-01-01', end: '', workdays: 5, leaveWerktage: 24, mode: 'bag' });
  assert('Volljahr 5-Tage = 20', r.anspruch === 20 && !r.isPartial);
  assert('Volljahr 6-Tage = 24', calcUrlaub({ jahr: 2026, start: '2019-06-01', workdays: 6, mode: 'bag' }).anspruch === 24);
}
// Eintritt 2. Halbjahr, laufend -> §5(1)a Teilurlaub 4 Monate
{
  const r = calcUrlaub({ jahr: 2026, start: '2026-09-01', end: '', workdays: 5, mode: 'bag' });
  assert('Eintritt 1.9 laufend -> 7 (4 Monate×1.667=6.67->7)', r.anspruch === 7);
  assert('trigger a', r.art.indexOf('a BUrlG') >= 0);
}
// Eintritt 1. Halbjahr, laufend -> Wartezeit erfüllt -> voll 20
{
  const r = calcUrlaub({ jahr: 2026, start: '2026-03-01', end: '', workdays: 5, mode: 'bag' });
  assert('Eintritt 1.3 laufend -> voll 20', r.anspruch === 20);
}
// Austritt vor Wartezeit -> §5(1)b
{
  const r = calcUrlaub({ jahr: 2026, start: '2026-06-15', end: '2026-08-31', workdays: 5, mode: 'bag' });
  assert('Austritt vor Wartezeit -> 3,33 (Jul+Aug=2, 3.33 bleibt als Bruchteil)', r.anspruch === 3.33);
  assert('trigger b', r.art.indexOf('b BUrlG') >= 0);
}
// Austritt 2. Halbjahr nach Wartezeit -> voller Anspruch (§4)
{
  const r = calcUrlaub({ jahr: 2026, start: '2026-03-01', end: '2026-09-15', workdays: 5, mode: 'bag' });
  assert('Austritt 2. HJ nach Wartezeit -> voll 20', r.anspruch === 20);
}
// Austritt 1. Halbjahr nach Wartezeit -> §5(1)c
{
  const r = calcUrlaub({ jahr: 2026, start: '2025-03-01', end: '2026-04-30', workdays: 5, mode: 'bag' });
  assert('Austritt 1. HJ nach Wartezeit -> 7 (Jan-Apr=4, 6.67->7)', r.anspruch === 7);
  assert('trigger c', r.art.indexOf('c BUrlG') >= 0);
}
// Literal modus: 24 Werktage
{
  const r = calcUrlaub({ jahr: 2026, start: '2026-09-01', end: '', workdays: 5, leaveWerktage: 24, mode: 'literal' });
  assert('Literal 4 Monate -> 8', r.anspruch === 8 && r.fullLeave === 24);
}
// Fehlerfälle
{
  assert('Error no start', !!calcUrlaub({ jahr: 2026, start: '', workdays: 5, mode: 'bag' }).error);
  assert('Error end<start', !!calcUrlaub({ jahr: 2026, start: '2026-05-01', end: '2026-01-01', workdays: 5, mode: 'bag' }).error);
  assert('Error start>jahr', !!calcUrlaub({ jahr: 2026, start: '2027-01-01', workdays: 5, mode: 'bag' }).error);
}

// Brief-Testfälle (Jahr 2026, BAG-Modus, 5-Tage-Woche sofern nicht anders) — siehe construction-lab-brieff.md
{
  assert('Brief: 01.01.2020 laufend -> 20', calcUrlaub({ jahr: 2026, start: '2020-01-01', end: '', workdays: 5, mode: 'bag' }).anspruch === 20);
  assert('Brief: 01.04.2026 laufend -> 20 (Wartezeit im Jahr erfüllt)', calcUrlaub({ jahr: 2026, start: '2026-04-01', end: '', workdays: 5, mode: 'bag' }).anspruch === 20);
  assert('Brief: 01.08.2026 laufend -> 8,33 (nicht 8)', calcUrlaub({ jahr: 2026, start: '2026-08-01', end: '', workdays: 5, mode: 'bag' }).anspruch === 8.33);
  assert('Brief: 01.01.2020 -> 31.05.2026 -> 8,33 (§5 Abs.1 c)', calcUrlaub({ jahr: 2026, start: '2020-01-01', end: '2026-05-31', workdays: 5, mode: 'bag' }).anspruch === 8.33);
  assert('Brief: 01.01.2020 -> 31.07.2026 -> 20', calcUrlaub({ jahr: 2026, start: '2020-01-01', end: '2026-07-31', workdays: 5, mode: 'bag' }).anspruch === 20);
  assert('Brief: 01.01.2020, 3-Tage-Woche -> 12', calcUrlaub({ jahr: 2026, start: '2020-01-01', end: '', workdays: 3, mode: 'bag' }).anspruch === 12);
  // undefined-Einheit behoben: Volljahr liefert einheit
  assert('Volljahr einheit gesetzt (kein undefined)', calcUrlaub({ jahr: 2026, start: '2020-01-01', end: '', workdays: 5, mode: 'bag' }).einheit === 'Arbeitstage');
  assert('1-Tage-Woche -> 4', calcUrlaub({ jahr: 2026, start: '2020-01-01', end: '', workdays: 1, mode: 'bag' }).anspruch === 4);
  assert('4-Tage-Woche -> 16', calcUrlaub({ jahr: 2026, start: '2020-01-01', end: '', workdays: 4, mode: 'bag' }).anspruch === 16);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
