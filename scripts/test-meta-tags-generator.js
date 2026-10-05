/* Node unit tests for meta-tags-generator pure engine (DOM stubbed). */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({ innerHTML: '', value: '', checked: false, appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; }, select(){} });
global.document = {
  readyState: 'complete',
  getElementById: () => el(),
  createElement: () => el(),
  addEventListener(){},
};
global.window = {};

const src = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/meta-tags-generator.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', src)(mod, mod.exports, global.document, global.window);
const { buildMeta, normalize } = mod.exports;

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

// --- normalize ---
assert('normalize trims', normalize('  abc  ') === 'abc');
assert('normalize empty', normalize(null) === '');

// --- buildMeta basic ---
{
  const r = buildMeta({ title: 'Mein Titel', description: 'Meine Beschreibung', canonical: 'https://beispiel.de/', lang: 'de' });
  assert('title tag present', r.html.indexOf('<title>Mein Titel</title>') !== -1);
  assert('description meta present', r.html.indexOf('name="description" content="Meine Beschreibung"') !== -1);
  assert('canonical present', r.html.indexOf('rel="canonical" href="https://beispiel.de/"') !== -1);
  assert('utf-8 charset', r.html.indexOf('charset="utf-8"') !== -1);
  assert('og:locale de_DE', r.html.indexOf('og:locale" content="de_DE"') !== -1);
  assert('count > 5', r.count > 5);
}

// --- buildMeta escaping ---
{
  const r = buildMeta({ title: 'A "Quote" & <Tag>' });
  assert('title escaped', r.html.indexOf('A &quot;Quote&quot; &amp; &lt;Tag&gt;') !== -1);
}

// --- buildMeta noindex ---
{
  const r = buildMeta({ title: 'x', noindex: true });
  assert('noindex robots', r.html.indexOf('noindex, nofollow') !== -1);
  const r2 = buildMeta({ title: 'x', noindex: false });
  assert('index robots', r2.html.indexOf('index, follow') !== -1);
}

// --- buildMeta lengths ---
{
  const r = buildMeta({ title: '12345', description: 'abcdefgh' });
  assert('titleLen 5', r.titleLen === 5);
  assert('descLen 8', r.descLen === 8);
}

// --- lang en ---
{
  const r = buildMeta({ title: 'x', lang: 'en' });
  assert('og:locale en_US', r.html.indexOf('og:locale" content="en_US"') !== -1);
}

// --- empty title/desc still builds with charset etc ---
{
  const r = buildMeta({});
  assert('empty builds charset', r.html.indexOf('charset="utf-8"') !== -1);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
