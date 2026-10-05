/* ══════════════════════════════════════════════════
   selector-generator.js | CSS-Selector aus HTML generieren
   ══════════════════════════════════════════════════
   Paste a snippet (with or without <html>/<head>/<body>), the wrapper tags are
   skipped automatically. A slider picks the element, the preview scrolls to and
   highlights it, the selector updates live, and a copy button is provided.
   */
(function() {
  'use strict';
  var DE = (typeof window !== 'undefined' && window.__siteLang !== 'en');

  function E(id){ return document.getElementById(id); }

  /* Tags that are excluded from selection AND from the preview clone in BOTH
     modes. Wrappers (html/head/body) are auto-generated around a fragment and
     would pollute indices; script/style can't be styled and can execute; base
     and link are non-visual/head tags. Everything else (img, iframe, video,
     audio, object, embed, source, …) is rendered in both modes so the selectable
     element set — and therefore the slider indices — stays identical whether the
     preview is sanitised or live; only their external resource attributes differ.
     Kept in sync so list indices and preview indices line up 1:1. */
  var SKIP_TAGS = {
    html:1, head:1, body:1,
    script:1, style:1, base:1, link:1
  };

  /* Sanitised-mode only: attributes that reload external resources when an
     element renders. Dropped so a tracker snippet fires no network request.
     In live mode these are preserved (the user has opted in). */
  var DROPPED_ATTRS = { src:1, srcset:1, poster:1, ping:1, srcdoc:1, data:1 };
  /* 1x1 transparent GIF — local data URI, no network. Stands in for <img> so
     images still occupy their natural box without fetching their source. */
  var TRANSPARENT_GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

  /* The elements a user would meaningfully select: every element in the parsed
     body except the wrappers and non-styleable script/style tags. Document
     order is preserved. */
  function selectableElements(nodes) {
    return Array.prototype.filter.call(nodes || [], function(el) {
      return el && el.nodeType === 1 && !SKIP_TAGS[(el.tagName || '').toLowerCase()];
    });
  }

  /* Build a unique-ish CSS selector for an element. The path stops at the
     parsed body's top level, so the selector never starts with "html > body >". */
  function buildPath(el) {
    if (!el || el.nodeType !== 1) return null;
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1) {
      var part = node.tagName.toLowerCase();
      if (node.id) { parts.unshift('#' + CSS.escape(node.id)); break; }
      var cl = Array.prototype.slice.call(node.classList || []);
      if (cl.length) part += '.' + cl.map(function(c){ return CSS.escape(c); }).join('.');
      var parent = node.parentElement;
      if (parent && parent.nodeType === 1) {
        var sibs = Array.prototype.filter.call(parent.children, function(c){ return c.tagName === node.tagName; });
        if (sibs.length > 1) {
          var idx = Array.prototype.indexOf.call(parent.children, node) + 1;
          part += ':nth-child(' + idx + ')';
        }
      }
      parts.unshift(part);
      // Top-level element of the parsed body: its parent is a wrapper tag, so
      // stop here and never emit "html > body >" in the path.
      if (parent && SKIP_TAGS[(parent.tagName || '').toLowerCase()]) break;
      node = parent;
    }
    return parts.join(' > ');
  }

  /* Deep-clone a parsed element into a preview copy. In sanitised mode (default)
     it fires NO network requests: external src/srcset/poster/ping/data are
     stripped, images get a local transparent placeholder, and inline style is
     scrubbed of url()/@import. In live mode (user opted in) real external
     resources are preserved so images/iframes/videos render as on the page.
     In BOTH modes <script>/<style>/<base>/<link> are dropped and event-handler
     + javascript:/vbscript: URLs are removed, so pasted HTML can never execute
     scripts. The clone keeps the same element set as selectableElements (both
     use SKIP_TAGS), so list indices and preview indices line up 1:1 in either
     mode. */
  function cloneForPreview(src, live) {
    var tag = (src.tagName || '').toLowerCase();
    if (SKIP_TAGS[tag]) return null;
    var el = document.createElement(src.tagName);
    var attrs = src.attributes || [];
    for (var i = 0; i < attrs.length; i++) {
      var a = attrs[i];
      var name = (a.name || '').toLowerCase();
      if (/^on/i.test(name)) continue;                        // handler attrs — never
      if (/^\s*(javascript|vbscript):/i.test(a.value || '')) continue; // script URLs — never
      if (!live) {
        if (DROPPED_ATTRS[name]) continue;                    // external resource loaders
        if ((name === 'href' || name === 'xlink:href') && tag !== 'a') continue; // svg <image> href etc.
        if (/^(http|https|\/\/)/i.test(a.value || '')) continue;              // external URLs on href/src
      }
      if (name === 'style') {
        var v = a.value;
        if (!live) v = v.replace(/url\s*\(\s*['"]?[^)'"]+['"]?\s*\)/gi, '').replace(/@import[^;]*;?/gi, '');
        if (String(v).trim()) el.setAttribute(a.name, v);
        continue;
      }
      el.setAttribute(a.name, a.value);
    }
    // Sanitised <img>: local transparent placeholder instead of the real source.
    if (!live && tag === 'img') el.setAttribute('src', TRANSPARENT_GIF);
    var kids = src.childNodes || [];
    for (var k = 0; k < kids.length; k++) {
      var child = kids[k];
      if (child.nodeType === 1) {
        var c = cloneForPreview(child, live);
        if (c) el.appendChild(c);
      } else {
        el.appendChild(child.cloneNode(true)); // text / comment
      }
    }
    return el;
  }

  /* Runtime state for the currently generated result. */
  var state = { els: [], previewEls: [], total: 0, body: null, previewInner: null };

  function currentLive() {
    var cb = E('sg-live');
    return !!(cb && cb.checked);
  }

  /* (Re)build the preview snapshot from the cached parsed body using the current
     live/sanitised mode. Element count/order is identical in both modes (both use
     SKIP_TAGS), so the slider indices remain valid across toggling. */
  function renderPreview() {
    var inner = state.previewInner;
    if (!inner) return;
    var live = currentLive();
    inner.innerHTML = '';
    var bodyChildren = (state.body && state.body.children) || [];
    for (var i = 0; i < bodyChildren.length; i++) {
      var c = cloneForPreview(bodyChildren[i], live);
      if (c) inner.appendChild(c);
    }
    state.previewEls = Array.prototype.slice.call(inner.querySelectorAll('*'));
  }

  function onLiveToggle() {
    renderPreview();
    updatePreviewHighlight();
  }

  function updatePreviewHighlight() {
    var prev = document.querySelector('.sg-preview .sg-hl');
    if (prev) prev.classList.remove('sg-hl');
    var el = state.previewEls[state.cur - 1];
    if (el) {
      el.classList.add('sg-hl');
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      catch (e) { el.scrollIntoView(); }
    }
  }

  /* Recompute selector + labels for the current slider index, then re-highlight.
     `fromUI=false` is used on first render so the viewport isn't jumped. */
  function updateSelection(fromUI) {
    var slider = E('sg-slider');
    var n = state.total;
    var idx = (slider && slider.value != null) ? parseInt(slider.value, 10) : state.cur;
    if (isNaN(idx)) idx = state.cur;
    if (idx < 1) idx = 1;
    if (idx > n) idx = n;
    state.cur = idx;
    if (slider) slider.value = idx;

    var cur = E('sg-cur');
    if (cur) cur.textContent = idx;

    var target = state.els[idx - 1];
    var sel = target ? buildPath(target) : null;

    var code = E('sg-sel');
    if (code) code.textContent = sel || '?';
    var cbtn = E('sg-copy');
    if (cbtn) cbtn.setAttribute('data-copy', sel || '');

    // Short form, shown only when the element carries an id.
    var shortRow = E('sg-short');
    if (target && target.id) {
      var short = '#' + CSS.escape(target.id);
      var scode = E('sg-sel-short');
      if (scode) scode.textContent = short;
      var sbtn = E('sg-copy-short');
      if (sbtn) sbtn.setAttribute('data-copy', short);
      if (shortRow) shortRow.style.display = 'flex';
    } else if (shortRow) {
      shortRow.style.display = 'none';
    }

    if (fromUI !== false) updatePreviewHighlight();
  }

  function run() {
    var html = E('sg-html').value;
    var out = E('tool-output');
    if (!html.trim()) {
      out.innerHTML = '<p class="text-muted">' + (DE ? 'Bitte HTML einfügen.' : 'Please paste HTML.') + '</p>';
      return;
    }
    var doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); }
    catch (e) {
      out.innerHTML = '<p class="text-muted">' + (DE ? 'HTML konnte nicht geparst werden.' : 'Could not parse the HTML.') + '</p>';
      return;
    }
    var body = doc.body;
    var els = selectableElements(body.querySelectorAll('*'));

    if (!els.length) {
      out.innerHTML = '<p class="text-muted">' + (DE
        ? 'Keine Elemente gefunden. Hinweis: Einzelne Tabellenzeilen (&lt;tr&gt;) oder reiner Text werden vom Parser nicht als Element erkannt &ndash; bitte in ein passendes Element wie &lt;table&gt; einbinden.'
        : 'No elements found. Note: a bare table row (&lt;tr&gt;) or plain text is not recognised as an element by the parser &ndash; please wrap it in a container like &lt;table&gt;.') + '</p>';
      return;
    }

    state.els = els;
    state.total = els.length;
    state.cur = 1;
    state.body = body;

    out.innerHTML = '';

    var box = document.createElement('div');
    box.className = 'result-box sg-ctrl';
    box.innerHTML =
      '<div class="sg-meta">' +
        '<span class="sg-label">' + (DE ? 'Element' : 'Element') + '</span> ' +
        '<span id="sg-cur" class="range-val">1</span>' +
        '<span class="sg-of">/ ' + els.length + '</span>' +
      '</div>' +
      '<input type="range" id="sg-slider" min="1" max="' + els.length + '" value="1" step="1" class="input-range">' +
      '<div class="sg-code-row">' +
        '<code class="selector-code" id="sg-sel"></code>' +
        '<button type="button" class="btn btn-secondary sg-copy" id="sg-copy">' + (DE ? 'Kopieren' : 'Copy') + '</button>' +
      '</div>' +
      '<div class="sg-short-row" id="sg-short" style="display:none">' +
        '<span class="sg-short-label">' + (DE ? 'Kurzform' : 'Short form') + '</span>' +
        '<code class="selector-code" id="sg-sel-short"></code>' +
        '<button type="button" class="btn btn-secondary sg-copy" id="sg-copy-short">' + (DE ? 'Kopieren' : 'Copy') + '</button>' +
      '</div>' +
      '<label class="sg-live-toggle">' +
        '<input type="checkbox" id="sg-live"> ' +
        '<span>' + (DE
          ? 'Live-Vorschau: externe Bilder, Iframes &amp; Ressourcen laden'
          : 'Live preview: load the page&rsquo;s external images, iframes &amp; resources') + '</span>' +
      '</label>' +
      '<p class="sg-live-warn">' + (DE
        ? 'Aktivieren sendet Netzwerk-Anfragen an Drittanbieter (inkl. m&ouml;glicher Tracker in deinem HTML). Aus &ndash; lokale, bereinigte Vorschau.'
        : 'Enabling sends network requests to third parties (incl. any trackers in your HTML). Off &ndash; local, sanitised preview.') + '</p>';
    out.appendChild(box);

    var preview = document.createElement('div');
    preview.className = 'sg-preview';
    var inner = document.createElement('div');
    inner.className = 'sg-preview-inner';
    state.previewInner = inner;
    preview.appendChild(inner);
    out.appendChild(preview);

    renderPreview();

    var slider = E('sg-slider');
    slider.addEventListener('input', function(){ updateSelection(true); });

    var live = E('sg-live');
    live.addEventListener('change', onLiveToggle);

    // Initial render without scrolling/jumping the page.
    updateSelection(false);
    updatePreviewHighlight();
  }

  function buildUI() {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-primary btn-generate';
    btn.textContent = DE ? 'Selector generieren' : 'Generate selector';
    E('tool-inputs').appendChild(btn);
    btn.addEventListener('click', run);
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
    else buildUI();
  }

  if (typeof module !== 'undefined' && module.exports && typeof CSS === 'undefined') {
    global.CSS = { escape: function(s){ return s; } };
    module.exports = { buildPath: buildPath, selectableElements: selectableElements };
  }
})();
