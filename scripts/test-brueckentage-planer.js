/* Node unit tests for brueckentage-planer pure engine (DOM + window stubbed). */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({ innerHTML: '', value: '', appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; } });
global.document = { readyState: 'complete', getElementById: () => el(), createElement: () => el(), addEventListener(){} };
global.window = {};

const dataSrc = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/brueckentage-data.js'), 'utf8');
new Function('window', dataSrc)(global.window);
const toolSrc = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/brueckentage-planer.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', toolSrc)(mod, mod.exports, global.document, global.window);
const { planBrueckentage } = mod.exports;

let pass = 0, fail = 0;
function assert(name, cond) { if (cond) { pass++; console.log('  ok ' + name); } else { fail++; console.log('  FAIL ' + name); } }

// Dataset integrity: 16 Bundesländer, Jahre 2026+2027+2028
const codes = Object.keys(global.window.FEIERTAGE_DATA.laender);
assert('16 Bundesländer', codes.length === 16);
assert('Alle BL haben 2026', codes.every(c => !!global.window.FEIERTAGE_DATA.laender[c]['2026']));
assert('Alle BL haben 2027', codes.every(c => !!global.window.FEIERTAGE_DATA.laender[c]['2027']));
assert('Alle BL haben 2028', codes.every(c => !!global.window.FEIERTAGE_DATA.laender[c]['2028']));

// BY 2026: Neujahrstag 01.01. = Do, Brückentag Fr 02.01.
{
  const r = planBrueckentage('BY', 2026);
  assert('BY 2026 no error', !r.error);
  assert('BY 2026 anzahl > 10', r.anzahl > 10);
  const neu = r.feiertage.find(f => f.n === 'Neujahrstag');
  assert('Neujahrstag 01.01.2026 vorhanden', neu && neu.d === '2026-01-01');
  assert('Neujahrstag ist Brückentag', neu && neu.br === true);
  assert('Neujahr Brücke 02.01.2026', neu && neu.bd === '2026-01-02');
  assert('brueckentage Liste konsistent', r.brueckentage.length === r.feiertage.filter(f=>f.br).length);
}
// BW 2026 enthält Heilige Drei Könige (06.01.)
{
  const r = planBrueckentage('BW', 2026);
  assert('BW 2026 Dreikönig', r.feiertage.some(f=>f.n==='Heilige Drei Könige'));
}
// TH 2026 enthält Weltkindertag (laut Hinweis)
{
  const r = planBrueckentage('TH', 2026);
  assert('TH 2026 Weltkindertag', r.feiertage.some(f=>f.n.includes('Weltkindertag')));
}
// 2027 Daten vorhanden für BY (Reformationstag-Wochenstrukturcheck grob)
{
  const r = planBrueckentage('BY', 2027);
  assert('BY 2027 ok', !r.error && r.anzahl > 10);
}
// 2028 Daten vorhanden + Weihnachten-Fix: 2. Weihnachtstag (Di 26.12.) ist kein Brückentag,
// weil der vorherige Werktag (Mo 25.12., 1. Weihnachtstag) selbst Feiertag ist.
{
  const r = planBrueckentage('SH', 2028);
  assert('SH 2028 ok', !r.error && r.anzahl >= 10);
  const weihn = r.feiertage.find(f => f.n === '2. Weihnachtstag');
  assert('2. Weihnachtstag 2028 vorhanden', weihn && weihn.d === '2028-12-26');
  assert('2. Weihnachtstag 2028 kein falscher Brückentag', weihn && weihn.br === false);
}
// Fehlerfall unbekanntes Jahr (2029 noch nicht abgedeckt) => error
{
  assert('2029 nicht abgedeckt -> error', !!planBrueckentage('BY', 2029).error);
}
{
  assert('Error unbekanntes BL', !!planBrueckentage('ZZ', 2026).error);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
