/* ══════════════════════════════════════════════════
   stromkosten-rechner.js: Stromkosten-Rechner
   Berechnet die jährlichen Stromkosten eines Geräts
   anhand von Leistung, Nutzungsdauer und Strompreis.
   Bilingual DE/EN via window.__siteLang.
   Konstanten mit Stand und Quelle (keine erfundenen Werte).
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(v) { var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; }
  function fmt(n, dec) {
    return n.toLocaleString('de-DE', { minimumFractionDigits: (dec == null ? 2 : dec), maximumFractionDigits: (dec == null ? 2 : dec) });
  }
  var DE = (typeof window.__siteLang === 'undefined') || window.__siteLang === 'de';

  /* ── Konstanten (Stand: 09/2026) ──
     Strom-Default: BDEW Strompreisanalyse Herbst 2026, Haushalts-Durchschnitt
     37,0 ct/kWh (3.500-kWh-Haushalt, Neukundentarife; 2025: 39,3 ct/kWh).
     bdew.de/service/daten-und-grafiken/bdew-strompreisanalyse/
     Der Wert ist als überschreibbarer Richtwert gedacht, der eigene Tarif steht auf der Stromrechnung. */
  var STROM_DEFAULT = 0.37; // EUR/kWh, inkl. anteiliger Grundgebühr (BDEW, Stand 09/2026)

  var T = {
    geraet:       DE ? 'Gerät' : 'Device',
    leistung:     DE ? 'Leistung (Watt)' : 'Power (watts)',
    nutzung:      DE ? 'Nutzung pro Tag (Stunden)' : 'Use per day (hours)',
    tage:         DE ? 'Tage pro Jahr' : 'Days per year',
    preis:        DE ? 'Strompreis (€/kWh)' : 'Electricity price (€/kWh)',
    berechnen:    DE ? 'Berechnen' : 'Calculate',
    preis_hint:   DE ? 'Richtwert Ø Deutschland: 0,37 €/kWh (BDEW, Stand: September 2026). Tragen Sie Ihren eigenen Tarif von der Stromrechnung ein.' : 'Reference average for Germany: 0.37 €/kWh (BDEW, as of September 2026). Enter the tariff from your own electricity bill for accurate results.',
    jahreskosten: DE ? 'Jahreskosten' : 'Yearly cost',
    proMonat:     DE ? 'pro Monat' : 'per month',
    proTag:       DE ? 'pro Tag' : 'per day',
    verbrauchJahr: DE ? 'Stromverbrauch pro Jahr' : 'Electricity use per year',
    verbrauchTag:  DE ? 'Stromverbrauch pro Tag' : 'Electricity use per day'
  };

  var PRESETS = [
    { name: 'benutzerdefiniert', nameEn: 'custom', watts: '' },
    { name: 'Kühlschrank', nameEn: 'Refrigerator', watts: 150 },
    { name: 'Waschmaschine', nameEn: 'Washing machine', watts: 2000 },
    { name: 'Trockner', nameEn: 'Dryer', watts: 2500 },
    { name: 'Fernseher', nameEn: 'TV', watts: 100 },
    { name: 'Laptop', nameEn: 'Laptop', watts: 60 },
    { name: 'PC', nameEn: 'PC', watts: 300 },
    { name: 'Kaffeemaschine', nameEn: 'Coffee maker', watts: 1000 },
    { name: 'Beleuchtung', nameEn: 'Lighting', watts: 60 },
    { name: 'Haartrockner', nameEn: 'Hair dryer', watts: 1800 },
    { name: 'Staubsauger', nameEn: 'Vacuum cleaner', watts: 1200 }
  ];

  /* -------- pure calculation engine (node-testable) -------- */

  function compute(args) {
    var watts = parseFloat(args.watts) || 0;
    var hoursPerDay = parseFloat(args.hoursPerDay) || 0;
    var daysPerYear = parseFloat(args.daysPerYear) || 0;
    var pricePerKwh = parseFloat(args.pricePerKwh) || 0;

    var kwhPerDay = (watts / 1000) * hoursPerDay;
    var kwhPerYear = kwhPerDay * daysPerYear;
    var costPerYear = kwhPerYear * pricePerKwh;
    var costPerMonth = costPerYear / 12;
    var costPerDay = kwhPerDay * pricePerKwh;

    return { kwhPerDay: kwhPerDay, kwhPerYear: kwhPerYear, costPerDay: costPerDay, costPerMonth: costPerMonth, costPerYear: costPerYear };
  }

  function fmtEuro(n) {
    return fmt(n, 2) + ' €';
  }

  /* -------- UI -------- */

  function renderResult(result) {
    var html = '<div class="result-display">';
    html += '<div class="result-big">' + fmtEuro(result.costPerYear) + '</div>';
    html += '<div class="result-label">' + esc(T.jahreskosten) + '</div>';
    html += '<div class="result-rows">';
    html += '<div class="result-row"><span class="result-label">' + esc(T.proMonat) + '</span><span class="result-value">' + fmtEuro(result.costPerMonth) + '</span></div>';
    html += '<div class="result-row"><span class="result-label">' + esc(T.proTag) + '</span><span class="result-value">' + fmtEuro(result.costPerDay) + '</span></div>';
    html += '</div>';
    html += '<table class="breakdown"><tbody>';
    html += '<tr><td>' + esc(T.verbrauchJahr) + '</td><td>' + fmt(result.kwhPerYear, 2) + ' kWh</td></tr>';
    html += '<tr><td>' + esc(T.verbrauchTag) + '</td><td>' + fmt(result.kwhPerDay, 2) + ' kWh</td></tr>';
    html += '</tbody></table>';
    html += '</div>';
    return html;
  }

  function renderOutput(result) {
    var el = E('tool-output');
    if (!el) return;
    el.innerHTML = renderResult(result);
  }

  function applyPreset() {
    var sel = E('skr-geraet');
    var watts = E('skr-watts');
    if (!sel || !watts) return;
    var value = sel.value;
    for (var i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].name === value || PRESETS[i].nameEn === value) {
        watts.value = PRESETS[i].watts;
        break;
      }
    }
  }

  function run() {
    var w = E('skr-watts');
    var h = E('skr-hours');
    var d = E('skr-days');
    var p = E('skr-price');
    if (!w || !h || !d || !p) return;

    var watts = num(w.value) || 0;
    var hoursPerDay = num(h.value) || 0;
    var daysPerYear = num(d.value) || 0;
    var pricePerKwh = num(p.value) || 0;

    var result = compute({ watts: watts, hoursPerDay: hoursPerDay, daysPerYear: daysPerYear, pricePerKwh: pricePerKwh });
    renderOutput(result);
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;

    var presetOptions = '';
    for (var i = 0; i < PRESETS.length; i++) {
      var label = DE ? PRESETS[i].name : PRESETS[i].nameEn;
      var val = DE ? PRESETS[i].name : (PRESETS[i].nameEn || PRESETS[i].name);
      presetOptions += '<option value="' + esc(val) + '">' + esc(label) + '</option>';
    }

    inputs.innerHTML =
      '<div class="field"><label for="skr-geraet">' + esc(T.geraet) + '</label><select id="skr-geraet">' + presetOptions + '</select></div>' +
      '<div class="field"><label for="skr-watts">' + esc(T.leistung) + '</label><input id="skr-watts" type="number" value="" step="1" placeholder="' + (DE ? 'z.B. 100' : 'e.g. 100') + '"></div>' +
      '<div class="field"><label for="skr-hours">' + esc(T.nutzung) + '</label><input id="skr-hours" type="number" value="3" step="0.5" min="0"></div>' +
      '<div class="field"><label for="skr-days">' + esc(T.tage) + '</label><input id="skr-days" type="number" value="365" step="1" min="1"></div>' +
      '<div class="field"><label for="skr-price">' + esc(T.preis) + '</label><input id="skr-price" type="number" value="' + STROM_DEFAULT + '" step="0.01" min="0"><span class="field-hint">' + esc(T.preis_hint) + '</span></div>' +
      '<div class="row"><button type="button" class="btn-app">' + esc(T.berechnen) + '</button></div>';

    var sel = E('skr-geraet');
    var watts = E('skr-watts');
    if (sel) sel.addEventListener('change', applyPreset);
    if (watts) watts.addEventListener('keydown', onEnter);

    var btn = inputs.querySelector('button.btn-app');
    if (btn) btn.addEventListener('click', run);
  }

  function onEnter(e) {
    if (e.key === 'Enter') run();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { compute: compute, fmtEuro: fmtEuro, STROM_DEFAULT: STROM_DEFAULT, T: T };
  }
})();
