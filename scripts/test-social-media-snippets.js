/* Unit tests for the Social Media Snippets engine.
 * Run: node scripts/test-social-media-snippets.js
 */
const assert = require('assert');
const S = require('../public/assets/js/social-media-snippets.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.error('FAIL: ' + name + '\n  ' + e.message); }
}

// ---- countChars ----
t('countChars basic', () => assert.strictEqual(S.countChars('abc'), 3));

// ---- extractKeywords / toTag / makeHashtags ----
t('extractKeywords strips stopwords', () => {
  const kws = S.extractKeywords('Der Passwort Generator ist ein sicheres Werkzeug', 'de');
  assert.ok(!kws.includes('der'));
  assert.ok(kws.includes('passwort'));
  assert.ok(kws.includes('generator'));
  assert.ok(kws.includes('sicheres'));
});
t('extractKeywords dedupes', () => {
  const kws = S.extractKeywords('tool tool tool werkzeug', 'de');
  assert.strictEqual(kws.filter(w => w === 'tool').length, 1);
});
t('toTag caps first letter + hash', () => assert.strictEqual(S.toTag('passwort'), '#Passwort'));
t('makeHashtags respects count', () => {
  const line = S.makeHashtags({ headline: 'Passwort Generator', description: 'Erstelle sichere Passwörter', lang: 'de', count: 4 });
  assert.strictEqual(line.split(' ').length, 4);
  assert.ok(line.startsWith('#'));
});
t('makeHashtags count 0 returns empty', () => assert.strictEqual(S.makeHashtags({ lang: 'de', count: 0 }), ''));

// ---- buildSnippet ----
const base = { headline: 'Passwort Generator', description: 'Erstelle sichere, zufällige Passwörter direkt im Browser.', url: 'https://studio-tools.online/password-generator', lang: 'de', hashtags: true, cta: true };

t('X snippet within 280 chars', () => {
  const r = S.buildSnippet(Object.assign({}, base, { network: 'x' }));
  assert.ok(r.text.length <= 280, 'len=' + r.text.length);
  assert.strictEqual(r.limit, 280);
  assert.ok(r.text.includes('https://'));
});
t('X snippet contains headline', () => {
  const r = S.buildSnippet(Object.assign({}, base, { network: 'x' }));
  assert.ok(r.text.includes('Passwort Generator'));
});
t('Threads within 500', () => {
  const r = S.buildSnippet(Object.assign({}, base, { network: 'threads' }));
  assert.ok(r.text.length <= 500);
});
t('Instagram has many hashtags', () => {
  const r = S.buildSnippet(Object.assign({}, base, { network: 'ig' }));
  const tags = (r.text.match(/#\w+/g) || []);
  assert.ok(tags.length >= 10, 'tags=' + tags.length);
});
t('WhatsApp has no hashtags', () => {
  const r = S.buildSnippet(Object.assign({}, base, { network: 'wa' }));
  assert.ok(!/#/.test(r.text));
  assert.ok(r.text.includes('https://'));
});
t('WhatsApp includes waCta', () => {
  const r = S.buildSnippet(Object.assign({}, base, { network: 'wa' }));
  assert.ok(r.text.includes('Einfach öffnen und gratis nutzen'));
});
t('Facebook no limit', () => {
  const r = S.buildSnippet(Object.assign({}, base, { network: 'fb' }));
  assert.strictEqual(r.limit, null);
});
t('hashtags=false yields none', () => {
  ['x', 'fb', 'ig', 'threads'].forEach(n => {
    const r = S.buildSnippet(Object.assign({}, base, { network: n, hashtags: false }));
    assert.ok(!/#/.test(r.text), n);
  });
});
t('cta=false drops CTA sentence', () => {
  const r = S.buildSnippet(Object.assign({}, base, { network: 'fb', cta: false }));
  assert.ok(!r.text.includes('Probier'));
});
t('long input gets trimmed to X limit', () => {
  const longDesc = Array(300).fill('sehr langer beschreibungstext').join(' ');
  const r = S.buildSnippet(Object.assign({}, base, { network: 'x', description: longDesc }));
  assert.ok(r.text.length <= 280, 'len=' + r.text.length);
});
t('empty headline+desc yields empty-ish / still returns', () => {
  const r = S.buildSnippet(Object.assign({}, base, { network: 'x', headline: '', description: '' }));
  // Should still produce the URL line
  assert.ok(r.text.includes('https://'));
});
t('unknown network returns empty', () => {
  const r = S.buildSnippet(Object.assign({}, base, { network: 'nope' }));
  assert.strictEqual(r.text, '');
});
t('EN language produces English CTA', () => {
  const r = S.buildSnippet(Object.assign({}, base, { network: 'fb', lang: 'en' }));
  assert.ok(r.text.includes('Try it free'));
});

// ---- fit ----
t('fit returns text within limit', () => {
  const tail = ['Probier es kostenlos direkt im Browser aus. https://studio-tools.online/x', '#A #B'];
  const head = 'Ein sehr langer Titel der eigentlich gar nicht so wichtig ist';
  const desc = Array(200).fill('dies ist eine sehr lange beschreibung').join(' ');
  const r = S.fit(head, desc, tail, 280);
  assert.ok(r.text.length <= 280, 'len=' + r.text.length);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
