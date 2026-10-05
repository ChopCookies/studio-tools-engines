/* ══════════════════════════════════════════════════
   gamepad-tester.js: Gamepad/Controller-Test
   Prüft, ob ein angeschlossener Controller erkannt wird,
   und zeigt Buttons + Analog-Sticks live an (Gamepad-API).
   Läuft komplett lokal.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }

  /* -------- pure engine (node-testable) -------- */

  var STD_BUTTONS = [
    'A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT',
    'Zurück', 'Start', 'Stick-L', 'Stick-R',
    'DPad ↑', 'DPad ↓', 'DPad ←', 'DPad →', 'Home'
  ];

  // Normalizes a Gamepad object into a plain state object.
  function gamepadState(gp) {
    if (!gp) return null;
    var buttons = (gp.buttons || []).map(function (b) {
      var pressed = !!(b && (b.pressed || b.value > 0.5));
      var value = b ? b.value : 0;
      return { pressed: pressed, value: value };
    });
    return {
      id: gp.id || '',
      index: gp.index,
      mapping: gp.mapping || '',
      buttons: buttons,
      axes: Array.prototype.slice.call(gp.axes || [])
    };
  }

  /* -------- UI -------- */

  var rafId = null;
  var lastConnected = null;

  function renderState(st) {
    var padsEl = E('gp-areas');
    if (!padsEl) return;

    if (!st || !st.buttons.length) {
      padsEl.innerHTML = '<p class="muted">Kein Controller erkannt. Drücke eine beliebige Taste auf dem Gamepad oder verbinde es neu.</p>';
      return;
    }

    var html = '<div class="gp-pad">';
    html += '<div class="gp-name">' + esc(st.id) + '</div>';
    html += '<div class="gp-meta">' + (st.mapping === 'standard' ? 'Standard-Mapping' : 'Mapping: ' + esc(st.mapping || 'keines')) + ' · Buttons: ' + st.buttons.length + '</div>';
    html += '<div class="gp-grid">';
    for (var i = 0; i < st.buttons.length; i++) {
      var label = STD_BUTTONS[i] || ('B' + (i + 1));
      var cls = st.buttons[i].pressed ? 'gp-btn on' : 'gp-btn';
      html += '<div class="' + cls + '"><span class="gp-btn-label">' + label + '</span><span class="gp-btn-val">' + (st.buttons[i].pressed ? 'AN' : '') + '</span></div>';
    }
    html += '</div>';
    if (st.axes.length) {
      html += '<div class="gp-axes">';
      for (var a = 0; a < st.axes.length; a += 2) {
        var x = st.axes[a];
        var y = st.axes[a + 1] !== undefined ? st.axes[a + 1] : 0;
        html += '<div class="gp-stick-wrap"><div class="gp-stick"><div class="gp-dot" style="left:' + Math.round((x + 1) * 50) + '%;top:' + Math.round((y + 1) * 50) + '%"></div></div><div class="gp-axislabel">Achse ' + (a / 2 + 1) + ': ' + x.toFixed(2) + ', ' + y.toFixed(2) + '</div></div>';
      }
      html += '</div>';
    }
    html += '</div>';
    padsEl.innerHTML = html;
  }

  function poll() {
    var gps = (navigator.getGamepads ? navigator.getGamepads() : []);
    var found = null;
    for (var i = 0; i < gps.length; i++) {
      if (gps[i]) { found = gps[i]; break; }
    }
    if (found !== lastConnected) {
      lastConnected = found;
      var status = E('gp-status');
      if (status) {
        if (found) status.textContent = 'Status: Controller verbunden';
        else status.textContent = 'Status: warte auf Controller ...';
        status.className = 'gp-status ' + (found ? 'ok' : '');
      }
    }
    renderState(gamepadState(found));
    rafId = requestAnimationFrame(poll);
  }

  function start() {
    if (rafId !== null) return;
    var status = E('gp-status');
    if (status) status.textContent = 'Status: warte auf Controller ...';
    poll();
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="field"><button type="button" id="gp-start" class="btn-app">Test starten</button></div>' +
      '<div id="gp-status" class="gp-status">Noch nicht gestartet.</div>' +
      '<div id="gp-areas" class="gp-areas"></div>';

    var btn = E('gp-start');
    btn.addEventListener('click', start);
  }

  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { gamepadState: gamepadState, STD_BUTTONS: STD_BUTTONS };
  }
})();
