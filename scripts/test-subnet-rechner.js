/* Node unit tests for subnet-rechner pure engine (DOM stubbed). */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({ innerHTML: '', value: '', style: {}, disabled: false,
  appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; } });
global.document = { readyState: 'complete', getElementById: () => el(), createElement: () => el(), addEventListener(){} };
global.window = { __siteLang: 'de' };

const src = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/subnet-rechner.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', src)(mod, mod.exports, global.document, global.window);
const D = mod.exports;

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
function eq(a, b, name) { assert(name, a === b); }

// parseIPv4
eq(JSON.stringify(D.parseIPv4('192.168.1.0')), '[192,168,1,0]', 'parseIPv4 basic');
eq(D.parseIPv4('999.1.1.1'), null, 'parseIPv4 rejects >255');
eq(D.parseIPv4('1.2.3'), null, 'parseIPv4 rejects 3 parts');
eq(D.parseIPv4('a.b.c.d'), null, 'parseIPv4 rejects non-numeric');

// /24
{
  const r = D.calcSubnet([192,168,1,0], 24);
  eq(r.network, '192.168.1.0', '/24 network');
  eq(r.mask, '255.255.255.0', '/24 mask');
  eq(r.wildcard, '0.0.0.255', '/24 wildcard');
  eq(r.broadcast, '192.168.1.255', '/24 broadcast');
  eq(r.firstHost, '192.168.1.1', '/24 first host');
  eq(r.lastHost, '192.168.1.254', '/24 last host');
  eq(r.usableHosts, 254, '/24 usable 254');
  eq(r.totalAddresses, 256, '/24 total 256');
}
// /30
{
  const r = D.calcSubnet([192,168,1,0], 30);
  eq(r.network, '192.168.1.0', '/30 network');
  eq(r.broadcast, '192.168.1.3', '/30 broadcast');
  eq(r.firstHost, '192.168.1.1', '/30 first');
  eq(r.lastHost, '192.168.1.2', '/30 last');
  eq(r.usableHosts, 2, '/30 usable 2');
}
// /31 RFC 3021 (point-to-point: 2 usable)
{
  const r = D.calcSubnet([192,168,1,0], 31);
  eq(r.usableHosts, 2, '/31 usable 2');
  eq(r.firstHost, '192.168.1.0', '/31 first = network');
  eq(r.lastHost, '192.168.1.1', '/31 last = broadcast');
  eq(r.broadcast, '192.168.1.1', '/31 broadcast');
}
// /32 single host
{
  const r = D.calcSubnet([192,168,1,5], 32);
  eq(r.usableHosts, 1, '/32 usable 1');
  eq(r.network, '192.168.1.5', '/32 network = ip');
  eq(r.firstHost, '192.168.1.5', '/32 first host');
}
// /25 boundary
{
  const r = D.calcSubnet([192,168,1,0], 25);
  eq(r.broadcast, '192.168.1.127', '/25 broadcast');
  eq(r.usableHosts, 126, '/25 usable 126');
}
// 10.0.0.5/8
{
  const r = D.calcSubnet([10,0,0,5], 8);
  eq(r.network, '10.0.0.0', '/8 network');
  eq(r.broadcast, '10.255.255.255', '/8 broadcast');
  eq(r.totalAddresses, 16777216, '/8 total 2^24');
  eq(r.usableHosts, 16777214, '/8 usable');
}
// resolvePrefix
eq(D.resolvePrefix('24').prefix, 24, 'prefix number 24');
eq(D.resolvePrefix('/24').prefix, 24, 'prefix /24');
eq(D.resolvePrefix('255.255.255.0').prefix, 24, 'dotted mask 255.255.255.0 -> /24');
eq(D.resolvePrefix('255.255.255.240').prefix, 28, 'dotted mask .240 -> /28');
eq(D.resolvePrefix('/0').prefix, 0, 'prefix /0');
assert('"300" -> error', !!D.resolvePrefix('300').error);
assert('non-contiguous mask rejected', !!D.resolvePrefix('255.0.255.0').error);
// classify
assert('10/8 -> Privat', D.classifyIPv4([10,0,0,1]).label.indexOf('Privat') !== -1);
assert('192.168/16 -> Privat', D.classifyIPv4([192,168,1,1]).label.indexOf('Privat') !== -1);
assert('100.64 -> CGNAT', D.classifyIPv4([100,64,0,1]).label.indexOf('CGNAT') !== -1);
assert('169.254 -> Link-Local', D.classifyIPv4([169,254,0,1]).label.indexOf('Link-Local') !== -1);
assert('127 -> Loopback', D.classifyIPv4([127,0,0,1]).label.indexOf('Loopback') !== -1);
assert('8.8.8.8 -> Öffentlich', D.classifyIPv4([8,8,8,8]).label === 'Öffentlich');
assert('224 -> Multicast', D.classifyIPv4([224,0,0,1]).label.indexOf('Multicast') !== -1);
// mask helpers
eq(D.prefixToMask(24), 0xffffff00, 'prefixToMask(24)');
eq(D.maskToPrefix(0xffffff00), 24, 'maskToPrefix(0xffffff00)');
eq(D.maskToPrefix(0xffffffff), 32, 'maskToPrefix(/32)');
assert('isContiguous 255.255.255.0', D.isContiguousMask(0xffffff00));
assert('not contiguous 255.0.255.0', !D.isContiguousMask(0xff00ff00));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
