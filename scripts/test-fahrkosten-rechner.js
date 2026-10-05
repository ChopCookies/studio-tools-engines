// Node E2E test for fahrkosten-rechner.js | 4,500-€-Deckel logic
// Run: node scripts/test-fahrkosten-rechner.js
var path = require('path');

var elements = {};
function mkEl(id) {
  if (!elements[id]) {
    elements[id] = { value: '', checked: false, style: {}, innerHTML: '',
      appendChild: function () {} };
  }
  return elements[id];
}
global.window = { __siteLang: 'de' };
global.document = {
  readyState: 'complete',
  addEventListener: function () {},
  getElementById: function (id) { return mkEl(id); },
  createElement: function () { return { type: '', className: '', textContent: '', appendChild: function () {}, addEventListener: function () {} }; }
};

var m = require(path.resolve(__dirname, '../public/assets/js/fahrkosten-rechner.js'));
var assert = require('assert');

// Pre-seed the inputs the tool reads, before setting values
['fk-km','fk-days','fk-rabatt','fk-pkw','tool-inputs','tool-output']
  .forEach(function (id) { elements[id] = { value: '', checked: false, style: {}, innerHTML: '', appendChild: function () {} }; });


// --- Case 1: short commute, no cap (30 km x 230 days, pkw checked default) ---
elements['fk-km'].value = '30';
elements['fk-days'].value = '230';
elements['fk-rabatt'].value = '0';
elements['fk-pkw'].checked = true;
m.run();
var out1 = elements['tool-output'].innerHTML;
assert(out1.indexOf('2.622 €') >= 0, '30km x 230d x 0.38 = 2622 should appear');
assert(out1.indexOf('4.500') === -1, 'no cap should be mentioned for 2622');

// --- Case 2: long commute WITH pkw -> cap NOT applied (60 km x 230 = 5244) ---
elements['fk-km'].value = '60';
elements['fk-days'].value = '230';
elements['fk-rabatt'].value = '0';
elements['fk-pkw'].checked = true;
m.run();
var out2 = elements['tool-output'].innerHTML;
assert(out2.indexOf('5.244 €') >= 0, '60km with car = 5244 full');
assert(out2.indexOf('Begrenzter Abzug') === -1, 'no capped row when car used');
assert(out2.indexOf('greift die 4.500-€-Höchstgrenze nicht') >= 0, 'car note shown');

// --- Case 3: long commute WITHOUT pkw -> cap applied (deduct = 4500) ---
elements['fk-km'].value = '60';
elements['fk-days'].value = '230';
elements['fk-rabatt'].value = '0';
elements['fk-pkw'].checked = false;
m.run();
var out3 = elements['tool-output'].innerHTML;
assert(out3.indexOf('4.500 €') >= 0, 'capped row shows 4500');
assert(out3.indexOf('auf 4.500 € im Jahr begrenzt') >= 0, 'cap note shown');

// --- Case 4: cap AND employer subsidy (60km no car, 1000 subsidy -> 3500) ---
elements['fk-km'].value = '60';
elements['fk-days'].value = '230';
elements['fk-rabatt'].value = '1000';
elements['fk-pkw'].checked = false;
m.run();
var out4 = elements['tool-output'].innerHTML;
assert(out4.indexOf('3.500 €') >= 0, '4500 - 1000 = 3500');

console.log('ALL FAHRKOSTEN TESTS PASS');
