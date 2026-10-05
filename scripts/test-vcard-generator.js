// scripts/test-vcard-generator.js | node unit tests for the vcard-generator engine
// Stubs window/document so the IIFE loads via new Function, then asserts on the
// exported pure buildVCard() and qrText(). Node built-ins only.
// Run: node scripts/test-vcard-generator.js
'use strict';

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'assets', 'js', 'vcard-generator.js'),
  'utf8'
);

// --- stub globals for the IIFE ---
const winStub = {
  __siteLang: 'de',
  esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
};
const docStub = {
  readyState: 'complete',
  addEventListener: function () {},
  getElementById: function () { return null; },
  createElement: function () { return { style: {} }; }
};

let exported = {};
const moduleStub = { exports: exported };
new Function('module', 'exports', 'document', 'window', SRC)(
  moduleStub,
  moduleStub.exports,
  docStub,
  winStub
);
// module.exports inside the IIFE is REASSIGNED to a fresh object, so read it
// back off the module stub rather than the original reference.
const m = moduleStub.exports;

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

// --- exports present ---
['buildVCard', 'qrText', 'escapeVCard', 'foldLine'].forEach(function (k) {
  ok(typeof m[k] === 'function', 'exports.' + k + ' is a function');
});

// --- basic vCard 3.0 structure ---
const data = {
  firstName: 'Max',
  lastName: 'Mustermann',
  org: 'Beispiel GmbH',
  title: 'Geschäftsführer',
  phone: '+49 30 123456',
  mobile: '+49 170 123456',
  email: 'max@beispiel.de',
  website: 'https://beispiel.de',
  street: 'Musterstraße 1',
  zip: '10115',
  city: 'Berlin',
  country: 'Deutschland',
  note: 'Termine nach Absprache'
};

const vcf = m.buildVCard(data, '3.0');
ok(vcf.startsWith('BEGIN:VCARD\r\n'), 'starts with BEGIN:VCARD');
ok(/^VERSION:3\.0\r\n/m.test(vcf), 'contains VERSION:3.0');
ok(/^FN:Max Mustermann\r\n/m.test(vcf), 'contains FN line');
ok(/^N:Mustermann;Max;;;\r\n/m.test(vcf), 'contains N line (Last;First)');
ok(/^ORG:Beispiel GmbH\r\n/m.test(vcf), 'contains ORG');
ok(/^TEL;TYPE=WORK:\+49 30 123456\r\n/m.test(vcf), 'contains TEL work');
ok(/^EMAIL;TYPE=INTERNET:max@beispiel\.de\r\n/m.test(vcf), 'contains EMAIL');
ok(/^URL:https:\/\/beispiel\.de\r\n/m.test(vcf), 'contains URL');
ok(/^ADR;TYPE=WORK:;;Musterstraße 1;Berlin;;10115;Deutschland\r\n/m.test(vcf), 'contains ADR with the 7-part layout');
ok(vcf.endsWith('END:VCARD\r\n'), 'ends with END:VCARD');
ok(vcf.split('\r\n').join('').indexOf('\n') === -1, 'uses CRLF (no bare LF) line endings');

// --- escaping of injected semicolon / backslash / comma ---
const BS = String.fromCharCode(92); // backslash, avoids literal-escape ambiguity
const evil = { lastName: 'Müller;Dietrich', note: 'a,b ' + BS + ' c\nnewline' };
const evcf = m.buildVCard(evil, '3.0');
ok(evcf.indexOf('N:Müller' + BS + ';Dietrich;;;;\r\n') !== -1, 'escapes a semicolon in a value (N field)');
ok(evcf.indexOf('a' + BS + ',b ' + BS + BS + ' c' + BS + 'nnewline') !== -1, 'escapes comma, backslash and newline in the note');
ok(!/^N:;/.test(evcf), 'N line keeps both name parts once escaped');

