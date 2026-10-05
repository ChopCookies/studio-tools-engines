/* ══════════════════════════════════════════════════
   hauskauf-nebenkosten.js | Hauskauf-Nebenkosten-Rechner (GrESt je Bundesland)
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  var DE = (window.__siteLang !== 'en');
  var T = {
    calc: DE ? 'Berechnen' : 'Calculate',
    placeholder: DE ? 'Wähle ein Bundesland, gib den Kaufpreis ein und klicke auf „Berechnen".' : 'Pick a federal state, enter the purchase price and click "Calculate".',
    err: DE ? 'Bitte einen gültigen Kaufpreis eingeben.' : 'Please enter a valid purchase price.',
    grest: DE ? 'Grunderwerbsteuer' : 'Real estate transfer tax',
    notar: DE ? 'Notar & Grundbuch' : 'Notary & land registry',
    makler: DE ? 'Makler (Ihr Anteil)' : 'Broker (your share)'
  };

  // GrESt-Sätze je Bundesland (Stand: August 2026, BMF / Landesrecht)
  // 3,5%: BY | 5,0%: BW, NI, RP, ST, TH | 5,5%: HB, HH, SN
  // 6,0%: BE, HE, MV | 6,5%: BB, NW, SL, SH
  var STATES = [
    ['Bayern', 0.035], ['Baden-Württemberg', 0.05], ['Berlin', 0.06],
    ['Brandenburg', 0.065], ['Bremen', 0.055], ['Hamburg', 0.055],
    ['Hessen', 0.06], ['Mecklenburg-Vorpommern', 0.06], ['Niedersachsen', 0.05],
    ['Nordrhein-Westfalen', 0.065], ['Rheinland-Pfalz', 0.05], ['Saarland', 0.065],
    ['Sachsen', 0.055], ['Sachsen-Anhalt', 0.05], ['Schleswig-Holstein', 0.065],
    ['Thüringen', 0.05]
  ];

  function E(id) { return document.getElementById(id); }
  function num(v) { return parseFloat(String(v).replace(',', '.')) || 0; }
  function fmt(n) { return n.toLocaleString(DE ? 'de-DE' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
  }

  function rateFor(state) {
    for (var i = 0; i < STATES.length; i++) {
      if (STATES[i][0] === state) return STATES[i][1];
    }
    return 0.05;
  }

  function render(copyText, bigText, lines) {
    var html = '<div class="result-display">';
    html += '<div style="text-align:center;padding:18px;margin-bottom:12px">';
    html += '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px">' + (DE ? 'Nebenkosten gesamt' : 'Total ancillary costs') + '</div>';
    html += '<div style="font-size:2rem;font-weight:800;color:var(--accent)">' + bigText + '</div>';
    html += '</div>';
    html += '<div class="card" style="padding:12px;margin-bottom:8px;font-size:0.85rem">';
    for (var i = 0; i < lines.length; i++) {
      html += '<div style="padding:3px 0">' + lines[i] + '</div>';
    }
    html += '</div>';
    html += '<button class="btn btn-primary copy-btn" data-copy="' + esc(copyText) + '">' + (DE ? 'Ergebnis kopieren' : 'Copy result') + '</button>';
    html += '</div>';
    return html;
  }

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var state = E('hk-state').value;
    var price = num(E('hk-price').value);
    if (price <= 0) {
      output.innerHTML = '<p class="text-muted">' + T.err + '</p>';
      return;
    }
    var g = price * rateFor(state);
    var notar = price * (num(E('hk-notar').value) || 1.5) / 100;
    var maklerRate = num(E('hk-makler').value) / 100;
    var makler = price * maklerRate;
    var total = g + notar + makler;

    output.innerHTML = render(
      (T.grest + ': ' + fmt(g) + ' EUR; ' + T.notar + ': ' + fmt(notar) + ' EUR; ' + T.makler + ': ' + fmt(makler) + ' EUR; Gesamt: ' + fmt(total) + ' EUR'),
      fmt(total) + ' €',
      [
        '<strong>' + state + ' · ' + T.grest + ' (' + (rateFor(state) * 100).toFixed(1).replace('.', ',') + '&nbsp;%):</strong> ' + fmt(g) + ' €',
        '<strong>' + T.notar + ' (' + fmt(num(E('hk-notar').value) || 1.5, 0).replace('.', ',') + '&nbsp;%):</strong> ' + fmt(notar) + ' €',
        '<strong>' + T.makler + ' (' + (maklerRate * 100).toFixed(2).replace('.', ',') + '&nbsp;%):</strong> ' + fmt(makler) + ' €',
        '<strong>' + (DE ? 'Nebenkosten gesamt:' : 'Total ancillary costs:') + '</strong> ' + fmt(total) + ' €',
        '<div style="opacity:.75;margin-top:6px">' + (DE
          ? 'Richtwerte. Notar/Grundbuch ca. 1,5&nbsp;% und Makleranteil schwanken; Steuersätze je Bundesland können sich ändern (Stand: August 2026).'
          : 'Estimates. Notary/land registry ~1.5% and broker share vary; state tax rates may change (as of August 2026).') + '</div>'
      ]
    );

    // Playbook integration: report this finished step (client-side only).
    if (total > 0 && window.playbook) window.playbook.report({
      tool: 'hauskauf-nebenkosten',
      summary: (window.__siteLang === 'en' ? 'Ancillary costs: ' : 'Nebenkosten: ') +
        fmt(total) + ' EUR'
    });
  }

  function setup() {
    var inputs = E('tool-inputs');
    var output = E('tool-output');
    if (!inputs || !output) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary btn-generate';
    btn.textContent = T.calc;
    inputs.appendChild(btn);
    btn.addEventListener('click', run);
    inputs.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && e.target && e.target.matches('input, select')) {
        e.preventDefault();
        btn.click();
      }
    });
    output.innerHTML = '<p class="text-muted">' + T.placeholder + '</p>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { rateFor: rateFor, STATES: STATES };
  }
})();
