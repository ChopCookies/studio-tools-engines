// Node unit tests for the gehalt-rechner tax / social-security model.
// Run: node scripts/test-gehalt-rechner.js
// Stubs window/document so the IIFE's setup() no-ops and the math is testable.
'use strict';

const assert = require('assert');

global.window = { __siteLang: 'de' };
global.document = { readyState: 'complete', addEventListener: function(){}, getElementById: function(){ return null; } };

const m = require('../public/assets/js/gehalt-rechner.js');

function approx(a, b, tol) { return Math.abs(a - b) <= tol; }

// 2026 anchors (Steuerschroeder / Finanztip, Stand 2026):
// Grundfreibetrag 12.348, 42 % ab 69.879, 45 % ab 277.826, Eingang 14 %.
assert.strictEqual(m.estESt(0), 0, 'ESt=0 under GF');
assert.strictEqual(m.estESt(12348), 0, 'ESt=0 at exactly GF');
assert.ok(m.estESt(15000) > 0, 'ESt>0 above GF');

// Sanity: 45% top zone applies above 277.826; marginal rate at very high income ~45%
const hi = m.estESt(400000) - m.estESt(300000); // 100k above top zone -> ~45% marginal
assert.ok(approx(hi, 0.45 * 100000, 2500), 'top-zone marginal ~45%, got ' + hi);

// KV rate check: 2026 avg Zusatzbeitrag 2.9% (BMG) -> employee 7.3% + 1.45% = 8.75%.
// 42.000 EUR gross, no church, childless.
let r = m.computeAnnual(3500, 0, true);
assert.strictEqual(r.gross, 42000, 'annual gross 42k');
assert.ok(approx(r.kv, 42000 * 0.0875, 0.01), 'KV=8.75% of gross, got ' + r.kv);
assert.ok(r.netShare > 0.5 && r.netShare < 0.8, 'net share plausible, got ' + r.netShare);
assert.ok(r.avgTax > 0.10 && r.avgTax < 0.20, 'avg tax plausible, got ' + r.avgTax);

// BBG cap: at 10.000/mo (120k/yr) KV is capped at BBG 69.750.
let h = m.computeAnnual(10000, 0, false);
assert.ok(approx(h.kv, 69750 * 0.0875, 0.01), 'KV capped at BBG, got ' + h.kv);
assert.ok(approx(h.rv, 101400 * 0.093, 0.01), 'RV capped at BBG 101.400, got ' + h.rv);

// Childless surcharge raises PV by 0.6% (employee share).
let withKids = m.computeAnnual(3000, 0, false);
let noKids   = m.computeAnnual(3000, 0, true);
assert.ok(noKids.pv > withKids.pv, 'childless PV surcharge applies');

// Church tax scales with Lohnsteuer estimate.
let church8 = m.computeAnnual(4000, 8, false);
let church0 = m.computeAnnual(4000, 0, false);
assert.ok(church8.church > 0 && church8.church > church0.church, 'church tax applied when >0');

// Negative/zero gross -> net 0 (defensive).
let z = m.computeAnnual(0, 0, false);
assert.strictEqual(z.net, 0, 'zero gross -> net 0');

console.log('gehalt-rechner: all ' + 'assertions passed');