// --- long value gets folded at 75 bytes with a space continuation ---
const longNote = new Array(120).join('x'); // 119 chars
const fvcf = m.buildVCard({ firstName: 'A', lastName: 'B', note: longNote }, '3.0');
const noteLineMatch = fvcf.match(/^NOTE:.*(?:\r\n .*)*$/m);
ok(!!noteLineMatch, 'NOTE line found for folding test');
const noteFolded = noteLineMatch ? noteLineMatch[0] : '';
ok(/^\r\n /m.test(fvcf) || noteFolded.indexOf('\r\n ') >= 0, 'long value is folded with CRLF + space continuation');
ok(noteFolded.length > 75, 'folded physical line(s) exceed a single 75-byte line');
// each physical line (after the leading continuation space) <= 75 octets
const phys = fvcf.split('\r\n');
let allUnder75 = true;
for (let i = 0; i < phys.length; i++) {
  const len = Buffer.byteLength(phys[i].replace(/^ /, ''), 'utf8');
  if (len > 75) { allUnder75 = false; console.log('    too long (' + len + '): ' + phys[i].slice(0, 40)); }
}
ok(allUnder75, 'every logical line is <= 75 octets after unfolding the continuation space');

// --- empty fields: line omitted, FN still emitted (org fallback) ---
const minimal = { org: 'ACME' };
const mvcf = m.buildVCard(minimal, '3.0');
ok(/^FN:ACME\r\n/m.test(mvcf), 'FN falls back to org when no names given');
ok(!/^TEL/.test(mvcf), 'TEL omitted when empty');
ok(!/^ADR/.test(mvcf), 'ADR omitted when address empty');

// --- photo: base64 line present only when provided ---
const photo = m.buildVCard({ firstName: 'A', lastName: 'B', photo: 'aGVsbG8=' }, '3.0');
ok(/^PHOTO;ENCODING=b;TYPE=JPEG:aGVsbG8=/m.test(photo), 'vCard 3.0 photo line with ENCODING=b;TYPE=JPEG');
const nophoto = m.buildVCard({ firstName: 'A', lastName: 'B' }, '3.0');
ok(!/^PHOTO/.test(nophoto), 'no PHOTO line when no photo given');

// --- vCard 4.0 (RFC 6350): lower-case type params, image/jpeg ---
const v4 = m.buildVCard(data, '4.0');
ok(/^VERSION:4\.0\r\n/m.test(v4), 'vCard 4.0 contains VERSION:4.0');
ok(/^TEL;TYPE=work:/m.test(v4), 'vCard 4.0 uses lower-case work type param');
ok(/^EMAIL;TYPE=work:/m.test(v4), 'vCard 4.0 lower-case email param');
const photo4 = m.buildVCard({ firstName: 'A', lastName: 'B', photo: 'aGVsbG8=' }, '4.0');
ok(/^PHOTO;ENCODING=b;TYPE=image\/jpeg:aGVsbG8=/m.test(photo4), 'vCard 4.0 photo type is image/jpeg');
ok(v4.startsWith('BEGIN:VCARD\r\n') && v4.endsWith('END:VCARD\r\n'), 'vCard 4.0 CRLF structure intact');

// --- qrText: essential fields, no photo, always non-empty ---
const qr = m.qrText(data);
ok(typeof qr === 'string' && qr.length > 0, 'qrText returns a non-empty string');
ok(/^BEGIN:VCARD\r\n/m.test(qr) && /^END:VCARD\r\n$/m.test(qr), 'qrText is a vCard structure');
ok(/^FN:Max Mustermann\r\n/m.test(qr), 'qrText includes FN');
ok(!/^PHOTO/.test(qr), 'qrText excludes the photo');
ok(!/^NOTE/.test(qr), 'qrText excludes the note');
ok(qr.length <= 2953, 'qrText fits a QR V40 byte-mode capacity (' + qr.length + ' bytes)');

// --- qrText with only names is still non-empty ---
const qrMin = m.qrText({ lastName: 'Lee' });
ok(qrMin.length > 0 && /^FN:Lee\r\n/m.test(qrMin), 'qrText non-empty with minimal data');

// --- localization-independent pure output ---
ok(vcf.indexOf('—') === -1, 'no em dashes in generated copy');

console.log('\nvcard-generator: ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) { process.exit(1); }
console.log('vcard-generator: ALL TESTS GREEN');
