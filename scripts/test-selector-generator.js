/* Unit tests for the CSS Selector Generator engine (buildPath + selectableElements).
 * Run: node scripts/test-selector-generator.js
 *
 * buildPath/selectableElements are pure and depend only on a minimal DOM-like
 * node shape (tagName/nodeType/id/classList/parentElement/children), so they
 * run fine in Node without a browser/DOMParser.
 */
const assert = require('assert');
const S = require('../public/assets/js/selector-generator.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.error('FAIL: ' + name + '\n  ' + e.message); }
}

/* Minimal fake element factory. */
function mkTag(tag, opts) {
  opts = opts || {};
  const el = {
    tagName: tag.toUpperCase(),
    nodeType: 1,
    id: opts.id || '',
    classList: opts.classNames || [],
    children: [],
    parentElement: null,
    attributes: []
  };
  (opts.children || []).forEach((c) => { c.parentElement = el; el.children.push(c); });
  return el;
}

function mkDoc(bodyChildren) {
  // Auto-generated wrapper, as a parsed snippet would produce.
  const body = mkTag('body', { children: bodyChildren });
  const head = mkTag('head', {});
  const html = mkTag('html', { children: [head, body] });
  return { html, head, body, all: [html, head, body].concat(bodyChildren) };
}

// ---- selectableElements: wrapper tags are cut out ----
t('selectableElements skips html/head/body', () => {
  const { all } = mkDoc([mkTag('div'), mkTag('p')]);
  const sel = S.selectableElements(all);
  assert.strictEqual(sel.length, 2);
  assert.strictEqual(sel[0].tagName, 'DIV');
  assert.strictEqual(sel[1].tagName, 'P');
});

t('selectableElements skips script/style too', () => {
  const { all } = mkDoc([mkTag('script'), mkTag('span'), mkTag('style')]);
  const sel = S.selectableElements(all);
  assert.strictEqual(sel.length, 1);
  assert.strictEqual(sel[0].tagName, 'SPAN');
});

t('selectableElements keeps media/embed elements, skips wrappers + base/link/script/style', () => {
  const { all } = mkDoc([
    mkTag('html'), mkTag('head'), mkTag('body'),
    mkTag('iframe'), mkTag('video'), mkTag('audio'), mkTag('link'),
    mkTag('base'), mkTag('source'), mkTag('object'), mkTag('embed'),
    mkTag('div'), mkTag('img')
  ]);
  const sel = S.selectableElements(all);
  assert.deepStrictEqual(sel.map(e => e.tagName).sort(),
    ['AUDIO', 'DIV', 'EMBED', 'IFRAME', 'IMG', 'OBJECT', 'SOURCE', 'VIDEO']);
});

t('selectableElements null/empty -> []', () => {
  assert.strictEqual(S.selectableElements(null).length, 0);
  assert.strictEqual(S.selectableElements([]).length, 0);
});

// ---- buildPath: wrapper prefix is stripped ----
t('buildPath strips html/body wrapper prefix', () => {
  const span = mkTag('span', {});
  const div = mkTag('div', { children: [span] });
  const section = mkTag('section', { classNames: ['card'], children: [div] });
  const { body } = mkDoc([section]);
  assert.strictEqual(S.buildPath(span), 'section.card > div > span');
});

t('buildPath keeps descendant path up to an id ancestor', () => {
  const inner = mkTag('b');
  const section = mkTag('section', { children: [inner] });
  const app = mkTag('div', { id: 'app', children: [section] });
  const { body } = mkDoc([app]);
  assert.strictEqual(S.buildPath(inner), '#app > section > b');
  // The id'd element itself collapses to just #id.
  assert.strictEqual(S.buildPath(app), '#app');
});

t('buildPath emits nth-child on sibling collisions', () => {
  const li3 = mkTag('li');
  const li2 = mkTag('li', { children: [li3] });
  const li1 = mkTag('li');
  const ul = mkTag('ul', { children: [li1, li2, li3] });
  const div = mkTag('div', { children: [ul] });
  const { body } = mkDoc([div]);
  // li2 is the 2nd li among its siblings.
  assert.strictEqual(S.buildPath(li2), 'div > ul > li:nth-child(2)');
  assert.strictEqual(S.buildPath(li3), 'div > ul > li:nth-child(3)');
});

t('buildPath null for non-element', () => {
  assert.strictEqual(S.buildPath(null), null);
  assert.strictEqual(S.buildPath({ nodeType: 3 }), null);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
