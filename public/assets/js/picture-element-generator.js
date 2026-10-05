/* ══════════════════════════════════════════════════
   picture-element-generator.js - <picture>-Markup-Generator
   Responsive <picture>-Elemente mit AVIF-, WebP- und JPEG-Quellen,
   srcset-Ableitung, sizes, loading und fetchpriority.
   Reine Erzeugung, 100% lokal im Browser.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
  }

  /* -------- pure engine (node-testable) -------- */

  var FORMAT_ORDER = ['avif', 'webp', 'jpg'];
  var MIME = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
  var ALL_WIDTHS = [320, 480, 768, 1024, 1280, 1536, 1920];

  /** Escape a value for use inside a double-quoted HTML attribute. */
  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Split "/a/photo.jpg?v=2#x" into {path, suffix}. */
  function splitUrl(url) {
    var s = String(url == null ? '' : url).trim();
    var m = /([?#].*)$/.exec(s);
    if (!m) return { path: s, suffix: '' };
    return { path: s.slice(0, m.index), suffix: m[1] };
  }

  /**
   * Derive one responsive candidate URL.
   * "/img/photo.jpg" + 800 + "avif" -> "/img/photo-800w.avif"
   * "https://cdn.tld/foto" + 320 + "webp" -> "https://cdn.tld/foto-320w.webp"
   * Query and hash stay at the end, unchanged.
   */
  function candidateUrl(url, width, format) {
    var parts = splitUrl(url);
    var path = parts.path;
    var ext = /\.([A-Za-z0-9]{1,5})$/.exec(path);
    var stem = ext ? path.slice(0, ext.index) : path;
    var extName = ext ? ext[1] : '';
    return stem + '-' + width + 'w.' + String(format).toLowerCase() + parts.suffix;
  }

  /** Normalise widths: positive integers, de-duplicated, ascending. */
  function normalizeWidths(widths) {
    var list = Array.isArray(widths) ? widths : [];
    var out = [], seen = {};
    for (var i = 0; i < list.length; i++) {
      var n = typeof list[i] === 'number' ? list[i] : parseInt(list[i], 10);
      if (typeof n !== 'number' || isNaN(n) || n <= 0) continue;
      n = Math.round(n);
      if (seen[n]) continue;
      seen[n] = 1;
      out.push(n);
    }
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  /** Normalise formats to canonical order avif, webp, jpg (de-duplicated). */
  function normalizeFormats(formats) {
    var list = Array.isArray(formats) ? formats : [];
    var map = {}, i;
    for (i = 0; i < list.length; i++) {
      var f = String(list[i] == null ? '' : list[i]).trim().toLowerCase();
      if (f === 'jpeg') f = 'jpg';
      if (MIME[f]) map[f] = 1;
    }
    var out = [];
    for (i = 0; i < FORMAT_ORDER.length; i++) {
      if (map[FORMAT_ORDER[i]]) out.push(FORMAT_ORDER[i]);
    }
    return out;
  }

  /**
   * Pure srcset builder: comma-joined "<derived url> <W>w" pairs.
   * Returns '' when no usable width is given.
   */
  function srcsetFor(url, widths, format) {
    var ws = normalizeWidths(widths);
    if (!ws.length) return '';
    var fmt = normalizeFormats([format || 'jpg'])[0] || 'jpg';
    var parts = [];
    for (var i = 0; i < ws.length; i++) {
      parts.push(candidateUrl(url, ws[i], fmt) + ' ' + ws[i] + 'w');
    }
    return parts.join(', ');
  }

  /** One line per selected format: derived file names. */
  function fileHints(url, widths, formats) {
    var ws = normalizeWidths(widths);
    var fs = normalizeFormats(formats);
    var out = [];
    for (var i = 0; i < fs.length; i++) {
      var fmt = fs[i];
      var first = ws.length ? candidateUrl(url, ws[0], fmt) : String(url == null ? '' : url).trim();
      out.push({ format: fmt, mime: MIME[fmt], first: first, count: ws.length });
    }
    return out;
  }

  /**
   * Build the complete <picture> markup.
   * cfg = {url, alt, widths:[], formats:[], sizes, width, height, loading, fetchpriority}
   * Format order is always avif, webp, jpg (browser-first wins), the fallback
   * <img> always carries the original URL.
   */
  function buildPicture(cfg) {
    cfg = cfg || {};
    var url = String(cfg.url == null ? '' : cfg.url).trim();
    if (!url) return '';

    var ws = normalizeWidths(cfg.widths);
    var fs = normalizeFormats(cfg.formats);
    var alt = cfg.alt == null ? '' : String(cfg.alt);
    var sizes = cfg.sizes == null || String(cfg.sizes).trim() === '' ? '100vw' : String(cfg.sizes).trim();
    var loading = cfg.loading == null ? '' : String(cfg.loading).trim();
    var priority = cfg.fetchpriority == null ? '' : String(cfg.fetchpriority).trim();

    var lines = ['<picture>'];

    if (ws.length) {
      for (var i = 0; i < fs.length; i++) {
        lines.push('  <source type="' + MIME[fs[i]] + '" srcset="' +
          escAttr(srcsetFor(url, ws, fs[i])) + '" sizes="' + escAttr(sizes) + '">');
      }
    }

    var imgAttrs = 'src="' + escAttr(url) + '"' +
      ' alt="' + escAttr(alt) + '"';
    if (cfg.width) imgAttrs += ' width="' + escAttr(cfg.width) + '"';
    if (cfg.height) imgAttrs += ' height="' + escAttr(cfg.height) + '"';
    if (loading) imgAttrs += ' loading="' + escAttr(loading) + '"';
    if (priority) imgAttrs += ' fetchpriority="' + escAttr(priority) + '"';
    lines.push('  <img ' + imgAttrs + '>');
    lines.push('</picture>');
    return lines.join('\n');
  }

  /* -------- UI -------- */

  var INPUT_STYLE = 'background:#0b1218;border:1px solid var(--line);border-radius:8px;color:var(--fg);padding:8px;font-size:.9rem;width:100%';
  var CHECK_STYLE = 'display:inline-flex;align-items:center;gap:6px;font-size:.85rem;color:var(--fg);background:#0b1218;border:1px solid var(--line);border-radius:8px;padding:6px 10px;cursor:pointer';

  function renderOutput(markup, hints, err) {
    var el = E('tool-output');
    if (!el) return;
    if (err) {
      el.innerHTML = '<p style="color:var(--err);font-size:.9rem">' + esc(err) + '</p>';
      return;
    }
    var html = '<div class="result-display" style="display:grid;gap:10px;max-width:100%">';
    html += '<div style="font-size:.85rem;color:var(--mut)">Generiertes picture-Element</div>';
    html += '<div style="max-width:100%;overflow-x:auto;background:#0b1218;border:1px solid var(--line);border-radius:8px;padding:10px 12px">'
      + '<code data-copy="1" style="display:block;white-space:pre;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.8rem;color:var(--fg)">' + esc(markup) + '</code></div>';
    if (hints && hints.length) {
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
      for (var i = 0; i < hints.length; i++) {
        html += '<code style="background:#0b1218;border:1px solid var(--line);border-radius:8px;padding:4px 8px;font-size:.72rem;color:var(--mut)">'
          + esc(hints[i].format.toUpperCase() + ': ' + hints[i].first) + '</code>';
      }
      html += '</div>';
    }
    html += '<div class="row"><button type="button" class="btn-app" data-copy-btn="1">Markup kopieren</button></div>';
    html += '</div>';
    el.innerHTML = html;

    var btn = el.querySelector('[data-copy-btn]');
    if (btn) btn.addEventListener('click', function () {
      if (window.copyToClipboard) {
        var r = window.copyToClipboard(markup);
        if (r && r['catch']) r['catch'](function () {});
      } else if (navigator && navigator.clipboard) {
        navigator.clipboard.writeText(markup)['catch'](function () {});
      }
      btn.textContent = 'Kopiert';
      setTimeout(function () { btn.textContent = 'Markup kopieren'; }, 1500);
    });
  }

  function checkedValues(sel) {
    var boxes = document.querySelectorAll(sel + ' input[type="checkbox"]');
    var out = [];
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].checked) out.push(boxes[i].value);
    }
    return out;
  }

  function run() {
    var urlEl = E('pic-url');
    if (!urlEl) return;
    var url = String(urlEl.value || '').trim();
    if (!url) {
      renderOutput('', [], 'Bitte eine Bild-URL eingeben.');
      return;
    }
    var widths = checkedValues('#pic-widths').map(function (v) { return parseInt(v, 10); });
    if (!widths.length) {
      renderOutput('', [], 'Bitte mindestens eine Breite auswählen.');
      return;
    }
    var formats = checkedValues('#pic-formats');
    if (!formats.length) {
      renderOutput('', [], 'Bitte mindestens ein Format auswählen.');
      return;
    }
    var altEl = E('pic-alt');
    var sizesEl = E('pic-sizes');
    var loadEl = E('pic-loading');
    var prioEl = E('pic-fetchpriority');

    var markup = buildPicture({
      url: url,
      alt: altEl ? altEl.value : '',
      widths: widths,
      formats: formats,
      sizes: sizesEl ? sizesEl.value : '',
      loading: loadEl ? loadEl.value : '',
      fetchpriority: prioEl ? prioEl.value : ''
    });
    renderOutput(markup, fileHints(url, widths, formats), '');
  }

  function checkboxGroup(id, label, items, checkedIdx) {
    var html = '<div class="field"><label>' + esc(label) + '</label><div id="' + id + '" style="display:flex;flex-wrap:wrap;gap:8px">';
    for (var i = 0; i < items.length; i++) {
      var v = items[i].value !== undefined ? items[i].value : items[i];
      var t = items[i].label !== undefined ? items[i].label : String(items[i]);
      var on = checkedIdx.indexOf(i) !== -1 ? ' checked' : '';
      html += '<label style="' + CHECK_STYLE + '"><input type="checkbox" value="' + esc(v) + '"' + on +
        ' style="accent-color:var(--acc,#E0915F);margin:0">' + esc(t) + '</label>';
    }
    html += '</div></div>';
    return html;
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;

    var html = '';
    html += '<div class="field"><label>Bild-URL</label>' +
      '<input id="pic-url" type="text" placeholder="/img/photo.jpg" value="/img/photo.jpg" style="' + INPUT_STYLE + '"></div>';
    html += '<div class="field"><label>Alt-Text</label>' +
      '<input id="pic-alt" type="text" placeholder="Beschreibung des Bildes für Screenreader" value="Sonnenaufgang über den Bergen" style="' + INPUT_STYLE + '"></div>';
    html += checkboxGroup('pic-widths', 'Breiten (px)', ALL_WIDTHS, [0, 2, 3, 5]);
    html += checkboxGroup('pic-formats', 'Formate', [
      { value: 'avif', label: 'AVIF' },
      { value: 'webp', label: 'WebP' },
      { value: 'jpg', label: 'JPEG' }
    ], [0, 1, 2]);
    html += '<div class="field"><label>sizes-Attribut</label>' +
      '<input id="pic-sizes" type="text" placeholder="100vw" value="100vw" style="' + INPUT_STYLE + '"></div>';
    html += '<div class="row">';
    html += '<div class="field" style="flex:1;min-width:180px"><label>loading</label>' +
      '<select id="pic-loading" style="' + INPUT_STYLE + '">' +
      '<option value="lazy" selected>lazy</option><option value="eager">eager</option></select></div>';
    html += '<div class="field" style="flex:1;min-width:180px"><label>fetchpriority</label>' +
      '<select id="pic-fetchpriority" style="' + INPUT_STYLE + '">' +
      '<option value="auto" selected>auto</option><option value="high">high</option><option value="low">low</option></select></div>';
    html += '</div>';
    html += '<div class="row"><button type="button" class="btn-app">Markup erzeugen</button></div>';
    inputs.innerHTML = html;

    var btn = inputs.querySelector('button.btn-app');
    if (btn) btn.addEventListener('click', run);
    inputs.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); }
    });
    run();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      buildPicture: buildPicture,
      srcsetFor: srcsetFor,
      candidateUrl: candidateUrl,
      fileHints: fileHints,
      normalizeWidths: normalizeWidths,
      normalizeFormats: normalizeFormats,
      escAttr: escAttr,
      splitUrl: splitUrl,
      MIME: MIME,
      FORMAT_ORDER: FORMAT_ORDER,
      ALL_WIDTHS: ALL_WIDTHS
    };
  }
})();