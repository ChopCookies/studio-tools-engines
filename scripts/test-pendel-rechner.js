// Node E2E test for pendel-rechner.js — comparison + Entfernungspauschale tax saving
// Run: node scripts/test-pendel-rechner.js
var path = require('path');
var assert = require('assert');

var elements = {};
function mkEl(id, tag) {
  var el = {
    value: '', checked: false, style: {}, innerHTML: '', textContent: '',
    options: [], selectedIndex: 0, type: '', className: '',
    addEventListener: function () {},
    appendChild: function () {}
  };
  // give the ticket select its options
  if (id === 'pd-ticket') {
    el.options = [
      { value: '63', text: 'Deutschlandticket – 63 €/Monat' },
      { value: '59.85', text: 'Jobticket (5 % Rabatt) – 59,85 €/Monat' }
    ];
  }
  return el;
}
global.window = { __siteLang: 'de' };
global.document = {
  readyState: 'complete',
  addEventListener: function () {},
  getElementById: function (id) {
    if (!elements[id]) elements[id] = mkEl(id);
    return elements[id];
  },
  createElement: function () { return mkEl('_new'); }
};

var m = require(path.resolve(__dirname, '../public/assets/js/pendel-rechner.js'));

function setVals(o) {
  Object.keys(o).forEach(function (k) {
    if (!elements[k]) elements[k] = mkEl(k);
    elements[k].value = String(o[k]);
  });
  // select index for ticket
  if (o['pd-ticket'] !== undefined) {
    elements['pd-ticket'].selectedIndex = o['pd-ticket'] === 63 ? 0 : 1;
    elements['pd-ticket'].value = String(o['pd-ticket']);
  }
}

// --- Constants sanity ---
assert.strictEqual(m.DTICKET, 63, 'Deutschlandticket 63');
assert.strictEqual(m.DTICKET_JOB, 59.85, 'Jobticket 59.85');
assert.strictEqual(m.PENDLER_KM, 0.38, 'Entfernungspauschale 0.38');
assert.strictEqual(m.DEFAULT_TAXRATE, 30, 'default taxrate 30');

// --- Case 1: 25 km, 21 days, 0.35/km, 0 parking, ticket 63, 30% tax ---
setVals({ 'pd-km': '25', 'pd-days': '21', 'pd-kmcost': '0.35', 'pd-parking': '0', 'pd-ticket': 63, 'pd-taxrate': '30' });
m.run();
var out = elements['tool-output'].innerHTML;
// monthly distance 25*2*21 = 1050 km
assert(out.indexOf('1.050 km') >= 0, '1050 km/month');
// car monthly = 1050*0.35 = 367.5 -> 368
assert(out.indexOf('368 €') >= 0, 'car monthly 368');
// ÖPNV 63
assert(out.indexOf('63 €') >= 0, 'opnv 63');
// yearly car 367.5*12=4410, opnv 756
assert(out.indexOf('4.410 €') >= 0, 'car yearly 4410');
assert(out.indexOf('756 €') >= 0, 'opnv yearly 756');
// Entfernungspauschale: 25*252*0.38 = 2394
assert(out.indexOf('2.394 €') >= 0, 'deduction 2394');
// tax saving annual = 2394*0.30=718.2 -> 718; monthly ~60
assert(out.indexOf('718 €') >= 0, 'tax saving 718');
// dynamic km label with user value 0.35 -> shows 0,4 €/km (fmt1 rounds 0.35 -> 0.4)
assert(out.indexOf('Fahrtkosten-Anteil') >= 0, 'km cost row label present');

// --- Case 2: EN language + dynamic label + jobticket ---
// DE flag is captured at module load; reload the module with EN to mirror the browser
global.window = { __siteLang: 'en' };
var mpath = path.resolve(__dirname, '../public/assets/js/pendel-rechner.js');
delete require.cache[require.resolve(mpath)];
var m2 = require(mpath);
setVals({ 'pd-km': '10', 'pd-days': '20', 'pd-kmcost': '0.9', 'pd-parking': '30', 'pd-ticket': 59.85, 'pd-taxrate': '42' });
m2.run();
var out2 = elements['tool-output'].innerHTML;
// EN ticket note must be English (bug fix): Job ticket
assert(out2.indexOf('Job ticket (5% discount') >= 0, 'EN ticket note English');
assert(out2.indexOf('Jobticket') === -1, 'no German ticket note in EN');
// dynamic label 0,9 €/km
assert(out2.indexOf('0.9 €/km') >= 0, 'dynamic km label EN');

// --- Case 3: taxrate 0 -> no tax block ---
global.window = { __siteLang: 'de' };
setVals({ 'pd-km': '15', 'pd-days': '21', 'pd-kmcost': '0.35', 'pd-parking': '0', 'pd-ticket': 63, 'pd-taxrate': '0' });
m.run();
var out3 = elements['tool-output'].innerHTML;
assert(out3.indexOf('Steuerersparnis') === -1, 'no tax block when rate 0');

console.log('ALL PENDEL TESTS PASS');
