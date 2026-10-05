/* ══════════════════════════════════════════════════
   solar-wartungskosten.js: Solar Wartungs- & Reparaturkosten (Schätzung)
   Long-term operating budget for a German PV system:
   periodic inverter replacement + yearly maintenance/cleaning + a repair
   reserve. Output total lifetime cost, average per year and per kWh.
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
    hint: DE ? 'Annahmen für Wartung und Tauschintervalle eingeben, dann auf „Berechnen“ klicken. Schätzung über die Betriebsdauer, siehe Hinweis.' : 'Enter maintenance and replacement assumptions, then click Calculate. Lifetime estimate, see note.',
    empty: DE ? 'Bitte gültige Werte für Anlagengröße und Wartung eingeben.' : 'Please enter valid values for system size and maintenance.',
    title: DE ? 'Wartungs- & Reparaturkosten (Schätzung)' : 'Maintenance & repair costs (estimate)',
    lifetime: DE ? 'Gesamtkosten über die Laufzeit' : 'Total cost over lifetime',
    perYear: DE ? 'Ø pro Jahr' : 'Average per year',
    perKwh: DE ? 'Ø je kWh Ertrag' : 'Average per kWh',
    pctInvest: DE ? 'Anteil am Anlagenpreis' : 'Share of system price',
    break: DE ? 'Aufschlüsselung' : 'Breakdown',
    maintLabel: DE ? 'Wartung & Reinigung' : 'Maintenance & cleaning',
    invLabel: DE ? 'Wechselrichter-Tausch' : 'Inverter replacement',
    reserve: DE ? 'Reparatur-Reserve' : 'Repair reserve',
    invCount: DE ? 'Tausch-Ereignisse' : 'Replacement events',
    insLabel: DE ? 'Versicherung' : 'Insurance',
    insLabelFull: DE ? 'PV-Versicherung' : 'PV insurance',
    note: DE ? 'Schätzung mit von dir gewählten Annahmen. Ein Wechselrichter hält typischerweise 10 bis 15 Jahre; Module meist 25+ Jahre mit geringer Degradation. Richtwerte: Wechselrichter-Tausch 1.000 bis 2.500 €, Wartung und Reinigung 80 bis 300 € pro Jahr, PV-Versicherung 40 bis 180 € pro Jahr (Stand 09/2026). Die Kosten schwanken stark nach Qualität, Dach und Region. Kein Beratungsersatz.' : 'Estimate with the assumptions you chose. Inverters typically last 10 to 15 years; modules usually 25+ years with low degradation. Reference values: inverter replacement 1,000 to 2,500 €, maintenance and cleaning 80 to 300 € per year, PV insurance 40 to 180 € per year (as of 09/2026). Costs vary widely. Not a substitute for advice.'
  };

  function compute(kwp, lifetime, invCost, invLife, maintenanceYear, reserve, yieldKwh, insuranceYear) {
    // Number of inverter replacements over lifetime (a replacement needed at each multiple of invLife < lifetime)
    var replacements = 0, yr = invLife;
    while (yr < lifetime) { replacements++; yr += invLife; }
    var maintTotal = maintenanceYear * lifetime;
    var invTotal = replacements * invCost;
    var insTotal = (insuranceYear || 0) * lifetime;
    var total = maintTotal + invTotal + reserve + insTotal;
    var perYear = total / lifetime;
    var perKwh = yieldKwh > 0 ? total / (yieldKwh * lifetime) : 0;
    var investRef = 1200 * kwp; // reference typical system price
    var pct = investRef > 0 ? total / investRef * 100 : 0;
    return { total: total, perYear: perYear, perKwh: perKwh, pct: pct, maintTotal: maintTotal, invTotal: invTotal, reserve: reserve, insTotal: insTotal, replacements: replacements };
  }

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var kwp = num('swk-kwp', 8);
    var lifetime = parseInt((E('swk-zeit') && E('swk-zeit').value) || '25', 10);
    var invCost = num('swk-inv', 1200);
    var invLife = parseInt((E('swk-invlife') && E('swk-invlife').value) || '15', 10);
    var maintenanceYear = num('swk-wart', 80);
    var reserve = num('swk-reserve', 500);
    var insuranceYear = num('swk-vers', 0);
    var yieldKwh = num('swk-ertrag', 8000);
    if (!kwp || kwp <= 0) { output.innerHTML = '<p class="text-muted">' + esc(T.empty) + '</p>'; return; }

    var r = compute(kwp, lifetime, invCost, invLife, maintenanceYear, reserve, yieldKwh, insuranceYear);

    output.innerHTML =
      '<div class="result-display">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">' +
          '<div class="card" style="padding:14px;text-align:center;border-color:var(--accent)"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.lifetime) + '</div><div style="font-size:1.25rem;font-weight:800;color:var(--accent)">' + FMTe.format(r.total) + '</div></div>' +
          '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.perYear) + '</div><div style="font-size:1.25rem;font-weight:800">' + FMTe.format(r.perYear) + '</div></div>' +
          (r.perKwh > 0 ? '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.perKwh) + '</div><div style="font-size:1.25rem;font-weight:800">' + (r.perKwh * 100).toFixed(2).replace('.', ',') + ' <span style="font-size:0.8rem">ct/kWh</span></div></div>' : '') +
          '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.pctInvest) + '</div><div style="font-size:1.25rem;font-weight:800">' + Math.round(r.pct) + ' %</div></div>' +
        '</div>' +
        '<div class="card" style="padding:12px;margin-bottom:10px;font-size:0.9rem">' +
          '<div style="font-weight:700;margin-bottom:6px">' + esc(T.break) + '</div>' +
          '<div style="display:flex;justify-content:space-between;padding:2px 0"><span>' + esc(T.maintLabel) + ' (' + lifetime + ' ' + (DE ? 'Jahre' : 'years') + ')</span><span>' + FMTe.format(r.maintTotal) + '</span></div>' +
          '<div style="display:flex;justify-content:space-between;padding:2px 0"><span>' + esc(T.invLabel) + ' (' + r.replacements + '×)</span><span>' + FMTe.format(r.invTotal) + '</span></div>' +
          (r.insTotal > 0 ? '<div style="display:flex;justify-content:space-between;padding:2px 0"><span>' + esc(T.insLabel) + ' (' + lifetime + ' ' + (DE ? 'Jahre' : 'years') + ')</span><span>' + FMTe.format(r.insTotal) + '</span></div>' : '') +
          '<div style="display:flex;justify-content:space-between;padding:2px 0"><span>' + esc(T.reserve) + '</span><span>' + FMTe.format(r.reserve) + '</span></div>' +
        '</div>' +
        '<p style="font-size:0.75rem;color:var(--text-muted);line-height:1.5">' + esc(T.note) + '</p>' +
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

  if (typeof module !== 'undefined' && module.exports) module.exports = { compute: compute };
})();
