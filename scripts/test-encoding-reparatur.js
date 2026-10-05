/* Node unit test for encoding-reparatur.js (pure repairText engine).
   Script-only, deploy-excluded (lives in scripts/). */
'use strict';
const fs = require('fs');
const path = require('path');

/* Minimal DOM stub so the IIFE's E()/buildUI() don't throw on load. */
function mkEl(id) {
  return {
    id: id, value: '', textContent: '', innerHTML: '', className: '', type: '',
    style: {}, rows: 7, placeholder: '',
    addEventListener: function () {},
    querySelector: function () { return mkEl('__btn__'); }
  };
}
const documentStub = {
  readyState: 'complete',
  getElementById: function (id) { return mkEl(id); },
  addEventListener: function () {},
  createElement: function () { return mkEl('__new__'); }
};
const windowStub = { esc: function (s) { return String(s); } };

const SRC = path.join(__dirname, '..', 'public', 'assets', 'js', 'encoding-reparatur.js');
const src = fs.readFileSync(SRC, 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', src)(
  mod, mod.exports, documentStub, windowStub
);
const repairText = mod.exports.repairText;

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

/* Mojibake-Eingaben als echte UTF-8-Bytes in der Quelldatei kodiert. */
const M_GRUESSE = 'GrÃ¼ÃŸe';                       // GrÃ¼ÃŸe
const M_RUECK = 'RÃ¼ckmeldung';               // RÃ¼ckmeldung
const M_EURO = 'â‚¬';                             // â‚¬
const CLEAN_SENTENCE = 'Die Größe beträgt 12 Euro, ça va.';
const ASCII = 'Multiplexing / ca. 3 Monate / Port 8080';

console.log('repairText: Standard-Umlaute (allgemeiner UTF-8-Algorithmus)');
let r = repairText(M_GRUESSE);
assert('GrÃ¼ÃŸe enthaelt "ü"', r.fixed.indexOf('ü') !== -1);
assert('GrÃ¼ÃŸe enthaelt "ß"', r.fixed.indexOf('ß') !== -1);
assert('GrÃ¼ÃŸe ist exakt "Grüße"', r.fixed === 'Grüße');
assert('GrÃ¼ÃŸe changed=true', r.changed === true);
assert('GrÃ¼ÃŸe kind gemeldet', typeof r.kind === 'string' && r.kind.length > 0);

/* eigener Fall mit echtem "ä": BÃ¤ckerei -> Bäckerei */
r = repairText('BÃ¤ckerei');
assert('BÃ¤ckerei -> "Bäckerei"', r.fixed === 'Bäckerei');
assert('BÃ¤ckerei enthaelt "ä"', r.fixed.indexOf('ä') !== -1);
assert('BÃ¤ckerei changed=true', r.changed === true);

r = repairText(M_RUECK);
assert('RÃ¼ckmeldung -> "Rückmeldung"', r.fixed === 'Rückmeldung');
assert('RÃ¼ckmeldung changed=true', r.changed === true);

console.log('repairText: CP1252-Artefakte (kuratierte Karte)');
r = repairText(M_EURO);
assert('â‚¬ -> "€"', r.fixed === '€');
assert('â‚¬ changed=true', r.changed === true);

console.log('repairText: korrekter Text bleibt unveraendert');
r = repairText('Multiplexing');
assert('"Multiplexing" unveraendert', r.fixed === 'Multiplexing');
assert('"Multiplexing" changed=false', r.changed === false);

r = repairText('ca. 3 Monate');
assert('"ca. 3 Monate" unveraendert', r.fixed === 'ca. 3 Monate');
assert('"ca. 3 Monate" changed=false', r.changed === false);

r = repairText(CLEAN_SENTENCE);
assert('korrekter deutscher Satz identisch', r.fixed === CLEAN_SENTENCE);
assert('korrekter deutscher Satz changed=false', r.changed === false);
assert('korrekter deutscher Satz ohne U+FFFD', r.fixed.indexOf('�') === -1);

r = repairText(ASCII);
assert('ASCII-String identisch', r.fixed === ASCII);
assert('ASCII-String changed=false', r.changed === false);

console.log('repairText: Randfaelle');
r = repairText('');
assert('leerer Text -> fixed=""', r.fixed === '');
assert('leerer Text changed=false', r.changed === false);
r = repairText(null);
assert('null -> fixed="" ohne Fehler', r.fixed === '' && r.changed === false);
r = repairText(undefined);
assert('undefined -> fixed="" ohne Fehler', r.fixed === '' && r.changed === false);
r = repairText(42);
assert('Zahl wird zu String', r.fixed === '42');

r = repairText('Der Preis betrÃ¤gt 5 â‚¬ und die GrÃ¼ÃŸe ist gut.');
assert('Mischtext: keine U+FFFD', r.fixed.indexOf('�') === -1);
assert('Mischtext: "beträgt" vorhanden', r.fixed.indexOf('beträgt') !== -1);
assert('Mischtext: "€" vorhanden', r.fixed.indexOf('€') !== -1);
assert('Mischtext: "Grüße" vorhanden', r.fixed.indexOf('Grüße') !== -1);
assert('Mischtext changed=true', r.changed === true);

console.log('repairText: kind ist menschenlesbar (deutsch)');
const KINDEN = ['UTF-8 als Latin-1 gelesen', 'Windows-1252-Artefakte', 'vermutlich bereits korrekt'];
assert('kind von GrÃ¼ÃŸe ist bekannt', KINDEN.indexOf(repairText(M_GRUESSE).kind) !== -1);
assert('kind von â‚¬ ist bekannt', KINDEN.indexOf(repairText(M_EURO).kind) !== -1);
assert('kind von sauberem Text ist bekannt', KINDEN.indexOf(repairText(ASCII).kind) !== -1);
assert('kind von sauberem Text = "vermutlich bereits korrekt"',
  repairText(ASCII).kind === 'vermutlich bereits korrekt');

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail > 0) { console.log('FAIL'); process.exit(1); }
console.log('PASS');
process.exit(0);
