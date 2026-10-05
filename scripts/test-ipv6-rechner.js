/* Node unit tests for ipv6-rechner pure engine (DOM stubbed). */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({ innerHTML: '', value: '', style: {}, disabled: false,
  appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; } });
global.document = { readyState: 'complete', getElementById: () => el(), createElement: () => el(), addEventListener(){} };
global.window = { __siteLang: 'de' };

const src = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/ipv6-rechner.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', src)(mod, mod.exports, global.document, global.window);
const D = mod.exports;

let pass = 0, fail = 0;
function assert(name, cond) { if (cond) { pass++; console.log('  ok ' + name); } else { fail++; console.log('  FAIL ' + name); } }
function eq(a, b, name) { assert(name, a === b); }

// expand / compress 2001:db8::1
{
  const arr = D.parseIPv6('2001:db8::1');
  eq(D.expandIPv6(arr), '2001:0db8:0000:0000:0000:0000:0000:0001', 'expand 2001:db8::1');
  eq(D.compressIPv6(arr), '2001:db8::1', 'compress 2001:db8::1');
}
// ::1
{
  const arr = D.parseIPv6('::1');
  eq(D.expandIPv6(arr), '0000:0000:0000:0000:0000:0000:0000:0001', 'expand ::1');
  eq(D.compressIPv6(arr), '::1', 'compress ::1');
}
// full form stays lowercase
{
  const arr = D.parseIPv6('2001:0DB8:0000:0000:0000:0000:0000:0001');
  eq(D.compressIPv6(arr), '2001:db8::1', 'RFC5952 lowercase/leading-zero drop');
}
// no compression of single zero group
{
  const arr = D.parseIPv6('2001:db8:0:1:2:3:4:5');
  eq(D.compressIPv6(arr), '2001:db8:0:1:2:3:4:5', 'single zero group not compressed');
}
// tie-break: leftmost longest
{
  const arr = [0,0,0,1,0,0,0,1];
  eq(D.compressIPv6(arr), '::1:0:0:0:1', 'leftmost longest zero-run');
}
// validate
assert('valid 2001:db8::1', D.validateIPv6('2001:db8::1').valid === true);
assert('two :: invalid', D.validateIPv6('2001:db8:::1').valid === false);
assert('two :: (1::2::3) invalid', D.validateIPv6('1::2::3').valid === false);
assert('bad hex g001 invalid', D.validateIPv6('g001:db8::1').valid === false);
assert('5-hex group invalid', D.validateIPv6('12345:db8::1').valid === false);
assert('spaces invalid', D.validateIPv6('2001:db8 ::1').valid === false);
assert('zone id tolerated', D.validateIPv6('fe80::1%eth0').valid === true);
assert('brackets tolerated', D.validateIPv6('[2001:db8::1]').valid === true);
assert('reason German for 5-hex', /Hex-Ziffern/.test(D.validateIPv6('12345:db8::1').reason || ''));
// IPv4-mapped
{
  const arr = D.parseIPv6('::ffff:192.168.1.1');
  eq(D.expandIPv6(arr), '0000:0000:0000:0000:0000:ffff:c0a8:0101', 'expand ipv4-mapped');
  assert('classify ipv4-mapped', D.classifyIPv6(arr).indexOf('192.168.1.1') !== -1);
}
// classify IPv6 semantics
eq(D.classifyIPv6([0,0,0,0,0,0,0,0]), 'Nicht spezifiziert (::)', 'unspecified');
eq(D.classifyIPv6([0,0,0,0,0,0,0,1]), 'Loopback (::1)', 'loopback');
assert('ULA fc00::/7', D.classifyIPv6([0xfd00,0,0,0,0,0,0,1]).indexOf('Unique-Local') !== -1);
assert('link-local fe80', D.classifyIPv6([0xfe80,0,0,0,0,0,0,1]).indexOf('Link-Local') !== -1);
assert('multicast ff00', D.classifyIPv6([0xff02,0,0,0,0,0,0,1]).indexOf('Multicast') !== -1);
assert('global', D.classifyIPv6([0x2001,0xdb8,0,0,0,0,0,1]).indexOf('Global') !== -1);
// prefix math (BigInt)
eq(D.prefixMath(48,64).subnets.toString(), '65536', '48->64 = 65536 subnets');
eq(D.prefixMath(56,64).subnets.toString(), '256', '56->64 = 256 subnets');
eq(D.prefixMath(64,64).subnets.toString(), '1', '64->64 = 1');
eq(D.prefixMath(48,64).addressesPerPrefix.toString(), (1n << 64n).toString(), 'addresses per /64 = 2^64');
eq(D.prefixMath(60,64).subnets.toString(), '16', '60->64 = 16 subnets');
assert('toPrefix < fromPrefix null', D.prefixMath(64,48) === null);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
