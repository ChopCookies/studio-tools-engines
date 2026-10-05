/* Node unit tests for text-diff pure engine (DOM stubbed). */
'use strict';
const fs = require('fs');
const path = require('path');

// Minimal DOM stub so require() doesn't throw on buildUI()
const el = () => ({ innerHTML: '', value: '', appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; } });
global.document = {
  readyState: 'complete',
  getElementById: () => el(),
  createElement: () => el(),
  addEventListener() {},
};
global.window = {};

const src = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/text-diff.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', src)(mod, mod.exports, global.document, global.window);
const { diffTexts, toLines, count } = mod.exports;

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

// --- toLines ---
assert('toLines splits plain', JSON.stringify(toLines('a\nb\nc')) === JSON.stringify(['a','b','c']));
assert('toLines no trailing empty on \\n end', JSON.stringify(toLines('a\nb\n')) === JSON.stringify(['a','b']));
assert('toLines empty string', JSON.stringify(toLines('')) === JSON.stringify([]));

// --- diff: identical texts -> all same ---
{
  const ops = diffTexts('a\nb\nc', 'a\nb\nc');
  const c = count(ops);
  assert('identical -> 3 same', c.same === 3 && c.add === 0 && c.del === 0);
}

// --- diff: one added line ---
{
  const ops = diffTexts('a\nb', 'a\nX\nb');
  const c = count(ops);
  assert('added line detected', c.add === 1 && c.del === 0 && c.same === 2);
  const added = ops.find(o => o.type === 'add');
  assert('added line content correct', added && added.line === 'X');
}

// --- diff: one removed line ---
{
  const ops = diffTexts('a\nb\nc', 'a\nc');
  const c = count(ops);
  assert('removed line detected', c.del === 1 && c.add === 0 && c.same === 2);
}

// --- diff: changed line (+1 -1) ---
{
  const ops = diffTexts('a\nB\nc', 'a\nb\nc');
  const c = count(ops);
  assert('change = 1 add + 1 del', c.add === 1 && c.del === 1 && c.same === 2);
}

// --- diff: empty vs content ---
{
  const ops = diffTexts('', 'x\ny');
  const c = count(ops);
  assert('empty->content all add', c.add === 2 && c.same === 0 && c.del === 0);
}

// --- diff: content vs empty ---
{
  const ops = diffTexts('x\ny', '');
  const c = count(ops);
  assert('content->empty all del', c.del === 2 && c.same === 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
