/* Node unit tests for robots-txt-generator pure engine (DOM stubbed). */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({ innerHTML: '', value: '', checked: false, appendChild(){}, removeChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){}, value:'' }; }, querySelectorAll(){ return []; } });
global.document = {
  readyState: 'complete',
  getElementById: () => el(),
  createElement: () => ({ style:{}, className:'', addEventListener(){}, querySelector(){ return { addEventListener(){} }; }, innerHTML:'' }),
  addEventListener(){},
};
global.window = {};

const src = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/robots-txt-generator.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', src)(mod, mod.exports, global.document, global.window);
const { buildRobots, isValidPath, norm } = mod.exports;

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

// --- norm ---
assert('norm trims', norm('  x  ') === 'x');

// --- buildRobots basic ---
{
  const txt = buildRobots({ userAgents: ['*'], rules: [{ type: 'disallow', path: '/admin/' }], host: 'beispiel.de' });
  assert('user-agent *', txt.indexOf('User-agent: *') !== -1);
  assert('disallow /admin/', txt.indexOf('Disallow: /admin/') !== -1);
  assert('host line', txt.indexOf('beispiel.de') !== -1);
}

// --- buildRobots multiple agents + allow ---
{
  const txt = buildRobots({
    userAgents: ['Googlebot', 'Bingbot'],
    rules: [{ type: 'allow', path: '/public/', userAgent: 'Googlebot' }, { type: 'disallow', path: '/tmp/', userAgent: '*' }]
  });
  assert('two user agents', txt.indexOf('User-agent: Googlebot') !== -1 && txt.indexOf('User-agent: Bingbot') !== -1);
  assert('allow rule', txt.indexOf('Allow: /public/') !== -1);
  assert('disallow rule', txt.indexOf('Disallow: /tmp/') !== -1);
}

// --- buildRobots default ua when empty ---
{
  const txt = buildRobots({ userAgents: [] });
  assert('default *', txt.indexOf('User-agent: *') !== -1);
}

// --- buildRobots sitemap ---
{
  const txt = buildRobots({ rules: [], sitemap: 'https://beispiel.de/sitemap.xml' });
  assert('sitemap line', txt.indexOf('Sitemap: https://beispiel.de/sitemap.xml') !== -1);
}

// --- buildRobots empty rules gives bare Disallow ---
{
  const txt = buildRobots({ userAgents: ['*'], rules: [] });
  assert('no rules -> bare Disallow', txt.indexOf('Disallow:') !== -1);
}

// --- isValidPath ---
assert('valid /path', isValidPath('/admin') === true);
assert('invalid no slash', isValidPath('admin') === false);
assert('empty valid', isValidPath('') === true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
