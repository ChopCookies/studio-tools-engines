/* ══════════════════════════════════════════════════
   pendlerpauschale-rechner.js: Pendlerpauschale-Rechner
   Berechnet die Entfernungspauschale (Pendlerpauschale)
   für die einfache Strecke zur Arbeit. Nur die einfache
   Entfernung zählt, nie die Hin- und Rückfahrt.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
  }

  // Höchstgrenze der Entfernungspauschale pro Jahr (§ 9 Abs. 2 EStG). Gilt nicht,
  // wenn die Fahrt mit einem eigenen oder überlassenen Kraftwagen (Pkw) erfolgt.
  var JAERES_HOECHSTGRENZE = 4500;

  /* -------- pure calculation engine (node-testable) -------- */

  // Satz je Jahr (Entfernungspauschale, einfache Strecke):
  //   bis 2020: 0,30 €/km pauschal
  //   2021:     0,30 €/km für die ersten 20 km, ab dem 21. km 0,35 €/km
  //   2022-2025: 0,30 €/km für die ersten 20 km, ab dem 21. km 0,38 €/km
  //   ab 2026:   0,38 €/km ab dem ersten Kilometer (Steueränderungsgesetz 2025)
  // vehicle: 'car' = eigenes Auto oder Firmenwagen (keine Höchstgrenze);
  //          'oev' = ÖPNV, Fahrrad oder zu Fuß (Höchstgrenze 4.500 €/Jahr)
  function compute(args) {
    var km = Number(args && args.km) || 0;
    var daysPerYear = Number(args && args.daysPerYear) || 0;
    var year = Number(args && args.year) || 2026;
    var vehicle = (args && args.vehicle) || 'car';

    if (km < 0) km = 0;
    if (daysPerYear < 0) daysPerYear = 0;

    var annual, rateNote, capNote = '';
    var isCar = (vehicle !== 'oev');

    if (year >= 2026) {
      annual = daysPerYear * km * 0.38;
      rateNote = 'Seit dem 1. Januar 2026 gilt eine einheitliche Entfernungspauschale von 0,38 € pro Kilometer, und zwar ab dem ersten Kilometer (Steueränderungsgesetz 2025).';
    } else if (year === 2021) {
      annual = daysPerYear * (Math.min(km, 20) * 0.30 + Math.max(0, km - 20) * 0.35);
      rateNote = 'Im Jahr 2021 galt die gestaffelte Entfernungspauschale: 0,30 € pro Kilometer für die ersten 20 km, ab dem 21. Kilometer 0,35 € pro Kilometer.';
    } else if (year >= 2022) {
      annual = daysPerYear * (Math.min(km, 20) * 0.30 + Math.max(0, km - 20) * 0.38);
      rateNote = 'Für die Jahre 2022 bis 2025 galt die gestaffelte Entfernungspauschale: 0,30 € pro Kilometer für die ersten 20 km, ab dem 21. Kilometer 0,38 € pro Kilometer.';
    } else {
      annual = daysPerYear * km * 0.30;
      rateNote = 'Bis einschließlich 2020 galt ein einheitlicher Satz von 0,30 € pro Kilometer für die gesamte einfache Strecke.';
    }

    var capped = false;
    if (!isCar && annual > JAERES_HOECHSTGRENZE) {
      annual = JAERES_HOECHSTGRENZE;
      capped = true;
      capNote = 'Da Sie nicht mit einem eigenen oder vom Arbeitgeber gestellten Pkw fahren, ist die Entfernungspauschale auf die Höchstgrenze von 4.500 € im Jahr begrenzt.';
    }

    var monthly = annual / 12;

    return { annual: annual, monthly: monthly, rateNote: rateNote, capNote: capNote, capped: capped };
  }

  function fmtEuro(n) {
    return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  /* -------- UI -------- */

  function renderResult(result) {
    var html = '<div class="result-display">';
    html += '<div class="result-big">' + fmtEuro(result.annual) + '</div>';
    html += '<div class="result-label">Jahresbetrag</div>';
    html += '<div class="result-rows">';
    html += '<div class="result-row"><span class="result-label">pro Monat</span><span class="result-value">' + fmtEuro(result.monthly) + '</span></div>';
    html += '</div>';
    html += '<p class="note-legal">' + esc(result.rateNote) + '</p>';
    if (result.capNote) {
      html += '<p class="note-legal">' + esc(result.capNote) + '</p>';
    }
    html += '<p class="note-legal">Es zählt ausschließlich die einfache Entfernung zur Arbeit, nicht die Hin- und Rückfahrt. Die Berechnung ist rein rechnerisch und ersetzt keine Steuerberatung.</p>';
    html += '</div>';
    return html;
  }

  function renderOutput(result) {
    var el = E('tool-output');
    if (!el) return;
    el.innerHTML = renderResult(result);
  }

  function run() {
    var kmEl = E('pp-km');
    var daysEl = E('pp-days');
    var yearEl = E('pp-year');
    var vehEl = E('pp-vehicle');
    if (!kmEl || !daysEl || !yearEl || !vehEl) return;

    var km = parseFloat(kmEl.value) || 0;
    var daysPerYear = parseInt(daysEl.value, 10) || 0;
    var year = parseInt(yearEl.value, 10) || 2026;
    var vehicle = vehEl.value;

    var result = compute({ km: km, daysPerYear: daysPerYear, year: year, vehicle: vehicle });
    renderOutput(result);
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;

    var yearOptions = '';
    for (var y = 2020; y <= 2027; y++) {
      var sel = y === 2026 ? ' selected' : '';
      yearOptions += '<option value="' + y + '"' + sel + '>' + y + '</option>';
    }

    inputs.innerHTML =
      '<div class="field"><label for="pp-km">Einfache Entfernung (km)</label><input id="pp-km" type="number" value="20" min="0" step="1"></div>' +
      '<div class="field"><label for="pp-days">Arbeitstage pro Jahr</label><input id="pp-days" type="number" value="230" min="0" step="1"></div>' +
      '<div class="field"><label for="pp-year">Jahr</label><select id="pp-year">' + yearOptions + '</select></div>' +
      '<div class="field"><label for="pp-vehicle">Verkehrsmittel</label>' +
      '<select id="pp-vehicle">' +
      '<option value="car" selected>Eigenes Auto oder Firmenwagen</option>' +
      '<option value="oev">ÖPNV, Fahrrad oder zu Fuß</option>' +
      '</select></div>' +
      '<div class="row"><button type="button" class="btn-app">Berechnen</button></div>';

    var btn = inputs.querySelector('button.btn-app');
    btn.addEventListener('click', run);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { compute: compute, fmtEuro: fmtEuro };
  }
})();
