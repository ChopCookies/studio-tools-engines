// Node unit test: notgroschen-rechner
// Stubs window/document so the IIFE loads, then asserts on exported pure functions
// and buildResult through a populated DOM stub.
'use strict';
const assert = require('assert');
const path = require('path');

const JS = path.join(__dirname, '..', 'public', 'assets', 'js', 'notgroschen-rechner.js');

const elements = {};
function mkEl() { return { value: '', checked: false, style: {}, innerHTML: '', appendChild: function(){}, addEventListener: function(){} }; }

global.window = { __siteLang: 'de', esc: (s) => String(s) };
global.document = {
  readyState: 'complete',
  addEventListener: function(){},
  getElementById: function(id){ return (id in elements) ? elements[id] : null; },
  createElement: function(){ return mkEl(); }
};

const m = require(JS);

let fails = 0;
function chk(name, cond) {
  if (!cond) { console.error('FAIL: ' + name); fails++; } else { console.log('ok: ' + name); }
}

// --- parseMonths ---
chk('parseMonths 3', m.parseMonths('3') === 3);
chk('parseMonths 2', m.parseMonths('2') === 2);
chk('parseMonths 6', m.parseMonths('6') === 6);
chk('parseMonths empty falls back to 3', m.parseMonths('') === 3);
chk('parseMonths garbage falls back to 3', m.parseMonths('abc') === 3);
chk('parseMonths 0 falls back to 3', m.parseMonths('0') === 3);
chk('parseMonths 4 kept', m.parseMonths('4') === 4);
chk('MONTHS_OPTIONS', JSON.stringify(m.MONTHS_OPTIONS) === JSON.stringify([2,3,4,6]));

// --- pure helpers ---
chk('coveredMonths 1500/1500 = 1', m.coveredMonths(1500, 1500) === 1);
chk('coveredMonths 6000/1500 = 4', m.coveredMonths(6000, 1500) === 4);
chk('coveredMonths 0 expenses = 0', m.coveredMonths(500, 0) === 0);
chk('progressPct half', m.progressPct(2250, 4500) === 50);
chk('progressPct full', m.progressPct(4500, 4500) === 100);
chk('progressPct clamps >100', m.progressPct(8000, 4500) === 100);
chk('progressPct zero target = 0', m.progressPct(100, 0) === 0);

// --- durText bilingual ---
chk('durText 14 DE', m.durText(14) === '1 Jahr und 2 Monate');
chk('durText 5 DE', m.durText(5) === '5 Monate');
chk('durText 36 DE', m.durText(36) === '3 Jahre');

// --- buildResult via populated DOM stub ---
function setDefaults(v) {
  ['ng-expenses','ng-rate','ng-saved','ng-months'].forEach(id => elements[id] = mkEl());
  if (v.expenses !== undefined) elements['ng-expenses'].value = v.expenses;
  if (v.rate !== undefined) elements['ng-rate'].value = v.rate;
  if (v.saved !== undefined) elements['ng-saved'].value = v.saved;
  if (v.months !== undefined) elements['ng-months'].value = v.months;
}

// default months = 3
setDefaults({ expenses: '1500', rate: '200', saved: '600' });
let r = m.buildResult();
chk('buildResult default target 4500', r.target === 4500);
chk('buildResult months default 3', r.months === 3);
chk('buildResult missing 3900', r.missing === 3900);
chk('buildResult monthsToTarget ceil(3900/200)=20', r.monthsToTarget === 20);
chk('buildResult covered 600/1500=0.4', r.covered === 0.4);
chk('buildResult progress 600/4500=13.333', Math.abs(r.progress - 13.3333) < 0.01);
chk('buildResult not reached', r.reached === false);

// months = 2
setDefaults({ expenses: '1500', rate: '200', saved: '0', months: '2' });
r = m.buildResult();
chk('buildResult months 2 target 3000', r.target === 3000 && r.months === 2);

// months = 6
setDefaults({ expenses: '1500', rate: '200', saved: '0', months: '6' });
r = m.buildResult();
chk('buildResult months 6 target 9000', r.target === 9000 && r.months === 6);

// reached state
setDefaults({ expenses: '1500', rate: '0', saved: '4500', months: '3' });
r = m.buildResult();
chk('buildResult reached true', r.reached === true);
chk('buildResult missing 0 when reached', r.missing === 0);
chk('buildResult monthsToTarget Infinity when rate 0', r.monthsToTarget === Infinity);

// rate 0, not reached
setDefaults({ expenses: '1500', rate: '0', saved: '0', months: '2' });
r = m.buildResult();
chk('buildResult Infinity duration when rate 0', r.monthsToTarget === Infinity);

// validation errors
setDefaults({ expenses: '', rate: '200', saved: '0' });
r = m.buildResult();
chk('buildResult error missing expenses', !!r.error);
setDefaults({ expenses: '1500', rate: '-5', saved: '0' });
r = m.buildResult();
chk('buildResult error negative rate', !!r.error);

console.log(fails === 0 ? '\nALL PASS (' + 'notgroschen-rechner' + ')' : '\n' + fails + ' FAILURES');
process.exit(fails === 0 ? 0 : 1);
