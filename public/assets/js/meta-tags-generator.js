/* ══════════════════════════════════════════════════
   meta-tags-generator.js — Meta-Tags-Generator
   Erzeugt fertige HTML-Meta-Tags (SEO) aus Formulareingaben.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* -------- pure engine (node-testable) -------- */

  function normalize(input) {
    return String(input == null ? '' : input).trim();
  }

  // Build a complete set of HTML meta tags from form fields.
  // Returns a single string (newline-separated tags) AND the list for stats.
  function buildMeta(opts) {
    var title = normalize(opts.title);
    var desc = normalize(opts.description);
    var keywords = normalize(opts.keywords);
    var canonical = normalize(opts.canonical);
    var lang = opts.lang === 'de' || opts.lang === 'en' ? opts.lang : 'de';
    var ogImage = normalize(opts.ogImage);
    var noindex = !!opts.noindex;
    var author = normalize(opts.author);

    var tags = [];
    tags.push('<title>' + esc(title) + '</title>');

    if (desc) {
      tags.push('<meta name="description" content="' + esc(desc) + '">');
      tags.push('<meta name="og:description" content="' + esc(desc) + '">');
    }
    if (keywords) {
      tags.push('<meta name="keywords" content="' + esc(keywords) + '">');
    }
    tags.push('<meta charset="utf-8">');
    tags.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
    tags.push('<meta name="robots" content="' + (noindex ? 'noindex, nofollow' : 'index, follow') + '">');
    if (canonical) {
      tags.push('<link rel="canonical" href="' + esc(canonical) + '">');
      tags.push('<meta property="og:url" content="' + esc(canonical) + '">');
    }
    if (lang) {
      var locale = lang === 'de' ? 'de_DE' : 'en_US';
      tags.push('<meta property="og:locale" content="' + locale + '">');
    }
    if (title) {
      tags.push('<meta property="og:title" content="' + esc(title) + '">');
      tags.push('<meta name="twitter:card" content="summary_large_image">');
      tags.push('<meta name="twitter:title" content="' + esc(title) + '">');
    }
    if (ogImage) {
      tags.push('<meta property="og:image" content="' + esc(ogImage) + '">');
    }
    if (author) {
      tags.push('<meta name="author" content="' + esc(author) + '">');
    }

    return { html: tags.join('\n'), count: tags.length, titleLen: title.length, descLen: desc.length };
  }

  // Show a small SEO-style preview (like Google SERP snippet).
  function serpPreview(opts) {
    var title = normalize(opts.title);
    var desc = normalize(opts.desc || opts.description);
    var canonical = normalize(opts.canonical);
    return {
      domain: canonical ? canonical.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : 'beispiel.de',
      title: title || '(Titel fehlt)',
      desc: desc || '(Beschreibung fehlt)'
    };
  }

  /* -------- UI -------- */

  function renderOutput(res) {
    var el = E('tool-output');
    if (!el) return;
    var html = '<div class="result-display">';
    html += '<textarea readonly class="meta-out" style="width:100%;min-height:220px;background:#0b1218;border:1px solid var(--line);border-radius:8px;color:var(--fg);padding:10px;font-family:ui-monospace,monospace;font-size:.82rem" id="meta-out-text">' + esc(res.html) + '</textarea>';
    html += '</div>';
    html += '<div style="margin-top:10px;font-size:.82rem;color:var(--mut)">' + res.count + ' Tags erzeugt &middot; Titel ' + res.titleLen + ' Zeichen &middot; Description ' + res.descLen + ' Zeichen</div>';
    el.innerHTML = html;
  }

  function run() {
    var opts = {
      title: E('mt-title').value,
      description: E('mt-desc').value,
      keywords: E('mt-keywords').value,
      canonical: E('mt-canonical').value,
      ogImage: E('mt-ogimage').value,
      author: E('mt-author').value,
      lang: E('mt-lang').value,
      noindex: E('mt-noindex').checked
    };
    if (!normalize(opts.title) && !normalize(opts.description)) {
      E('tool-output').innerHTML = '<p class="muted">Bitte mindestens einen Titel oder eine Beschreibung eingeben.</p>';
      return;
    }
    renderOutput(buildMeta(opts));
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    var field = function (id, label, ph, opts) {
      return '<div class="field"><label>' + label + '</label><input type="text" id="' + id + '" placeholder="' + ph + '"' + (opts || '') + '></div>';
    };
    inputs.innerHTML =
      field('mt-title', 'Seitentitel', 'z.B. Rabatt-Rechner online | Studio Tools', ' maxlength="70"') +
      field('mt-desc', 'Meta-Beschreibung', 'z.B. Kostenloser Rabatt-Rechner mit Endpreis und Ersparnis.', ' maxlength="160"') +
      field('mt-keywords', 'Keywords (kommagetrennt)', 'z.B. Rabatt, Rechner, Prozent, Preis') +
      field('mt-canonical', 'Canonical-URL', 'https://studio-tools.online/rabatt-rechner') +
      field('mt-ogimage', 'Open-Graph-Bild (URL)', 'https://beispiel.de/bild.jpg') +
      field('mt-author', 'Autor', 'Studio Chop Digital') +
      '<div class="field"><label>Sprache</label><select id="mt-lang"><option value="de">Deutsch</option><option value="en">English</option></select></div>' +
      '<div class="field"><label style="display:inline"><input type="checkbox" id="mt-noindex"> Keine Indexierung (noindex, nofollow)</label></div>' +
      '<div class="row"><button type="button" class="btn-app" style="background:var(--blue);color:#fff;border:0;border-radius:8px;padding:9px 18px;cursor:pointer">Meta-Tags erzeugen</button>' +
      '<button type="button" class="ghost" style="background:transparent;border:1px solid var(--line);color:var(--mut);border-radius:8px;padding:9px 14px;cursor:pointer">Beispiel laden</button></div>';

    var runBtn = inputs.querySelector('button.btn-app');
    var exampleBtn = inputs.querySelector('button.ghost');
    runBtn.addEventListener('click', run);
    exampleBtn.addEventListener('click', function () {
      E('mt-title').value = 'Text-Diff Tool: Zwei Texte vergleichen | Studio Tools';
      E('mt-desc').value = 'Vergleicht zwei Textfassungen Zeile für Zeile und zeigt hinzugefügte und entfernte Zeilen. Kostenlos, ohne Anmeldung.';
      E('mt-keywords').value = 'Text vergleichen, Diff, Unterschied, Textvergleich';
      E('mt-canonical').value = 'https://studio-tools.online/text-diff';
      run();
    });
  }

  var outputBtn;
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'meta-out-text') { e.target.select(); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildMeta: buildMeta, serpPreview: serpPreview, normalize: normalize };
  }
})();
