// Node unit test for erstausstattung-rechner.js (buildResult + num)
// Deploy-excluded (lives in scripts/).
'use strict';
const assert = require('assert');

function mockEl(id) {
  const checked = { 'ea-kueche': true, 'ea-schlafen': true, 'ea-wohnen': true, 'ea-bad': true, 'ea-klein': true, 'ea-wasch': true };
  return {
    id,
    get value() {
      if (id === 'ea-budget') return 'mittel';
      if (id === 'ea-kaution') return '1500';
      if (id === 'ea-umzug') return '400';
      return undefined;
    },
    get checked() { return !!checked[id]; },
    set checked(v) {},
    appendChild() {}, addEventListener() {}, setAttribute() {}, style: {}
  };
}
global.document = {
  readyState: 'loading',
  getElementById: (id) => mockEl(id),
  createElement: () => mockEl('btn'),
  addEventListener: () => {}
};
global.window = { __siteLang: 'de' };

const M = require('../public/assets/js/erstausstattung-rechner.js');

// --- buildResult: all 6 items checked at mittel ---
let r = M.buildResult();
assert.strictEqual(r.level, 'mittel');
assert.strictEqual(r.sum, 1400 + 900 + 650 + 110 + 150 + 450, 'mittel sum all items');
assert.strictEqual(r.rows.length, 6);

// --- budget order mapping: sparsam -> index 0 ---
global.document.getElementById = (id) => {
  const el = mockEl(id);
  if (id === 'ea-budget') { return { ...el, get value() { return 'sparsam'; } }; }
  return el;
};
r = M.buildResult();
assert.strictEqual(r.sum, 600 + 350 + 250 + 60 + 80 + 200, 'sparsam sum all items');

// --- komfort ---
global.document.getElementById = (id) => {
  const el = mockEl(id);
  if (id === 'ea-budget') { return { ...el, get value() { return 'komfort'; } }; }
  return el;
};
r = M.buildResult();
assert.strictEqual(r.sum, 2800 + 1800 + 1500 + 200 + 300 + 900, 'komfort sum all items');

// --- ITEMS range shape ---
assert.deepStrictEqual(M.ITEMS.kueche.range, [600, 1400, 2800]);

// --- num() helper ---
assert.strictEqual(M.num('1500'), 1500);
assert.strictEqual(M.num('1,5'), 1.5);
assert.strictEqual(M.num('abc'), 0);
assert.strictEqual(M.num(''), 0);
assert.strictEqual(M.num('-5'), 0, 'negative treated as 0');

console.log('erstausstattung-rechner unit tests PASSED');
