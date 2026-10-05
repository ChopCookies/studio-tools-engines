/* Node unit test for balkonkraftwerk-rechner.js (compute + CO2 feature).
   Run: node scripts/test-balkonkraftwerk-rechner.js   */
'use strict';
global.window = { __siteLang: 'de' };
global.document = { readyState: 'complete', addEventListener: function(){},
  getElementById: function(){ return null; }, createElement: function(){ return {className:'',type:'',textContent:'',addEventListener:function(){}}; } };
const m = require('../public/assets/js/balkonkraftwerk-rechner.js');

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('OK  ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

// Reference SEO vector at 37 ct (BDEW 2026): 800 Wp, 700 kWh, 500 EUR, 70% self, 3% esc
const r = m.compute(800, 700, 500, 37, 0.7, 0, 3);
assert('benefit1 ~ 181 EUR at 37ct', near(r.benefit1, 181, 1));
assert('co2Y1 ~ 169 kg (490 kWh x 0.344)', near(r.co2Y1, 169, 2));
assert('payback ~ 2.7 years', near(r.payback, 2.7, 0.2));
assert('profit20 positive', r.profit20 > 0);

// Old vector at 35 ct for regression cross-check
const r2 = m.compute(800, 700, 500, 35, 0.7, 0, 3);
assert('benefit1 ~ 172 EUR at 35ct', near(r2.benefit1, 172, 1));
assert('co2Y1 unchanged (independent of price)', near(r2.co2Y1, 169, 2));

// No maintenance case / high escalation sane
const r3 = m.compute(800, 700, 500, 37, 1.0, 0, 3);
assert('100% self-consumption payback faster', r3.payback <= r.payback);
assert('co2 at 100% self ~ 241 kg', near(r3.co2Y1, 241, 2));

// Degradation never grows output
const r4 = m.compute(800, 700, 500, 37, 0.5, 0, 0);
assert('no escalation: benefit1 ~ 130 EUR', near(r4.benefit1, 130, 1));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
