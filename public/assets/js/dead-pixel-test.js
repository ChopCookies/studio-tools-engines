/* ══════════════════════════════════════════════════
   dead-pixel-test.js: Pixelfehler-Test
   Zeigt den Bildschirm in Vollbild mit kräftigen
   Vollfarben (Rot, Grün, Blau, Weiß, Schwarz, Grau ...).
   Auffällige Pixel = mögliche tote/hängende Pixel.
   Zustandswechsel per Klick/Enter; nach der letzten
   Farbe (Folie 9) beendet der nächste Klick/Enter den Test.
   Esc beendet jederzeit. Läuft komplett lokal.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }

  /* -------- pure engine (node-testable) -------- */

  var PALETTE = [
    { name: 'Rot', bg: '#ff0000', fg: '#ffffff' },
    { name: 'Grün', bg: '#00ff00', fg: '#000000' },
    { name: 'Blau', bg: '#0000ff', fg: '#ffffff' },
    { name: 'Weiß', bg: '#ffffff', fg: '#000000' },
    { name: 'Schwarz', bg: '#000000', fg: '#ffffff' },
    { name: 'Grau', bg: '#808080', fg: '#ffffff' },
    { name: 'Cyan', bg: '#00ffff', fg: '#000000' },
    { name: 'Magenta', bg: '#ff00ff', fg: '#ffffff' },
    { name: 'Gelb', bg: '#ffff00', fg: '#000000' }
  ];

  function colorAt(index) {
    return PALETTE[index % PALETTE.length];
  }

  // Returns true if the given 0-based index is the LAST color (slide 9 of 9).
  function isLast(index) {
    return index >= PALETTE.length - 1;
  }

  /* -------- UI -------- */

  var overlay = null;
  var current = 0;

  // After the last color the next click/Enter ends the test instead of looping.
  function next() {
    if (isLast(current)) {
      stop();
      return;
    }
    current++;
    apply();
  }

  function apply() {
    var c = colorAt(current);
    if (overlay) {
      overlay.style.background = c.bg;
      var nameEl = overlay.querySelector('.dpt-name');
      if (nameEl) nameEl.textContent = c.name + '  (' + (current + 1) + '/' + PALETTE.length + ')';
      var tip = overlay.querySelector('.dpt-tip');
      if (tip) {
        tip.style.color = c.fg;
        tip.textContent = isLast(current)
          ? 'Letzte Farbe. Klick oder Enter beendet den Test, Esc jederzeit.'
          : 'Klicken oder Enter für nächste Farbe, Esc zum Beenden';
      }
    }
  }

  function start() {
    if (overlay) { apply(); return; }
    current = 0;
    overlay = document.createElement('div');
    overlay.className = 'dpt-overlay';
    overlay.innerHTML =
      '<div class="dpt-name">' + PALETTE[0].name + '  (1/' + PALETTE.length + ')</div>' +
      '<div class="dpt-tip">Klicken oder Enter für nächste Farbe, Esc zum Beenden</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', next);
    document.addEventListener('keydown', onKey);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () {});
    }
    apply();
  }

  function onKey(ev) {
    if (ev.key === 'Escape') { stop(); }
    else if (ev.key === 'Enter') { next(); }
  }

  function stop() {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
    if (overlay) {
      overlay.remove();
      overlay = null;
      document.removeEventListener('keydown', onKey);
    }
    var out = E('tool-output');
    if (out) out.innerHTML = '';
    var btn = E('dp-start');
    if (btn) btn.textContent = 'Vollbild-Test starten';
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="field"><button type="button" id="dp-start" class="btn-app">Vollbild-Test starten</button></div>' +
      '<p class="hint">Der Bildschirm zeigt nacheinander 9 kräftige Vollfarben. Suche nach Pixeln, die andersfarbig bleiben (tote Pixel) oder nicht mehr reagieren. Klick oder Enter wechselt die Farbe, nach der letzten (Gelb) beendet Klick oder Enter den Test, Esc beendet jederzeit.</p>';

    var btn = E('dp-start');
    btn.addEventListener('click', start);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PALETTE: PALETTE, colorAt: colorAt, isLast: isLast };
  }
})();
