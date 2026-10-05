/* Node unit tests for picture-element-generator pure engine (DOM stubbed). */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({
  innerHTML: '', value: '', style: {}, disabled: false, checked: false,
  appendChild() {}, addEventListener() {},
  querySelector() { return { addEventListener() {} }; },
  querySelectorAll() { return []; }
});
global.document = {
  readyState: 'complete',
  getElementById: () => el(),
  createElement: () => el(),
  querySelector: () => el(),
  querySelectorAll: () => [],
  addEventListener() {}
};
global.window = { __siteLang: 'de' };
Object.defineProperty(global, 'navigator', {
  value: { clipboard: { writeText() { return Promise.resolve(); } } },
  writable: true, configurable: true
});
global.setTimeout = (fn) => 0;

const src = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/picture-element-generator.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', 'navigator', 'setTimeout', src)(
  mod, mod.exports, global.document, global.window, global.navigator, global.setTimeout);
const D = mod.exports;

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
function eq(a, b, name) { assert(name + ' (got: ' + JSON.stringify(a) + ')', a === b); }

/* ---------- exports ---------- */
assert('buildPicture exported', typeof D.buildPicture === 'function');
assert('srcsetFor exported', typeof D.srcsetFor === 'function');
assert('candidateUrl exported', typeof D.candidateUrl === 'function');

/* ---------- candidateUrl ---------- */
eq(D.candidateUrl('/img/photo.jpg', 800, 'avif'), '/img/photo-800w.avif', 'candidateUrl swaps extension');
eq(D.candidateUrl('/img/photo.jpg', 320, 'webp'), '/img/photo-320w.webp', 'candidateUrl webp');
eq(D.candidateUrl('/img/photo.jpg', 320, 'jpg'), '/img/photo-320w.jpg', 'candidateUrl jpg');
eq(D.candidateUrl('/img/photo', 480, 'avif'), '/img/photo-480w.avif', 'candidateUrl without extension appends');
eq(D.candidateUrl('/img/photo.jpg?v=2#top', 640, 'webp'), '/img/photo-640w.webp?v=2#top', 'candidateUrl keeps query and hash');
eq(D.candidateUrl('https://cdn.tld/foto.png', 1024, 'jpg'), 'https://cdn.tld/foto-1024w.jpg', 'candidateUrl absolute url');

/* ---------- srcsetFor ---------- */
eq(D.srcsetFor('/img/photo.jpg', [320, 800], 'avif'),
  '/img/photo-320w.avif 320w, /img/photo-800w.avif 800w', 'srcsetFor comma joined');
eq(D.srcsetFor('/img/photo.jpg', [800, 320], 'avif'),
  '/img/photo-320w.avif 320w, /img/photo-800w.avif 800w', 'srcsetFor sorts ascending');
eq(D.srcsetFor('/img/photo.jpg', [], 'avif'), '', 'srcsetFor empty widths');
eq(D.srcsetFor('/img/photo.jpg', [320, 320, '480'], 'webp'),
  '/img/photo-320w.webp 320w, /img/photo-480w.webp 480w', 'srcsetFor de-dupes and coerces');

/* ---------- buildPicture: full config ---------- */
const cfg = {
  url: '/img/photo.jpg',
  alt: 'Sonnenaufgang über den Bergen',
  widths: [320, 800, 1280],
  formats: ['avif', 'webp', 'jpg'],
  sizes: '(min-width: 900px) 50vw, 100vw',
  loading: 'lazy',
  fetchpriority: 'high'
};
const out = D.buildPicture(cfg);

assert('output includes <picture>', out.indexOf('<picture>') !== -1);
assert('output includes closing </picture>', out.indexOf('</picture>') !== -1);
assert('includes type="image/avif"', out.indexOf('type="image/avif"') !== -1);
assert('includes type="image/webp"', out.indexOf('type="image/webp"') !== -1);
assert('includes type="image/jpeg"', out.indexOf('type="image/jpeg"') !== -1);
assert('srcset contains every requested width',
  [' 320w', ' 800w', ' 1280w'].every((w) => out.indexOf(w) !== -1));
assert('srcset contains /img/photo-800w.avif', out.indexOf('/img/photo-800w.avif 800w') !== -1);
assert('avif source block ends correctly',
  out.indexOf('<source type="image/avif" srcset="/img/photo-320w.avif 320w, /img/photo-800w.avif 800w, /img/photo-1280w.avif 1280w" sizes="(min-width: 900px) 50vw, 100vw">') !== -1);
