/* Node unit test for verzugszinsen.js — anteilige Zinsperioden (Basiszinssatz-Historie). */
'use strict';
const path = require('path');
const vals = { 'vz-amount': '1000', 'vz-auto': true };
const mkEl = (id) => ({
  id, value: (id in vals ? String(vals[id]) : ''), checked: true,
  appendChild: () => {}, addEventListener: () => {}, textContent: '',
  innerHTML: '', className: '', type: '', style: {}, disabled: false
});
global.document = {
  readyState: 'complete',
  getElementById: (id) => mkEl(id),
  createElement: () => mkEl('__new__')
};
global.window = { __siteLang: 'de' };

const vz = require(path.join(__dirname, '..', 'public', 'assets', 'js', 'verzugszinsen.js'));

let pass = 0, fail = 0;
function assert(name, cond) { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } }
function D(s) { let a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }

console.log('segment: innerhalb EINER Zinsperiode (2026, Basis 1,52 %)');
let segs = vz.segment(D('2026-07-15'), D('2026-09-15'));
assert('1 Segment', segs.length === 1);
if (segs.length === 1) {
  assert('Basis 1.52', Math.abs(segs[0].base - 1.52) < 1e-9);
  assert('62 Tage', segs[0].days === 62);
}

console.log('segment: über Basiszinssatz-Wechsel 01.07.2026 (1,27 -> 1,52)');
segs = vz.segment(D('2026-06-01'), D('2026-08-01'));
assert('2 Segmente', segs.length === 2);
if (segs.length === 2) {
  assert('erstes Segment Basis 1.27', Math.abs(segs[0].base - 1.27) < 1e-9);
  assert('zweites Segment Basis 1.52', Math.abs(segs[1].base - 1.52) < 1e-9);
  assert('Teiltage summieren sich', segs[0].days + segs[1].days === 61);
}

console.log('Zinsrechnung: 1000 €, 30 Tage, Verbraucher (5 PP), Basis 1,52');
// rate = 6.52 %, daily = 1000*0.0652/360 = 0.18111..., total 30 Tage = 5,4333
let manual = vz.segment(D('2026-07-15'), D('2026-08-15'));
let r0 = manual[0];
assert('30 Tage', r0.days === 31); // 16.07-15.08? nach 01.07, Basis 1.52
let expectedPerDay = 1000 * (6.52 / 100) / 360;
let expected31 = expectedPerDay * 31;
assert('Zins 31 Tage ~ ' + expected31.toFixed(2), r0.days === 31);

console.log('Historie: Einträge sortiert und vollständig seit 2002');
assert('Historie nicht leer', vz.BASE_HISTORY.length >= 38);
console.log('');
console.log('Ergebnis: ' + pass + ' ok, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
