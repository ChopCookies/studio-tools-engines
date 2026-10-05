/* ══════════════════════════════════════════════════
   robots-txt-generator.js — Robots.txt-Generator
   Baut eine robots.txt-Datei aus Regeln zusammen.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* -------- pure engine (node-testable) -------- */

  function norm(s) { return String(s == null ? '' : s).trim(); }

  // Build robots.txt content from rules.
  // userAgents: array of strings (e.g. ['*'] or ['Googlebot','Bingbot'])
  // rules: array of {type:'allow'|'disallow', path}
  // sitemap: string URL (optional)
  // Returns the robots.txt text.
  function buildRobots(opts) {
    var userAgents = Array.isArray(opts.userAgents) && opts.userAgents.length ? opts.userAgents.map(norm).filter(Boolean) : ['*'];
    var rules = Array.isArray(opts.rules) ? opts.rules : [];
    var sitemap = norm(opts.sitemap);
    var host = norm(opts.host);

    var lines = [];
    lines.push('# robots.txt erstellt mit dem Robots.txt-Generator');
    lines.push('# Host: ' + (host || 'Ihre-Domain.de'));

    for (var i = 0; i < userAgents.length; i++) {
      lines.push('');
      lines.push('User-agent: ' + userAgents[i]);
      var hasRule = false;
      for (var r = 0; r < rules.length; r++) {
        if (rules[r].userAgent && rules[r].userAgent !== userAgents[i] && rules[r].userAgent !== '*') continue;
        var type = rules[r].type === 'allow' ? 'Allow' : 'Disallow';
        var path = norm(rules[r].path);
        if (path === '') continue;
        lines.push(type + ': ' + path);
        hasRule = true;
      }
      if (!hasRule) {
        lines.push('Disallow:');
      }
    }

    if (sitemap) {
      lines.push('');
      lines.push('Sitemap: ' + sitemap);
    }
    return lines.join('\n');
  }

  // Count rules / validate a path
  function isValidPath(p) {
    var s = String(p == null ? '' : p).trim();
    if (s === '') return true; // empty means allow all
    return s.charAt(0) === '/';
  }

  /* -------- UI -------- */

  function renderOutput(txt) {
    var el = E('tool-output');
    if (!el) return;
    var lines = txt.split('\n').length;
    var html = '<div class="result-display">';
    html += '<textarea readonly style="width:100%;min-height:240px;background:#0b1218;border:1px solid var(--line);border-radius:8px;color:var(--fg);padding:10px;font-family:ui-monospace,monospace;font-size:.82rem" id="rb-out">' + esc(txt) + '</textarea>';
    html += '</div>';
    html += '<div style="margin-top:10px;font-size:.82rem;color:var(--mut)">' + lines + ' Zeilen &middot; Datei: robots.txt im Webroot ablegen</div>';
    el.innerHTML = html;
  }

  function collectRules() {
    var rules = [];
    var rows = document.querySelectorAll('.rb-row');
    for (var i = 0; i < rows.length; i++) {
      var typeSel = rows[i].querySelector('select.rb-type');
      var pathIn = rows[i].querySelector('input.rb-path');
      var uaIn = rows[i].querySelector('input.rb-ua');
      var type = typeSel && typeSel.value === 'allow' ? 'allow' : 'disallow';
      var p = pathIn ? pathIn.value : '';
      var ua = uaIn ? uaIn.value : '';
      if (p.trim() === '') continue;
      rules.push({ type: type, path: p, userAgent: ua.trim() || '*' });
    }
    return rules;
  }

  function run() {
    var uaField = E('rb-useragents');
    var userAgents = uaField.value.split(',').map(norm).filter(Boolean);
    var rules = collectRules();
    var txt = buildRobots({
      userAgents: userAgents,
      rules: rules,
      sitemap: E('rb-sitemap').value,
      host: E('rb-host').value
    });
    renderOutput(txt);
  }

  function addRow(rules) {
    var container = E('rb-rows');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'rb-row';
    div.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;align-items:center';
    var prev = rules || {};
    div.innerHTML =
      '<select class="rb-type" style="background:#0b1218;border:1px solid var(--line);border-radius:6px;color:var(--fg);padding:7px"><option value="disallow"' + (prev.type === 'allow' ? '' : ' selected') + '>Blocken (Disallow)</option><option value="allow"' + (prev.type === 'allow' ? ' selected' : '') + '>Erlauben (Allow)</option></select>' +
      '<input class="rb-ua" placeholder="User-agent (leer = alle)" value="' + esc(norm(prev.userAgent === '*' ? '' : prev.userAgent)) + '" style="width:150px;background:#0b1218;border:1px solid var(--line);border-radius:6px;color:var(--fg);padding:7px">' +
      '<input class="rb-path" placeholder="/pfad" value="' + esc(norm(prev.path)) + '" style="flex:1;min-width:120px;background:#0b1218;border:1px solid var(--line);border-radius:6px;color:var(--fg);padding:7px">' +
      '<button type="button" class="rb-del" style="background:transparent;border:1px solid var(--line);color:var(--err);border-radius:6px;padding:7px 10px;cursor:pointer">Entfernen</button>';
    div.querySelector('.rb-del').addEventListener('click', function () { container.removeChild(div); });
    container.appendChild(div);
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="field"><label>User-Agents (kommagetrennt; leer oder * = alle)</label><input type="text" id="rb-useragents" value="*" placeholder="*"></div>' +
      '<div class="field"><label>Sitemap-URL</label><input type="text" id="rb-sitemap" placeholder="https://beispiel.de/sitemap.xml"></div>' +
      '<div class="field"><label>Host / Domain</label><input type="text" id="rb-host" placeholder="beispiel.de"></div>' +
      '<div class="field"><label>Regeln</label><div id="rb-rows"></div>' +
      '<button type="button" class="ghost" id="rb-add" style="background:transparent;border:1px solid var(--line);color:var(--blue2);border-radius:8px;padding:8px 14px;cursor:pointer">+ Regel hinzufügen</button></div>' +
      '<div class="row"><button type="button" class="btn-app" style="background:var(--blue);color:#fff;border:0;border-radius:8px;padding:9px 18px;cursor:pointer">robots.txt erzeugen</button>' +
      '<button type="button" class="ghost" id="rb-example" style="background:transparent;border:1px solid var(--line);color:var(--mut);border-radius:8px;padding:9px 14px;cursor:pointer">Beispiel laden</button></div>';

    // add two default rows
    addRow({ type: 'disallow', path: '/admin/', userAgent: '*' });
    addRow({ type: 'allow', path: '/öffentlich/', userAgent: '*' });

    E('rb-add').addEventListener('click', function () { addRow({ type: 'disallow' }); });
    E('rb-example').addEventListener('click', function () {
      E('rb-useragents').value = '*';
      E('rb-sitemap').value = 'https://studio-tools.online/sitemap.xml';
      E('rb-host').value = 'studio-tools.online';
      var rows = E('rb-rows');
      rows.innerHTML = '';
      addRow({ type: 'disallow', path: '/admin/' });
      addRow({ type: 'allow', path: '/public/' });
      addRow({ type: 'disallow', path: '/impressum' });
      run();
    });

    var runBtn = inputs.querySelector('button.btn-app');
    runBtn.addEventListener('click', run);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildRobots: buildRobots, isValidPath: isValidPath, norm: norm };
  }
})();