assert('sizes attribute applied to sources', out.indexOf('sizes="(min-width: 900px) 50vw, 100vw"') !== -1);
assert('webp source derived urls', out.indexOf('/img/photo-800w.webp 800w') !== -1);
assert('jpeg source derived urls', out.indexOf('/img/photo-800w.jpg 800w') !== -1);

const iAvif = out.indexOf('type="image/avif"');
const iWebp = out.indexOf('type="image/webp"');
const iJpeg = out.indexOf('type="image/jpeg"');
assert('order avif before webp before jpeg', iAvif !== -1 && iAvif < iWebp && iWebp < iJpeg);
assert('all sources come before the img fallback',
  out.indexOf('<img ') > iJpeg);

const imgLine = out.split('\n').filter((l) => l.trim().indexOf('<img ') === 0)[0] || '';
assert('img fallback keeps original url', imgLine.indexOf('src="/img/photo.jpg"') !== -1);
assert('img fallback has alt text', imgLine.indexOf('alt="Sonnenaufgang über den Bergen"') !== -1);
assert('img honors loading', imgLine.indexOf('loading="lazy"') !== -1);
assert('img honors fetchpriority', imgLine.indexOf('fetchpriority="high"') !== -1);
assert('img omits loading when not provided',
  D.buildPicture({ url: '/a.jpg', alt: 'x' }).indexOf('loading=') === -1);
assert('img honors width/height when provided',
  D.buildPicture({ url: '/a.jpg', alt: 'x', width: 800, height: 600 })
    .indexOf('width="800" height="600"') !== -1);
assert('sizes defaults to 100vw',
  D.buildPicture({ url: '/a.jpg', alt: 'x', widths: [320], formats: ['avif'] })
    .indexOf('sizes="100vw"') !== -1);

/* ---------- format ordering is canonical regardless of input order ---------- */
const shuffled = D.buildPicture({ url: '/a.jpg', alt: 'x', widths: [320], formats: ['jpg', 'avif', 'webp'] });
const sA = shuffled.indexOf('type="image/avif"');
const sW = shuffled.indexOf('type="image/webp"');
const sJ = shuffled.indexOf('type="image/jpeg"');
assert('canonical ordering with shuffled formats', sA !== -1 && sA < sW && sW < sJ);
assert('jpeg alias normalized', D.normalizeFormats(['jpeg', 'JPG']).join(',') === 'jpg');
assert('duplicate formats de-duped', D.normalizeFormats(['avif', 'avif', 'webp']).join(',') === 'avif,webp');

/* ---------- minimal cfg ---------- */
const min = D.buildPicture({ url: '/img/photo.jpg' });
assert('minimal cfg yields <picture>', min.indexOf('<picture>') !== -1);
assert('minimal cfg yields an <img>', min.indexOf('<img ') !== -1);
assert('minimal cfg has no source', min.indexOf('<source') === -1);
eq(min.split('\n').length, 3, 'minimal cfg is 3 lines');

const noUrl = D.buildPicture({ url: '' });
eq(noUrl, '', 'empty url returns empty string');
eq(D.buildPicture(), '', 'missing cfg returns empty string');

/* ---------- escaping safety ---------- */
const evil = D.buildPicture({
  url: '/img/photo.jpg',
  alt: 'Quote " und <script>alert(1)</script>',
  widths: [320],
  formats: ['avif']
});
assert('alt quote escaped to &quot;', evil.indexOf('alt="Quote &quot; und') !== -1);
assert('alt angle brackets escaped', evil.indexOf('&lt;script&gt;') !== -1);
assert('no raw closing tag injected from alt', evil.indexOf('<script>') === -1);
const evilImg = evil.split('\n').filter((l) => l.trim().indexOf('<img ') === 0)[0] || '';
assert('alt attribute count stays at one', (evilImg.match(/alt="/g) || []).length === 1);
assert('tag balance intact after escaping',
  (evil.match(/</g) || []).length === (evil.match(/>/g) || []).length);
assert('escAttr escapes single quotes too',
  D.escAttr('a\'b"c<d>&e') === 'a&#39;b&quot;c&lt;d&gt;&amp;e');
assert('url with quote is escaped',
  D.buildPicture({ url: '/a".jpg', alt: 'x' }).indexOf('src="/a&quot;.jpg"') !== -1);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);