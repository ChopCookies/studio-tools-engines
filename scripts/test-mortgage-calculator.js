/* Node unit test for the new mortgage-calculator features
   (Szenario-Vergleich, Sondertilgungs-Auswirkung, Rate pro 10.000 €).
   Tests the shared amortization engine + the scenario math. */
'use strict';
const path = require('path');

// Minimal DOM stub so setup() doesn't throw on require.
const mkEl = (id) => ({
  id, value: '', appendChild: () => {}, addEventListener: () => {},
  textContent: '', innerHTML: '', className: '', type: '', style: {},
  classList: { contains: () => false }, closest: () => null,
  querySelectorAll: () => [], getContext: () => ({}),
  parentElement: { getBoundingClientRect: () => ({ width: 600 }) }
});
global.document = {
  readyState: 'complete',
  documentElement: { classList: { contains: () => false } },
  getElementById: (id) => mkEl(id),
  createElement: () => mkEl('__new__')
};
global.window = { __siteLang: 'de', devicePixelRatio: 1, playbook: null };
global.Blob = function() {}; global.URL = { createObjectURL: () => 'blob:x' };
global.setTimeout = (fn) => { fn(); return 0; };

const mc = require(path.join(__dirname, '..', 'public', 'assets', 'js', 'mortgage-calculator.js'));

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
function approx(a, b) { return Math.abs(a - b) < 1; }

const calc = mc.calculateAmortization;

console.log('Rate pro 10.000 € (Annuität): loan 300000, 3.9 %, 2 % Tilgung');
let r = calc(300000, 3.9, 10, 2, 0);
// Monatszins = 0.039/12 = 0.00325; Monatsrate = 300000*(0.00325 + 0.02/12)
let expectedMonthly = 300000 * (0.00325 + 0.02 / 12);
console.log('  Monatsrate: ' + r.monthlyPayment.toFixed(2) + ' (erwartet ' + expectedMonthly.toFixed(2) + ')');
assert('Monatsrate korrekt', approx(r.monthlyPayment, expectedMonthly));
assert('Rate pro 10.000 = 300k->', approx(r.monthlyPayment / 300000 * 10000, expectedMonthly / 30));

console.log('Szenario-Vergleich: Zinserhöhung erhöht Zinslast');
let rLow = calc(300000, 3.4, 10, 2, 0);
let rBase = calc(300000, 3.9, 10, 2, 0);
let rHigh = calc(300000, 4.4, 10, 2, 0);
assert('niedriger Zins -> weniger Zinslast', rLow.totalInterest < rBase.totalInterest);
assert('höherer Zins -> mehr Zinslast', rHigh.totalInterest > rBase.totalInterest);
assert('niedriger Zins -> niedrigere Monatsrate', rLow.monthlyPayment < rBase.monthlyPayment);

console.log('Sondertilgungs-Auswirkung: Zinsen sinken, Laufzeit kürzer');
let rSond = calc(300000, 3.9, 10, 2, 5000);
assert('Sondertilgung senkt Gesamtzinsen', rSond.totalInterest < rBase.totalInterest);
assert('Sondertilgung verkürzt Laufzeit',
  rSond.yearsToPayoff !== null && (rBase.yearsToPayoff === null || rSond.yearsToPayoff < rBase.yearsToPayoff));

console.log('Zinsbindung: Restschuld am Ende der Fixierung');
assert('remainingAfterFixed sinnvoll', rBase.remainingAfterFixed > 0 && rBase.remainingAfterFixed < 300000);

console.log('');
console.log('Ergebnis: ' + pass + ' ok, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
