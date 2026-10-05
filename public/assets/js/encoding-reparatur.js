/* ══════════════════════════════════════════════════
   encoding-reparatur.js · Encoding-Reparatur
   Repariert Mojibake: UTF-8-Bytes, die als Latin-1
   oder Windows-1252 gelesen wurden (z. B. 'GrÃ¼ÃŸe',
   'â‚¬'). Zwei Stufen: allgemeiner UTF-8-Algorithmus
   plus kuratierte CP1252-Ersatzzeichen-Karte.
   Reine Textverarbeitung, 100% lokal im Browser.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* -------- pure engine (node-testable) -------- */

  var REPL = '�';

  /**
   * Dekodiert ein Byte-Array als UTF-8.
   * Ungueltige Bytefolgen werden als U+FFFD ausgegeben,
   * damit der Aufrufer das Ergebnis verwerfen kann.
   */
  function decodeUtf8(bytes) {
    var out = '';
    var i = 0;
    var n = bytes.length;
    while (i < n) {
      var b = bytes[i++];
      if (b < 0x80) { out += String.fromCharCode(b); continue; }
      var cp = -1;
      var extra = 0;
      if (b >= 0xC2 && b <= 0xDF) { cp = b & 0x1F; extra = 1; }
      else if (b >= 0xE0 && b <= 0xEF) { cp = b & 0x0F; extra = 2; }
      else if (b >= 0xF0 && b <= 0xF4) { cp = b & 0x07; extra = 3; }
      if (extra === 0) { out += REPL; continue; }
      var ok = true;
      for (var k = 0; k < extra; k++) {
        if (i >= n) { ok = false; break; }
        var c = bytes[i];
        if ((c & 0xC0) !== 0x80) { ok = false; break; }
        cp = (cp << 6) | (c & 0x3F);
        i++;
      }
      if (!ok || cp < 0 || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) { out += REPL; continue; }
      if (cp > 0xFFFF) {
        var s = cp - 0x10000;
        out += String.fromCharCode(0xD800 + (s >> 10), 0xDC00 + (s & 0x3FF));
      } else {
        out += String.fromCharCode(cp);
      }
    }
    return out;
  }

  /**
   * Allgemeiner Algorithmus: jedes Zeichen mit Code 0-255 wird
   * zu seinem Byte, der Byte-Puffer wird als UTF-8 gelesen.
   * Zeichen ausserhalb von Latin-1 (> 255) bleiben unangetastet.
   */
  function utf8AsLatin1(text) {
    var out = '';
    var run = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c <= 0xFF) { run.push(c); continue; }
      if (run.length) { out += decodeUtf8(run); run = []; }
      out += text.charAt(i);
    }
    if (run.length) out += decodeUtf8(run);
    return out;
  }

  /* Kuratierte Karte fuer CP1252-eigene Ersatzzeichen.
     U+0080-U+009F haben in CP1252 sichtbare Zeichen, die der
     allgemeine UTF-8-Lauf nicht wiederherstellen kann.
     Eigliche Paare, laengere Sequenzen zuerst. */
  var CP1252_PAIRS = [
    /* 3-Byte-Sequenzen (UTF-8 E2 xx xx) */
    ['â‚¬', '€'],          /* E2 82 AC */
    ['â€™', '’'],   /* E2 80 99 */
    ['â€œ', '“'],   /* E2 80 9C */
    ['â€“', '–'],          /* E2 80 93, Halbgeviertstrich */
    ['â€”', '\u2014'],   /* E2 80 94, Geviertstrich */
    ['â€¦', '…'],          /* E2 80 A6 */
    ['â€¢', '•'],          /* E2 80 A2 */
    ['â€˜', '‘'],   /* E2 80 98 */
    ['â„¢', '✓'],          /* E2 9C 93 */
    /* 0x9D ist in CP1252 nicht belegt: je nach System U+009D oder U+FFFD */
    ['â€', '”'],
    ['â€�', '”'],
    /* 2-Byte-Sequenzen */
    ['Â«', '«'],           /* C2 AB */
    ['Â»', '»'],           /* C2 BB */
    ['Â°', '°'],           /* C2 B0 */
    ['Â§', '§'],           /* C2 A7 */
    ['Âµ', 'µ'],           /* C2 B5 */
    ['Ã¤', 'ä'],           /* C3 A4 */
    ['Ã¶', 'ö'],           /* C3 B6 */
    ['Ã¼', 'ü'],           /* C3 BC */
    ['Ã„', 'Ä'],           /* C3 84 */
    ['Ã–', 'Ö'],           /* C3 96 */
    ['Ãœ', 'Ü'],           /* C3 9C */
    ['ÃŸ', 'ß'],           /* C3 9F */
    ['Ã©', 'é'],           /* C3 A9 */
    ['Ã¨', 'è'],           /* C3 A8 */
    ['Ã¡', 'á'],           /* C3 A1 */
    ['Ã­', 'í'],           /* C3 AD */
    ['Ã³', 'ó'],           /* C3 B3 */
    ['Ãº', 'ú'],           /* C3 BA */
    ['Ã±', 'ñ'],           /* C3 B1 */
    ['Ã§', 'ç'],           /* C3 A7 */
    ['Ã ', 'à'],     /* C3 A0, geschuetztes Leerzeichen */
    ['Â ', ' ']      /* C2 A0, geschuetztes Leerzeichen */
  ];
  CP1252_PAIRS.sort(function (a, b) { return b[0].length - a[0].length; });

  var KIND_OK = 'vermutlich bereits korrekt';
  var KIND_UTF8 = 'UTF-8 als Latin-1 gelesen';
  var KIND_CP = 'Windows-1252-Artefakte';

  function applyMap(text) {
    var out = text;
    for (var i = 0; i < CP1252_PAIRS.length; i++) {
      if (out.indexOf(CP1252_PAIRS[i][0]) !== -1) {
        out = out.split(CP1252_PAIRS[i][0]).join(CP1252_PAIRS[i][1]);
      }
    }
    return out;
  }

  function clean(cand, src) {
    return cand !== src && cand.indexOf(REPL) === -1;
  }

  /* Lead-Bytes, mit denen ein Mojibake-Lauf praktisch immer beginnt.
     Ohne diese Heuristik wuerde der allgemeine Lauf auch korrekten
     Text verfaelschen, dessen Zeichen zufaellig gueltige Bytepaare
     bilden (z. B. 'ä' gefolgt von 'Â'). */
  var MOJIBAKE_LEAD = /[ÃÂâðÎ]/;

  function looksMojibake(text) {
    return MOJIBAKE_LEAD.test(text);
  }

  /**
   * Repariert Mojibake in deutschem (oder allgemeinem) Text.
   * Rueckgabe: {fixed, changed, kind}
   */
  function repairText(text) {
    if (text === null || text === undefined) {
      return { fixed: '', changed: false, kind: KIND_OK };
    }
    if (typeof text !== 'string') text = String(text);
    if (text === '') return { fixed: text, changed: false, kind: KIND_OK };

    /* Stufe 1: allgemeiner UTF-8-Algorithmus */
    if (looksMojibake(text)) {
      var gen = utf8AsLatin1(text);
      if (clean(gen, text)) return { fixed: gen, changed: true, kind: KIND_UTF8 };
    }

    /* Stufe 2: kuratierte CP1252-Karte auf dem Original */
    var mapped = applyMap(text);
    if (clean(mapped, text)) return { fixed: mapped, changed: true, kind: KIND_CP };

    /* Stufe 3: erst UTF-8, danach die verbliebenen CP1252-Artefakte */
    if (looksMojibake(text)) {
      var both = applyMap(utf8AsLatin1(text));
      if (clean(both, text)) return { fixed: both, changed: true, kind: KIND_CP };
    }

    return { fixed: text, changed: false, kind: KIND_OK };
  }

  /* -------- UI -------- */

  var EXAMPLE = 'GrÃ¼ÃŸe aus MÃ¼nchen: Die RÃ¼ckmeldung kostet 12 â‚¬ fÃ¼r den laufenden Betrieb.';

  var lastFixed = '';

  function renderOutput(res) {
    var el = E('tool-output');
    if (!el) return;
    lastFixed = res.fixed;
    if (!res.fixed) {
      el.innerHTML = '<p style="color:var(--mut);font-size:.9rem">Kein Text zum Reparieren.</p>';
      return;
    }
    var badge = res.changed
      ? '<span style="color:#7fd18c">Text wurde repariert</span>'
      : '<span style="color:var(--mut)">Text ist unverändert</span>';
    var html = '<div class="result-display" style="display:grid;gap:10px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:#0b1218;border:1px solid var(--line);border-radius:8px;padding:8px 12px">';
    html += '<span style="font-size:.85rem">' + badge + '</span>';
    html += '<span style="font-size:.8rem;color:var(--mut)">' + esc(res.kind) + '</span>';
    html += '</div>';
    html += '<pre style="margin:0;background:#0b1218;border:1px solid var(--line);border-radius:8px;padding:10px 12px;overflow:auto;max-height:320px">';
    html += '<code style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.85rem;color:var(--fg);white-space:pre-wrap;word-break:break-word">' + esc(res.fixed) + '</code></pre>';
    html += '<div class="row"><button type="button" class="btn-app" id="enc-copy">Ergebnis kopieren</button></div>';
    html += '</div>';
    el.innerHTML = html;
    var cp = E('enc-copy');
    if (cp) cp.addEventListener('click', copyResult);
  }

  function copyResult() {
    if (window.copyToClipboard) window.copyToClipboard(lastFixed);
    else if (navigator.clipboard) navigator.clipboard.writeText(lastFixed);
  }

  function run() {
    var ta = E('enc-text');
    if (!ta) return;
    renderOutput(repairText(ta.value));
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="field"><label>Text mit Encoding-Fehlern</label>' +
      '<textarea id="enc-text" rows="7" placeholder="z. B. GrÃ¼ÃŸe aus MÃ¼nchen" ' +
      'style="background:#0b1218;border:1px solid var(--line);border-radius:8px;color:var(--fg);padding:8px;font-size:.9rem;width:100%;font-family:ui-monospace,Menlo,Consolas,monospace;resize:vertical"></textarea></div>' +
      '<div class="row"><button type="button" class="btn-app">Reparieren</button></div>';

    var ta = E('enc-text');
    if (ta && !ta.value) ta.value = EXAMPLE;

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
      repairText: repairText,
      utf8AsLatin1: utf8AsLatin1,
      applyMap: applyMap,
      decodeUtf8: decodeUtf8
    };
  }
})();
