/* Node unit tests for netzwerk-port-nachschlagewerk pure engine (DOM stubbed). */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({ innerHTML: '', value: '', style: {}, disabled: false,
  appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; } });
global.document = { readyState: 'complete', getElementById: () => el(), createElement: () => el(), addEventListener(){} };
global.window = { __siteLang: 'de' };

const src = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/netzwerk-port-nachschlagewerk.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', src)(mod, mod.exports, global.document, global.window);
const D = mod.exports;

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
function eq(a, b, name) { assert(name, a === b); }

// export contract
assert('exports searchPorts', typeof D.searchPorts === 'function');
assert('exports portInfo', typeof D.portInfo === 'function');
assert('dataset has at least 70 entries', Array.isArray(D.PORTS) && D.PORTS.length >= 70);

// dataset sanity
{
  let dupes = 0, bad = 0;
  const seen = {};
  for (const p of D.PORTS) {
    const key = p.port + '/' + p.proto;
    if (seen[key]) dupes++;
    seen[key] = true;
    if (typeof p.port !== 'number' || p.port < 0 || p.port > 65535) bad++;
    if (typeof p.name !== 'string' || p.name.length === 0) bad++;
    if (['tcp','udp','tcp/udp'].indexOf(p.proto) === -1) bad++;
    if (typeof p.desc !== 'string' || p.desc.length === 0) bad++;
  }
  eq(bad, 0, 'all entries well formed (port/name/proto/desc)');
  eq(dupes, 0, 'no duplicate port+proto pairs');
}

// exact port lookups
{
  const r = D.searchPorts('443', 'all');
  eq(r.length, 1, "port '443' has exactly one match");
  eq(r[0].name, 'https', "port '443' -> https");
  eq(r[0].proto, 'tcp', "port '443' is tcp");
}
{
  const r = D.searchPorts('22', 'all');
  eq(r.length, 1, "port '22' has exactly one match");
  eq(r[0].name, 'ssh', "port '22' -> ssh");
}
{
  const r = D.searchPorts('80', 'all');
  eq(r.length, 1, "port '80' has exactly one match");
  eq(r[0].name, 'http', "port '80' -> http");
}
{
  const r = D.searchPorts(' 3306 ', 'all');
  eq(r.length, 1, "port ' 3306 ' tolerates whitespace");
  eq(r[0].name, 'mysql', "port '3306' -> mysql");
}

// service-name search (substring, case-insensitive)
{
  const r = D.searchPorts('mysql', 'all');
  assert("service-name 'mysql' returns rows", r.length > 0);
  assert("service-name 'mysql' includes the MySQL row",
    r.some(x => x.port === 3306 && x.name === 'mysql'));
}
{
  const r = D.searchPorts('SSH', 'all');
  assert("service-name 'SSH' matches (case-insensitive)", r.length > 0);
  eq(r[0].port, 22, "service-name 'SSH' -> port 22 first");
  assert("service-name 'SSH' is a substring match (includes ssh-alt)",
    r.some(x => x.port === 22) && r.some(x => x.name === 'ssh-alt'));
}
{
  const r = D.searchPorts('ht', 'all');
  assert("substring 'ht' matches several services", r.length > 1);
  assert("substring 'ht' includes http", r.some(x => x.name === 'http'));
}
{
  const r = D.searchPorts('smtp', 'all');
  assert("service-name 'smtp' matches", r.length > 0);
  assert("service-name 'smtp' includes port 25", r.some(x => x.port === 25));
}

// unknown port: no exact match but a hint
{
  const r = D.searchPorts('65123', 'all');
  eq(r.length, 0, "unknown port '65123' returns no exact match");
  assert("unknown port '65123' carries a hint",
    typeof r.hint === 'string' && r.hint.indexOf('kein bekannter Standardport') !== -1);
}

// no false positives for empty query
{
  const r = D.searchPorts('', 'all');
  eq(r.length, 0, "empty query returns no rows");
  eq(r.length, D.searchPorts('   ', 'all').length, "whitespace-only query also returns no rows");
  eq(D.searchPorts(null, 'all').length, 0, "null query returns no rows");
  eq(D.searchPorts(undefined, 'all').length, 0, "undefined query returns no rows");
  assert('empty query carries a hint', typeof r.hint === 'string' && r.hint.length > 0);
}

// protocol filter
{
  const all = D.searchPorts('http', 'all');
  const onlyTcp = D.searchPorts('http', 'tcp');
  const onlyUdp = D.searchPorts('http', 'udp');
  assert("filter tcp keeps tcp/tcp-udp rows", onlyTcp.length >= 1 && onlyTcp.every(x => x.proto === 'tcp' || x.proto === 'tcp/udp'));
  assert("filter tcp excludes udp-only rows", onlyTcp.every(x => x.proto !== 'udp'));
  assert("filter udp excludes tcp-only rows", onlyUdp.every(x => x.proto !== 'tcp'));
  assert('filter all is not narrower than tcp', all.length >= onlyTcp.length);
  const dnsTcp = D.searchPorts('53', 'tcp');
  const dnsUdp = D.searchPorts('53', 'udp');
  eq(dnsTcp.length, 1, "port '53' present under tcp filter (tcp/udp entry)");
  eq(dnsUdp.length, 1, "port '53' present under udp filter (tcp/udp entry)");
  const ntpTcp = D.searchPorts('123', 'tcp');
  const ntpUdp = D.searchPorts('123', 'udp');
  eq(ntpTcp.length, 0, "udp-only port '123' excluded by tcp filter");
  eq(ntpUdp.length, 1, "udp-only port '123' present under udp filter");
  const sshUdp = D.searchPorts('22', 'udp');
  eq(sshUdp.length, 0, "tcp-only port '22' excluded by udp filter");
}

// no cross-matching by port digit text in the name column
{
  const r = D.searchPorts('443', 'tcp');
  assert("port query does not fall through to name search", r.every(x => x.port === 443));
}

// portInfo helper
{
  eq(D.portInfo(443).name, 'https', 'portInfo(443)');
  eq(D.portInfo('22').name, 'ssh', "portInfo('22')");
  eq(D.portInfo(65123), null, 'portInfo unknown returns null');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);