/* Node unit + output test for kredit-rechner.js.
   Verifies the annuity formula, term-from-monthly, the too-low-rate guard,
   the amortization schedule, and the rendered output (2-decimal monthly rate
   + source-dated reference-rate note in the setup hint). */
'use strict';
const path = require('path');

const elements = {};
global.window = { __siteLang: 'de' };
global.document = {
  readyState: 'complete',
  addEventListener: function(){},
  getElementById: function(id){
    if (!elements[id]) elements[id] = { value:'', checked:false, style:{}, innerHTML:'', appendChild:function(){}, addEventListener:function(){} };
    return elements[id];
  },
  createElement: function(){ return { style:{}, appendChild:function(){}, addEventListener:function(){} }; }
};

function mk(id){ if (!elements[id]) elements[id] = { value:'', checked:false, style:{}, innerHTML:'', appendChild:function(){}, addEventListener:function(){} }; return elements[id]; }
['tool-output','tool-inputs'].forEach(mk);

const m = require(path.resolve(__dirname, '../public/assets/js/kredit-rechner.js'));

let fail = 0;
function check(name, ok, msg){
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (ok ? '' : ' | ' + msg));
  if (!ok) fail++;
}

// --- Pure function tests (SEO worked example: 20000 @ 5% / 5y = 377.42) ---
const monthly = m.annuity(20000, 5, 60);
check('annuity 20k@5%/5y = 377.42', Math.abs(monthly - 377.42) < 0.01, 'got ' + monthly);
check('total ~22645', Math.abs(monthly*60 - 22645.2) < 2, 'got ' + (monthly*60));
check('interest ~2645', Math.abs(monthly*60 - 20000 - 2645.2) < 2, 'got ' + (monthly*60-20000));

const t = m.termFromMonthly(20000, 5, monthly);
check('termFromMonthly(rate) ~60 months', t.ok && t.months === 60, JSON.stringify(t));

const low = m.termFromMonthly(10000, 10, 50); // 10000*0.10/12=83.3 > 50
check('too-low rate flagged notFeasible', low.ok === false, JSON.stringify(low));

const sch = m.schedule(20000, 5, monthly);
check('schedule repays to 0', sch.length > 0 && sch[sch.length-1].remaining <= 0,
  'last remaining=' + (sch.length ? sch[sch.length-1].remaining : 'empty'));

// --- Rendered run() output (2-decimal monthly rate) ---
function set(id, v){ mk(id).value = String(v); }
set('kr-amount', '20000');
set('kr-rate', '5');
set('kr-term', '5');
set('kr-mode', 'term');
m.run();
const out = elements['tool-output'].innerHTML;
check('output shows 2-decimal rate 377,42', out.includes('377,42'), 'monthly not found with cents');
check('output shows Gesamtzinsen', /Gesamtzinsen/.test(out), 'missing');
check('output shows Tilgungsplan table', /Tilgungsplan/.test(out), 'missing');

// --- Setup hint includes the source-dated reference-rate note ---
m.setup();
const out2 = elements['tool-output'].innerHTML;
check('setup outputs reference-rate note', /Stand September 2026/.test(out2) && /Ratenkredit/.test(out2),
  'refNote missing in setup hint');

if (fail){ console.error('FAILURES:', fail); process.exit(1); }
console.log('ALL PASS');
