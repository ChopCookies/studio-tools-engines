/* Node unit tests for kuendigungsfrist-rechner pure engine (DOM stubbed). */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({ innerHTML: '', value: '', appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; } });
global.document = {
  readyState: 'complete',
  getElementById: () => el(),
  createElement: () => el(),
  addEventListener() {},
};
global.window = {};

const src = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/kuendigungsfrist-rechner.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', src)(mod, mod.exports, global.document, global.window);
const { computeKuendigung } = mod.exports;

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

// Legally-sourced worked examples (§622 BGB spec, Stand 2026)
// Arbeitnehmerkündigung (Abs.1): 4 Wochen zum 15. oder Monatsende
assert('AN 10.3 -> 31.3', computeKuendigung({zugang:'2026-03-10',beginn:'2020-01-01',werKuendigt:'arbeitnehmer'}).beendigungsdatum === '2026-03-31');
assert('AN 20.3 -> 30.4', computeKuendigung({zugang:'2026-03-20',beginn:'2020-01-01',werKuendigt:'arbeitnehmer'}).beendigungsdatum === '2026-04-30');
// Arbeitgeber: <2 Jahre -> Abs.1
assert('AG 20.8 (<2J) -> 30.9', computeKuendigung({zugang:'2026-08-20',beginn:'2026-01-01',werKuendigt:'arbeitgeber'}).beendigungsdatum === '2026-09-30');
assert('AG 15.8 (<2J) -> 31.8', computeKuendigung({zugang:'2026-08-15',beginn:'2026-01-01',werKuendigt:'arbeitgeber'}).beendigungsdatum === '2026-08-31');
// Arbeitgeber: >=2 Jahre -> Abs.2 (zum Ende eines Kalendermonats)
assert('AG 15.3 >=2J (1M) -> 30.4', computeKuendigung({zugang:'2026-03-15',beginn:'2024-01-01',werKuendigt:'arbeitgeber'}).beendigungsdatum === '2026-04-30');
assert('AG 1.3 >=5J (2M) -> 31.5', computeKuendigung({zugang:'2026-03-01',beginn:'2021-01-01',werKuendigt:'arbeitgeber'}).beendigungsdatum === '2026-05-31');
assert('AG 17.9 >10J (Nr.4=4M) -> 31.1.27', computeKuendigung({zugang:'2026-09-17',beginn:'2016-03-01',werKuendigt:'arbeitgeber'}).beendigungsdatum === '2027-01-31');
assert('AG 17.9 20J (Nr.7=7M)', computeKuendigung({zugang:'2026-09-17',beginn:'2005-01-01',werKuendigt:'arbeitgeber'}).norm === '§622 Abs. 2 Nr. 7 BGB');
// Probezeit (Abs.3): 14 Tage
assert('Probezeit 10.2 -> 24.2', computeKuendigung({zugang:'2026-02-10',beginn:'2026-01-01',werKuendigt:'arbeitgeber',probezeit:true}).beendigungsdatum === '2026-02-24');
assert('Probezeit norm Abs.3', computeKuendigung({zugang:'2026-02-10',beginn:'2026-01-01',werKuendigt:'arbeitgeber',probezeit:true}).norm.indexOf('Abs. 3') >= 0);
// §193 not auto-applied: last day shown as calendar date, weekday displayed
// Probezeit 14 Tage ab Zugang: 10.5.2026 (So) +14 = 24.5 (So) -> stays 24.5
assert('Probezeit calendar 10.5 -> 24.5 (no auto-shift)', computeKuendigung({zugang:'2026-05-10',beginn:'2026-01-01',werKuendigt:'arbeitgeber',probezeit:true}).beendigungsdatum === '2026-05-24');
// Fehlerfall
assert('Error no date', !!computeKuendigung({zugang:'',beginn:'2020-01-01',werKuendigt:'arbeitgeber'}).error);
// Arbeitnehmerkündigung bei langer Betriebszugehörigkeit bleibt Abs.1
assert('AN 10J bleibt Abs.1', computeKuendigung({zugang:'2026-09-17',beginn:'2010-01-01',werKuendigt:'arbeitnehmer'}).norm.indexOf('Abs. 1') >= 0);

// Brief-Testfälle (Zugang 24.09.2026) — siehe construction-lab-brieff.md
assert('Brief: AG 01.01.2016 -> 4 Monate -> 31.01.2027', computeKuendigung({zugang:'2026-09-24',beginn:'2016-01-01',werKuendigt:'arbeitgeber'}).beendigungsdatum === '2027-01-31');
assert('Brief: AN 01.01.2016 -> 4 Wochen -> 31.10.2026', computeKuendigung({zugang:'2026-09-24',beginn:'2016-01-01',werKuendigt:'arbeitnehmer'}).beendigungsdatum === '2026-10-31');
assert('Brief: AG 01.09.2019 -> 2 Monate -> 30.11.2026', computeKuendigung({zugang:'2026-09-24',beginn:'2019-09-01',werKuendigt:'arbeitgeber'}).beendigungsdatum === '2026-11-30');
assert('Brief: AG Probezeit 01.06.2026 -> 2 Wochen -> 08.10.2026', computeKuendigung({zugang:'2026-09-24',beginn:'2026-06-01',werKuendigt:'arbeitgeber',probezeit:true}).beendigungsdatum === '2026-10-08');

// Regressionsschutz: Teilzeitfaktor darf die Frist NICHT mehr verkürzen (§622 BGB).
// 10 Jahre Beschäftigung -> immer 4 Monate, egal ob ein (inzwischen ignorierter) Teilzeitfaktor übergeben wird.
assert('Regression: 10J Teilzeit(faktor 0.5 ignoriert) -> weiterhin 4 Monate (31.01.2027)', computeKuendigung({zugang:'2026-09-24',beginn:'2016-01-01',werKuendigt:'arbeitgeber',teilzeitFaktor:0.5}).beendigungsdatum === '2027-01-31');
// Zitat-Korrektur: Staffelung gehört zu §622 Abs. 2, nicht Abs. 3.
assert('Zitat: Staffelung -> §622 Abs. 2', computeKuendigung({zugang:'2026-09-24',beginn:'2016-01-01',werKuendigt:'arbeitgeber'}).normHinweis.indexOf('Abs. 2') >= 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
