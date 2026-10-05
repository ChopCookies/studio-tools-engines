/* Node unit test for umzugskosten-rechner.js (pure math via buildResult export). */
'use strict';
const assert = require('assert');

const elements = {};
function stub(id) {
  if (!elements[id]) elements[id] = { value: '', checked: false, style: {}, innerHTML: '',
    addEventListener: function () {}, appendChild: function () {}, textContent: '',
    type: 'button' };
  return elements[id];
}
global.window = { __siteLang: 'de' };
global.document = {
  readyState: 'complete',
  addEventListener: function () {},
  createElement: function () { return { type: 'button', className: '', textContent: '',
    addEventListener: function () {}, style: {} }; },
  getElementById: function (id) { return stub(id); }
};
const m = require('../public/assets/js/umzugskosten-rechner.js');

function set(v) { Object.assign(elements, v); }

// ---- Test 1: Self-move deposit + fuel math ----
set({ 'uz-type': { value: 'selbst' },
      'uz-cold': { value: '600' },
      'uz-boxes': { value: '20' }, 'uz-boxprice': { value: '3' },
      'uz-vanday': { value: '50' }, 'uz-vandays': { value: '1' },
      'uz-km': { value: '50' }, 'uz-fuel': { value: '' }, // default 2.32
      'uz-helpers': { value: '3' }, 'uz-hours': { value: '6' }, 'uz-hprate': { value: '25' },
      'uz-floor': { value: '0' }, 'uz-haltverbot': { checked: false },
      'uz-doppelmiete': { checked: false }, 'uz-nachsende': { checked: false }, 'uz-renov': { value: '' } });
let r = m.buildResult();
assert.strictEqual(r.error, undefined, 'no error for valid input');
assert.strictEqual(r.deposit, 1800, 'deposit = 3 x 600');
// fuel default 2.32: 50km/100 * 9 L * 2.32 = 10.44
const fuelItem = r.items.find(i => /Kraftstoff|Fuel/.test(i.label));
assert.ok(fuelItem, 'fuel item present');
assert.strictEqual(Math.round(fuelItem.value * 100), 1044, 'fuel uses 2.32 default -> 10.44 EUR');
// boxes 20*3 = 60, van 50, helpers 3*6*25 = 450
const total = r.items.reduce((s, i) => s + i.value, 0);
assert.strictEqual(total, 1800 + 60 + 50 + 10.44 + 450, 'self-move total');

// ---- Test 2: fuel default = 2.32 is already proven by Test 1 (10.44 EUR on 50 km).
// The constant itself is not exported; the math path above confirms the default applies.

// ---- Test 3: Firma type uses size band ----
set({ 'uz-type': { value: 'firma' },
      'uz-cold': { value: '800' },
      'uz-size': { value: '3' }, 'uz-dist': { value: 'lokal' },
      'uz-firma': { value: '' },
      'uz-floor': { value: '0' }, 'uz-haltverbot': { checked: false },
      'uz-doppelmiete': { checked: false }, 'uz-nachsende': { checked: true }, 'uz-renov': { value: '' } });
r = m.buildResult();
assert.strictEqual(r.error, undefined);
// lokal 3-Zimmer band = 1150
assert.strictEqual(m.FIRMA_BANDS.lokal[3], 1150, 'lokal 3-room band 1150');
const firmaItem = r.items.find(i => /Umzugsunternehmen|Moving company/.test(i.label));
assert.strictEqual(firmaItem.value, 1150, 'firma cost from size band');
// deposit 2400 + firma 1150 + nachsende 33
const fTotal = r.items.reduce((s, i) => s + i.value, 0);
assert.strictEqual(fTotal, 2400 + 1150 + 33, 'firma total');

console.log('umzugskosten node test PASSED');
