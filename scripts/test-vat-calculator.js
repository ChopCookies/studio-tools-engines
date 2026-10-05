// Node unit test for vat-calculator.js pure math (compute/num).
// Run: node scripts/test-vat-calculator.js
'use strict';
const assert = require('assert');

// Stub the DOM so the IIFE's setup() no-ops but module.exports is reachable.
global.window = { __siteLang: 'de' };
global.document = {
  readyState: 'complete',
  addEventListener: function(){},
  createElement: function(){ return { type:'', className:'', textContent:'', addEventListener:function(){} }; },
  getElementById: function(){ return null; }
};

const m = require(require('path').resolve(__dirname, '../public/assets/js/vat-calculator.js'));

function near(a, b, tol) {
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} near ${b} (tol ${tol})`);
}

// Net to gross at 19%
let r = m.compute('net', 19, 100);
near(r.gross, 119, 0.001);
near(r.tax, 19, 0.001);
near(r.net, 100, 0.001);

// Gross to net at 19%
r = m.compute('gross', 19, 119);
near(r.net, 100, 0.001);
near(r.tax, 19, 0.001);
near(r.gross, 119, 0.001);

// 7% example from SEO
r = m.compute('net', 7, 50);
near(r.tax, 3.5, 0.001);
near(r.gross, 53.5, 0.001);

// 0% (no tax) case
r = m.compute('net', 0, 100);
near(r.gross, 100, 0.0001);
near(r.tax, 0, 0.0001);
r = m.compute('gross', 0, 100);
near(r.net, 100, 0.0001);

// Custom rate (e.g. 16 like the swap-rate period, or any value)
r = m.compute('net', 16, 100);
near(r.gross, 116, 0.001);

// Edge: invalid amount / rate -> null
assert.strictEqual(m.compute('net', 19, 0), null);
assert.strictEqual(m.compute('net', 19, -5), null);
assert.strictEqual(m.compute('net', 101, 100), null);
assert.strictEqual(m.compute('net', -1, 100), null);

// num() comma handling (German decimal separator)
near(m.num('1234,56'), 1234.56, 0.0001);

console.log('vat-calculator math: all assertions passed (19%, 7%, 0%, custom, edges)');
