/* ══════════════════════════════════════════════════
   batteriespeicher-rechner.js: Batteriespeicher Rechner (Schätzung)
   Whether a home battery storage system pays off financially.
   - The battery raises self-consumption by extraSelfShare percentage
     points of the PV production.
   - Savings = additionally self-consumed energy, valued at the (escalating)
     electricity price, reduced by round-trip losses.
   - Honest framing: batteries often do NOT pay back financially; the value is
     usually independence + a higher self-consumption rate.
   This is an ESTIMATE with adjustable assumptions.
   Runs 100% in the browser.
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  var DE = (window.__siteLang !== 'en');

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(id, fallback) {
    var raw = E(id) ? E(id).value : '';
    var v = parseFloat(String(raw).replace(',', '.').replace(/[^0-9.]/g, ''));
    return (!v || isNaN(v)) ? fallback : v;
  }
  var FMTe = new Intl.NumberFormat((DE ? 'de-DE' : 'en-US'), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  var T = {
    calc: DE ? 'Berechnen' : 'Calculate',
    hint: DE ? 'Speichergröße, Kosten und Ertrag eingeben, dann auf „Berechnen“ klicken. Schätzung über die Nutzungsdauer, siehe Hinweis.' : 'Enter battery size, cost and yield, then click Calculate. Estimate over the service life, see note.',
    empty: DE ? 'Bitte gültige Werte für Speichergröße, Kosten und Strompreis eingeben.' : 'Please enter valid values for battery size, cost and electricity price.',
    title: DE ? 'Batteriespeicher: lohnt es sich? (Schätzung)' : 'Battery storage: is it worth it? (estimate)',
    savings1: DE ? 'Ersparnis im 1. Jahr' : 'Year-1 savings',
    result: DE ? 'Ergebnis nach Laufzeit' : 'Result after service life',
    poor: DE ? 'Der Speicher gleicht seine Kosten in der angenommenen Laufzeit voraussichtlich nicht aus. Sein Wert liegt meist in Unabhängigkeit und höherem Eigenverbrauch, nicht in der Rendite.' : 'The battery is unlikely to cover its cost within the assumed service life. Its value is usually independence and higher self-consumption, not financial return.',
    good: DE ? 'Unter diesen Annahmen gleicht der Speicher seine Kosten innerhalb der Laufzeit aus.' : 'Under these assumptions the battery covers its cost within the service life.',
    extra: DE ? 'zusätzlich selbst verbraucht' : 'additional self-consumed',
    note: DE ? 'Reine Schätzung. Speicher rechnen sich finanziell oft erst bei hohen Strompreisen, hoher Eigenverbrauchsquote oder ohne Netznutzung. Degradation, Wirkungsgrad und reale Zyklen beeinflussen das Ergebnis. Kein Beratungsersatz.' : 'Pure estimate. Batteries often only pay off at high electricity prices, high self-consumption or without grid use. Degradation, efficiency and real cycles affect the result. Not a substitute for advice.',
    stand: DE ? 'Referenzwerte: Strompreis 37 ct/kWh (BDEW-Strompreisanalyse Herbst 2026, Durchschnitt Haushalte), Speicherkosten je kWh üblich 300 bis 700 Euro, Marktdurchschnitt 2026 rund 315 Euro. Schätzung, keine Anlageberatung.' : 'Reference values: electricity 37 ct/kWh (BDEW price analysis, autumn 2026, household average), battery cost typically 300 to 700 euros per kWh, 2026 market average around 315 euros. Estimate, not investment advice.'
  };

  var YEARS = 15;
  var DEGRADATION = 0.004;
  var ESCALATION_DEFAULT = 3;

  function compute(capacityKwh, cost, priceCt, extraShare, yieldKwh, lifeYears, roundTrip, escalation) {
    var priceY1 = priceCt / 100;
    var rte = roundTrip / 100;
    var extraKwh1 = yieldKwh * (extraShare / 100);
    var cum = [0], pv = {};
    cum[0] = -cost;
    var reached = false;
    for (var y = 1; y <= lifeYears; y++) {
      var eff = yieldKwh * Math.pow(1 - DEGRADATION, y - 1);
      var priceY = priceY1 * Math.pow(1 + escalation / 100, y - 1);
      var benefit = eff * (extraShare / 100) * rte * priceY;
      pv[y] = Math.round(benefit);
      cum[y] = cum[y - 1] + benefit;
      if (!reached && cum[y] >= 0) {
        var prev = cum[y - 1], cur = benefit;
        pv.payback = Math.round((y - 1 + (0 - prev) / cur) * 10) / 10;
        reached = true;
      }
    }
    pv.savings1 = Math.round(extraKwh1 * rte * priceY1);
    pv.result = Math.round(cum[lifeYears]);
    pv.lifeYears = lifeYears;
    return pv;
  }

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var capacityKwh = num('bat-kwh', 10);
    var cost = num('bat-kosten', 6000);
    var priceCt = num('bat-preis', 37);
    var extraShare = num('bat-extra', 15);
    var yieldKwh = num('bat-ertrag', 8000);
    var lifeYears = parseInt((E('bat-zeit') && E('bat-zeit').value) || '15', 10);
    var roundTrip = num('bat-wir', 90);
    var escalation = num('bat-teuer', ESCALATION_DEFAULT);
    if (extraShare < 0) extraShare = 0;
    if (!yieldKwh || yieldKwh <= 0 || !priceCt || priceCt <= 0 || !cost) {
      output.innerHTML = '<p class="text-muted">' + esc(T.empty) + '</p>'; return;
    }
    var r = compute(capacityKwh, cost, priceCt, extraShare, yieldKwh, lifeYears, roundTrip, escalation);

    output.innerHTML =
      '<div class="result-display">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">' +
          '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.savings1) + '</div><div style="font-size:1.25rem;font-weight:800">' + FMTe.format(r.savings1) + '</div></div>' +
          '<div class="card" style="padding:14px;text-align:center;border-color:' + (r.result >= 0 ? 'var(--success)' : 'var(--error)') + '"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.result) + ' (' + r.lifeYears + ' ' + (DE ? 'Jahre' : 'years') + ')</div><div style="font-size:1.25rem;font-weight:800;color:' + (r.result >= 0 ? 'var(--success)' : 'var(--error)') + '">' + (r.result >= 0 ? '+' : '') + FMTe.format(r.result) + '</div></div>' +
        '</div>' +
        '<div class="card" style="padding:12px;margin-bottom:10px;font-size:0.9rem;display:flex;justify-content:space-between"><span>' + esc(T.extra) + '</span><span style="font-weight:800">' + Math.round(yieldKwh * extraShare / 100) + ' kWh/Jahr</span></div>' +
        '<p style="font-size:0.85rem;margin-bottom:8px;color:' + (r.result >= 0 ? 'var(--success)' : 'var(--error)') + '">' + esc(r.result >= 0 ? T.good : T.poor) + '</p>' +
        '<p style="font-size:0.75rem;color:var(--text-muted);line-height:1.5">' + esc(T.note) + '</p>' +
        '<p style="font-size:0.7rem;color:var(--text-muted);line-height:1.4">' + esc(T.stand) + '</p>' +
      '</div>';
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
    btn.addEventListener('click', function() { if (window.trackAction) window.trackAction('generate'); run(); });
    inputs.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && e.target && e.target.matches('input, select')) { e.preventDefault(); btn.click(); }
    });
    output.innerHTML = '<p class="text-muted">' + esc(T.hint) + '</p>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  if (typeof module !== 'undefined' && module.exports) module.exports = { compute: compute, YEARS: YEARS };
})();
