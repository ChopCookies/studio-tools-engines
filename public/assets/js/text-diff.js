/* ══════════════════════════════════════════════════
   text-diff.js — Text-Unterschied (Diff) Tool
   Vergleicht zwei Texte Zeile für Zeile und markiert
   hinzugefügte, entfernte und unveränderte Zeilen.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* -------- pure diff engine (node-testable) -------- */

  // Split into lines, keeping a trailing empty line if the text ends with \n.
  function toLines(text) {
    if (text === '') return [];
    var lines = text.split('\n');
    if (text.charAt(text.length - 1) === '\n') {
      lines.pop(); // drop the empty chunk after the final newline
    }
    return lines;
  }

  // Longest Common Subsequence (line-based). Returns an array of [aIdx, bIdx]
  // pairs that are part of the LCS (matching lines aligned by content).
  function lcsLines(a, b) {
    var n = a.length, m = b.length;
    // dp[i][j] = LCS length of a[i..] and b[j..] (bottom-up, O(n*m))
    var dp = [];
    for (var i = n; i >= 0; i--) {
      dp[i] = new Array(m + 1).fill(0);
      for (var j = m; j >= 0; j--) {
        if (i === n || j === m) { dp[i][j] = 0; continue; }
        if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    var pairs = [];
    var x = 0, y = 0;
    while (x < n && y < m) {
      if (a[x] === b[y]) { pairs.push([x, y]); x++; y++; }
      else if (dp[x + 1][y] >= dp[x][y + 1]) x++;
      else y++;
    }
    return pairs;
  }

  // Build a diff. Returns array of ops:
  //   {type:'same'|'add'|'del', aIndex, bIndex, line}
  // aIndex/bIndex are positions in the respective source; -1 when absent.
  function diffTexts(textA, textB) {
    var a = toLines(textA);
    var b = toLines(textB);
    var pairs = lcsLines(a, b);
    var lcsIdxs = {};
    for (var k = 0; k < pairs.length; k++) lcsIdxs[pairs[k][0]] = pairs[k][1]; // aIdx -> bIdx

    var ops = [];
    var i = 0, j = 0;
    for (var p = 0; p < pairs.length; p++) {
      var targetA = pairs[p][0];
      var targetB = pairs[p][1];
      // emit deletions in a before the next matched line
      while (i < targetA) { ops.push({ type: 'del', aIndex: i, bIndex: -1, line: a[i] }); i++; }
      // emit additions in b before the next matched line
      while (j < targetB) { ops.push({ type: 'add', aIndex: -1, bIndex: j, line: b[j] }); j++; }
      // matched line
      ops.push({ type: 'same', aIndex: targetA, bIndex: targetB, line: a[targetA] });
      i = targetA + 1; j = targetB + 1;
    }
    while (i < a.length) { ops.push({ type: 'del', aIndex: i, bIndex: -1, line: a[i] }); i++; }
    while (j < b.length) { ops.push({ type: 'add', aIndex: -1, bIndex: j, line: b[j] }); j++; }
    return ops;
  }

  function count(ops) {
    var c = { add: 0, del: 0, same: 0 };
    for (var i = 0; i < ops.length; i++) c[ops[i].type]++;
    return c;
  }

  /* -------- UI -------- */

  function render(ops) {
    var c = count(ops);
    var html = '<div class="result-display">';
    html += '<div style="margin-bottom:10px;font-size:.82rem;color:var(--mut)">';
    html += c.same + ' unverändert &middot; <span style="color:#9fdc9f">+' + c.add + ' hinzugefügt</span> &middot; <span style="color:#f0a3a3">&minus;' + c.del + ' entfernt</span></div>';
    html += '<div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.82rem;background:#0b1218;border:1px solid var(--line);border-radius:8px;overflow:auto;max-height:420px;padding:6px 0">';
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      var label = op.type === 'same' ? ' ' : (op.type === 'add' ? '+' : '-');
      var bg = op.type === 'same' ? 'transparent' : (op.type === 'add' ? '#1e3a2a' : '#3a1e22');
      var color = op.type === 'same' ? 'var(--fg)' : (op.type === 'add' ? '#9fdc9f' : '#f0a3a3');
      html += '<div style="display:flex;background:' + bg + ';border-left:3px solid ' + (op.type === 'add' ? '#4aa85a' : (op.type === 'del' ? '#c05050' : 'transparent')) + '">';
      html += '<span style="color:var(--mut);min-width:22px;text-align:right;padding:1px 8px;user-select:none">' + label + '</span>';
      html += '<span style="white-space:pre-wrap;padding:1px 6px;color:' + color + ';flex:1">' + esc(op.line === '' ? ' ' : op.line) + '</span>';
      html += '</div>';
    }
    html += '</div>';
    html += '<div style="margin-top:12px"><button class="btn-app" type="button" onclick="window.textDiffCopy&&textDiffCopy()">Diff kopieren</button></div>';
    html += '</div>';
    return html;
  }

  function renderOutput(ops) {
    var el = E('tool-output');
    if (!el) return;
    el.innerHTML = render(ops);
  }

  function run() {
    var a = E('td-a'), b = E('td-b');
    if (!a || !b) return;
    if (a.value === '' && b.value === '') {
      E('tool-output').innerHTML = '<p class="muted">Bitte füge beide Textfassungen ein.</p>';
      return;
    }
    var ops = diffTexts(a.value, b.value);
    renderOutput(ops);
    window.__textDiffOps = ops;
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="field"><label>Originaltext (Fassung A)</label><textarea id="td-a" placeholder="Hier den ersten Text einfügen"></textarea></div>' +
      '<div class="field"><label>Neuer Text (Fassung B)</label><textarea id="td-b" placeholder="Hier den zweiten Text einfügen"></textarea></div>' +
      '<div class="row"><button type="button" class="btn-app" style="background:var(--blue);color:#fff;border:0;border-radius:8px;padding:9px 18px;cursor:pointer">Vergleichen</button>' +
      '<button type="button" class="ghost" style="background:transparent;border:1px solid var(--line);color:var(--mut);border-radius:8px;padding:9px 14px;cursor:pointer">Beispiel laden</button></div>';

    var runBtn = inputs.querySelector('button.btn-app');
    var exampleBtn = inputs.querySelector('button.ghost');
    runBtn.addEventListener('click', run);
    exampleBtn.addEventListener('click', function () {
      E('td-a').value = 'Erste Zeile\nZweite Zeile\nDritte Zeile\nVierte Zeile';
      E('td-b').value = 'Erste Zeile\nGeänderte Zeile\nDritte Zeile\nNeue Zeile\nFünfte Zeile';
      run();
    });
    inputs.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); }
    });
  }

  window.textDiffCopy = function () {
    var ops = window.__textDiffOps || [];
    var out = [];
    for (var i = 0; i < ops.length; i++) {
      var t = ops[i].type === 'add' ? '+' : (ops[i].type === 'del' ? '-' : ' ');
      out.push(t + ' ' + ops[i].line);
    }
    var txt = out.join('\n');
    if (window.copyToClipboard) window.copyToClipboard(txt);
    else navigator.clipboard && navigator.clipboard.writeText(txt);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { diffTexts: diffTexts, toLines: toLines, lcsLines: lcsLines, count: count };
  }
})();
