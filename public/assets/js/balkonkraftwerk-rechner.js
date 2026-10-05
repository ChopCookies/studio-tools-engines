/* ══════════════════════════════════════════════════
   balkonkraftwerk-rechner.js: Balkonkraftwerk Rechner (Schätzung)
   Payback model for a German plug-in balcony solar system.
   - Produced energy valued at (escalating) household electricity price.
   - Assumes the power is mostly self-consumed; no grid feed-in modelled
     (typical for plug-in systems without Einspeisung).
   - Degradation ~0.4 %/yr; no maintenance by default.
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
  var FMTn = new Intl.NumberFormat((DE ? 'de-DE' : 'en-US'), { maximumFractionDigits: 0 });

  var T = {
    calc: DE ? 'Berechnen' : 'Calculate',
    hint: DE ? 'Leistung und Kosten deines Balkonkraftwerks eingeben, dann auf „Berechnen“ klicken. Schätzung über 20 Jahre, siehe Hinweis.' : 'Enter the power and cost of your balcony solar system, then click Calculate. 20-year estimate, see note.',
    empty: DE ? 'Bitte gültige Werte für Leistung, Ertrag und Strompreis eingeben.' : 'Please enter valid values for power, yield and electricity price.',
    title: DE ? 'Balkonkraftwerk: Ersparnis & Amortisation (Schätzung)' : 'Balcony solar: savings & payback (estimate)',
    benefit1: DE ? 'Ersparnis im 1. Jahr' : 'Year-1 savings',
    payback: DE ? 'Amortisationszeit' : 'Payback period',
    profit20: DE ? 'Vorteil nach 20 Jahren' : 'Benefit after 20 years',
    years: DE ? 'Jahre' : 'years',
    noPayback: DE ? 'gleicht Kosten in 20 Jahren nicht aus' : 'does not break even within 20 years',
    self: DE ? 'eigener Verbrauch' : 'self-consumed',
    co2: DE ? 'CO₂-Einsparung pro Jahr' : 'CO₂ saved per year',
    co2Unit: DE ? 'kg CO₂/Jahr' : 'kg CO₂/yr',
    src: DE ? 'Quellen: Strommix 2025: 344 g CO₂/kWh (Umweltbundesamt). Strompreis-Mittel 2026: 37 ct/kWh (BDEW). Ertragsannahme 800 Wp im Beispiel: ca. 700 kWh/Jahr.' : 'Sources: German grid mix 2025: 344 g CO₂/kWh (UBA). 2026 average household power price: 37 ct/kWh (BDEW). Example 800 Wp yield: about 700 kWh/yr.',
    note: DE ? 'Schätzung mit von dir gewählten Annahmen. Der Ertrag eines Balkonkraftwerks hängt stark von Standort und Ausrichtung ab. In Deutschland ist die Anmeldung beim Marktstammdatenregister und oft beim Netzbetreiber erforderlich. Seit Dezember 2025 gilt die Produktnorm DIN VDE V 0126-95: Wechselrichter bis 800 VA, Module bis 960 Wp an einer normalen Steckdose, bis 2000 Wp an einer Energiesteckvorrichtung. Kein Beratungsersatz.' : 'Estimate with the assumptions you chose. The yield of a balcony system depends heavily on location and orientation. In Germany registration in the Marktstammdatenregister and often with the grid operator is required. Since December 2025 the product norm DIN VDE V 0126-95 applies: inverters up to 800 VA, modules up to 960 Wp on a standard socket, up to 2000 Wp with a dedicated energy socket. Not a substitute for advice.'
  };

  var YEARS = 20;
  var DEGRADATION = 0.004;
  var ESCALATION_DEFAULT = 3; // %/yr electricity price
  var CO2_G_PER_KWH = 344; // g CO2/kWh, German grid mix 2025 (Umweltbundesamt)

  function compute(powerWp, yieldKwh, cost, priceCt, selfShare, maintanance, escalation) {
    var priceY1 = priceCt / 100;
    var selfKwh1 = yieldKwh * selfShare;
    var cum = [0], pv = {};
    cum[0] = -cost;
    var reached = false;
    for (var y = 1; y <= YEARS; y++) {
      var eff = yieldKwh * Math.pow(1 - DEGRADATION, y - 1);
      var sk = eff * selfShare;
      var priceY = priceY1 * Math.pow(1 + escalation / 100, y - 1);
      var benefit = sk * priceY - maintanance;
      pv[y] = Math.round(benefit);
      cum[y] = cum[y - 1] + benefit;
      if (!reached && cum[y] >= 0) {
        var prev = cum[y - 1], cur = benefit;
        pv.payback = Math.round((y - 1 + (0 - prev) / cur) * 10) / 10;
        reached = true;
      }
    }
    pv.benefit1 = Math.round(selfKwh1 * priceY1 - maintanance);
    pv.profit20 = Math.round(cum[YEARS]);
    pv.co2Y1 = Math.round(selfKwh1 * CO2_G_PER_KWH / 1000); // kg CO2 saved per year
    pv.cum = cum;
    return pv;
  }

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var powerWp = num('bkw-wp', 800);
    var yieldKwh = num('bkw-ertrag', 700);
    var cost = num('bkw-kosten', 500);
    var priceCt = num('bkw-preis', 35);
    var selfShare = num('bkw-selbst', 70);
    var maintanance = num('bkw-wart', 0);
    var escalation = num('bkw-teuer', ESCALATION_DEFAULT);
    if (selfShare < 0) selfShare = 0;
    if (selfShare > 100) selfShare = 100;
    if (!yieldKwh || yieldKwh <= 0 || !priceCt || priceCt <= 0) {
      output.innerHTML = '<p class="text-muted">' + esc(T.empty) + '</p>'; return;
    }
    var r = compute(powerWp, yieldKwh, cost, priceCt, selfShare / 100, maintanance, escalation);

    output.innerHTML =
      '<div class="result-display">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">' +
          '<div class="card" style="padding:14px;text-align:center;border-color:var(--accent)"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.benefit1) + '</div><div style="font-size:1.25rem;font-weight:800;color:var(--accent)">' + FMTe.format(r.benefit1) + '</div></div>' +
          '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.payback) + '</div><div style="font-size:1.25rem;font-weight:800">' + (r.payback ? r.payback + ' ' + esc(T.years) : esc(T.noPayback)) + '</div></div>' +
          '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.profit20) + '</div><div style="font-size:1.25rem;font-weight:800;color:' + (r.profit20 >= 0 ? 'var(--success)' : 'var(--error)') + '">' + (r.profit20 >= 0 ? '+' : '') + FMTe.format(r.profit20) + '</div></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
          '<div class="card" style="padding:12px;font-size:0.9rem"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.self) + '</div><span style="font-weight:800">' + FMTn.format(Math.round(yieldKwh * selfShare / 100)) + ' kWh/Jahr</span></div>' +
          '<div class="card" style="padding:12px;font-size:0.9rem"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.co2) + '</div><span style="font-weight:800">' + FMTn.format(r.co2Y1) + ' ' + esc(T.co2Unit) + '</span></div>' +
        '</div>' +
        '<p style="font-size:0.75rem;color:var(--text-muted);line-height:1.5">' + esc(T.note) + '</p>' +
        '<p style="font-size:0.7rem;color:var(--text-muted);line-height:1.4">' + esc(T.src) + '</p>' +
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
