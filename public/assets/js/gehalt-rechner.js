/* ══════════════════════════════════════════════════
   gehalt-rechner.js | Brutto-Netto Gehaltsrechner (Schätzung)
   Transparent estimator for the German 2026 payroll year.
   - Simplified progressive ESt tariff calibrated to 2026
     anchors (Grundfreibetrag 12.348 €, 42% ab 69.879 €, 45% ab 277.826 €)
   - Employee social-security shares capped at BBG
   This is an ESTIMATE, not an official payroll figure.
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
  var FMT = new Intl.NumberFormat((DE ? 'de-DE' : 'en-US'), { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

  var T = {
    calc: DE ? 'Berechnen' : 'Calculate',
    hint: DE ? 'Monatsbrutto eingeben und auf „Berechnen" klicken. Schätzung für 2026, siehe Hinweis.' : 'Enter the monthly gross and click Calculate. Estimate for 2026, see note.',
    gross: DE ? 'Brutto (Jahr)' : 'Gross (year)',
    net: DE ? 'Netto (Jahr)' : 'Net (year)',
    netMonth: DE ? 'Netto (Monat)' : 'Net (month)',
    with: DE ? 'monatlich' : 'monthly',
    deductions: DE ? 'Abzüge' : 'Deductions',
    empty: DE ? 'Bitte Monatsbrutto eingeben.' : 'Please enter the monthly gross.',
    breakdowntitle: DE ? 'Abzugsdetails (Jahr)' : 'Deduction breakdown (year)',
    incomeTax: DE ? 'Lohnsteuer' : 'Income tax',
    soli: DE ? 'Solidaritätszuschlag' : 'Solidarity surcharge',
    church: DE ? 'Kirchensteuer' : 'Church tax',
    rv: DE ? 'Rentenversicherung (AN)' : 'Pension insurance (EE)',
    av: DE ? 'Arbeitslosenversicherung (AN)' : 'Unemployment (EE)',
    kv: DE ? 'Krankenversicherung (AN)' : 'Health insurance (EE)',
    pv: DE ? 'Pflegeversicherung (AN)' : 'Care insurance (EE)',
    totalDed: DE ? 'Summe Abzüge' : 'Total deductions',
    avgTax: DE ? 'Durchschnittssteuersatz' : 'Average tax rate',
    netShare: DE ? 'Nettoquote (vom Brutto)' : 'Net share (of gross)',
    alsoDed: DE ? 'Hinweis' : 'Note',
    note: DE ? 'Schätzung auf Basis der 2026er Annahmen (siehe unten). Kein offizielles Abrechnungsergebnis. Für verbindliche Werte nutze den offiziellen Abgabenrechner (z.B. BMF).' : 'Estimate based on 2026 assumptions (see below). Not an official payroll result. For binding figures use the official calculator (e.g. BMF).'
  };

  // ── Versioned calculation parameters (2026) ─────────────────────────
  // Values + source kept together so legal/fiscal parameters can be
  // reviewed and updated in one place (R4b). Do NOT scatter magic numbers.
  var CFG = {
    YEAR: 2026,
    reviewed_at: '2026-09-02',
    source: 'Einkommensteuertarif 2026 und Beitragsbemessungsgrenzen 2026 (West); durchschnittlicher Zusatzbeitrag GKV 2,9 % (2026, BMG); BMF / gesetzliche Parameter',
    // Simplified single-person ESt tariff zones (linear ramp in progressive zones)
    tariff: { GF: 12348, Z1: 17799, Z2: 69878, Z3: 277826 },
    // Contribution assessment ceilings 2026 (West), annual EUR
    bb: { RV: 101400, KV: 69750 },
    // Employee contribution rates 2026 (KV = 7.3% + half of avg Zusatzbeitrag 2.9% = 8.75%)
    rates: { rv: 0.093, av: 0.013, kv: 0.0875, pv: 0.018, pvChildlessSurcharge: 0.006 },
    // Sonderausgaben/Werbungskosten lump sum deducted from zvE (annual EUR)
    lumpSums: 2418,
    // Solidaritätszuschlag: 5.5% above Freigrenze (tax > Freigrenze)
    soliRate: 0.055,
    soliFreigrenze: 3489
  };

  // Simplified 2026 ESt tariff (single person), linear marginal ramp in progressive zones.
  function estESt(zvE) {
    var GF = CFG.tariff.GF, Z1 = CFG.tariff.Z1, Z2 = CFG.tariff.Z2, Z3 = CFG.tariff.Z3;
    if (zvE <= GF) return 0;
    // zone already above GF
    var zone1Band = Z1 - GF;
    if (zvE <= Z1) {
      var w = zvE - GF;
      return w * (0.14 + (0.24 - 0.14) * (w / zone1Band) / 2);
    }
    var taxAtZ1 = zone1Band * (0.14 + 0.24) / 2;
    if (zvE <= Z2) {
      var w2 = zvE - Z1, band2 = Z2 - Z1;
      return taxAtZ1 + w2 * (0.24 + (0.42 - 0.24) * (w2 / band2) / 2);
    }
    var taxAtZ2 = taxAtZ1 + (Z2 - Z1) * (0.24 + 0.42) / 2;
    if (zvE <= Z3) return taxAtZ2 + (zvE - Z2) * 0.42;
    return taxAtZ2 + (Z3 - Z2) * 0.42 + (zvE - Z3) * 0.45;
  }

  function computeAnnual(monthlyGross, churchRate, childless) {
    var gross = monthlyGross * 12;
    // BBG 2026 assumptions (West) | from versioned CFG (R4b)
    var BBG_RV = CFG.bb.RV, BBG_KV = CFG.bb.KV;
    var cap = function(amount, bb) { return Math.min(amount, bb); };
    var rv = cap(gross, BBG_RV) * CFG.rates.rv;
    var av = cap(gross, BBG_RV) * CFG.rates.av;
    var kv = cap(gross, BBG_KV) * CFG.rates.kv; // 7.3% + 1.4% (half avg Zusatzbeitrag)
    var pvRate = CFG.rates.pv + (childless ? CFG.rates.pvChildlessSurcharge : 0);
    var pv = cap(gross, BBG_KV) * pvRate;
    var sv = rv + av + kv + pv;

    // zvE: gross minus lump sums (Werbungskosten + Sonderausgaben) minus employee pension/unemployment (approx Vorsorge)
    var zvE = Math.max(0, gross - CFG.lumpSums - rv - av);
    var est = estESt(zvE);
    // Solidaritätszuschlag: 5.5% of (est − Freigrenze), only when est > Freigrenze
    var soli = est > CFG.soliFreigrenze ? CFG.soliRate * (est - CFG.soliFreigrenze) : 0;
    if (soli < 0) soli = 0;
    var church = churchRate > 0 ? est * (churchRate / 100) : 0;
    var total = est + soli + church + sv;
    var net = Math.max(0, gross - total);
    var avgTax = gross > 0 ? est / gross : 0;
    var netShare = gross > 0 ? net / gross : 0;
    return { gross: gross, zvE: zvE, est: est, soli: soli, church: church, rv: rv, av: av, kv: kv, pv: pv, total: total, net: net, netMonth: net / 12, sv: sv, avgTax: avgTax, netShare: netShare };
  }

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var g = parseFloat(String(E('ge-gross') ? E('ge-gross').value : '').replace(',', '.').replace(/[^0-9.]/g, ''));
    if (!g || g <= 0) { output.innerHTML = '<p class="text-muted">' + esc(T.empty) + '</p>'; return; }
    var church = parseFloat(E('ge-church') ? E('ge-church').value : '0');
    var childless = !!(E('ge-childless') && E('ge-childless').checked);
    var r = computeAnnual(g, church, childless);

    var rows = [
      [T.incomeTax, r.est], [T.soli, r.soli],
      church > 0 ? [T.church, r.church] : null,
      [T.rv, r.rv], [T.av, r.av], [T.kv, r.kv], [T.pv, r.pv]
    ].filter(Boolean);

    var html = '<div class="result-display">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">';
    html += '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.gross) + ' / ' + esc(T.with) + '</div><div style="font-size:1.25rem;font-weight:800">' + FMT.format(r.gross / 12) + '</div></div>';
    html += '<div class="card" style="padding:14px;text-align:center;border-color:var(--accent)"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.net) + ' / ' + esc(T.with) + '</div><div style="font-size:1.25rem;font-weight:800;color:var(--accent)">' + FMT.format(r.netMonth) + '</div></div>';
    html += '</div>';
    html += '<div class="card" style="padding:12px;margin-bottom:10px;font-size:0.9rem">';
    html += '<div style="font-weight:700;margin-bottom:6px">' + esc(T.breakdowntitle) + '</div>';
    for (var i = 0; i < rows.length; i++) {
      html += '<div style="display:flex;justify-content:space-between;padding:2px 0"><span>' + esc(rows[i][0]) + '</span><span style="font-variant-numeric:tabular-nums">' + FMT.format(rows[i][1]) + '</span></div>';
    }
    html += '<div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--border);margin-top:4px;font-weight:700"><span>' + esc(T.totalDed) + '</span><span>' + FMT.format(r.total) + '</span></div>';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:0.85rem;color:var(--text-muted)"><span>' + esc(T.avgTax) + '</span><span>' + (r.avgTax * 100).toFixed(1) + ' %</span></div>';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:0.85rem;color:var(--text-muted)"><span>' + esc(T.netShare) + '</span><span>' + (r.netShare * 100).toFixed(1) + ' %</span></div>';
    html += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-weight:800"><span>' + esc(T.net) + '</span><span style="color:var(--accent)">' + FMT.format(r.net) + '</span></div>';
    html += '</div>';
    html += '<p style="font-size:0.75rem;color:var(--text-muted);line-height:1.5">' + esc(T.note) + '</p>';
    html += '</div>';
    output.innerHTML = html;

    // Playbook integration: report this finished step (client-side only),
    // guarded on a positive net so a live re-run doesn't mark an empty step.
    if (r.net > 0 && window.playbook) window.playbook.report({
      tool: 'gehalt-rechner',
      summary: (window.__siteLang === 'en' ? 'Net salary: ' : 'Nettogehalt: ') +
        FMT.format(r.netMonth) + (window.__siteLang === 'en' ? ' per month' : ' pro Monat')
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
      if (e.key === 'Enter' && e.target && e.target.matches('input, select')) { e.preventDefault(); btn.click(); }
    });
    output.innerHTML = '<p class="text-muted">' + esc(T.hint) + '</p>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  // Expose for tests
  if (typeof module !== 'undefined' && module.exports) module.exports = { estESt: estESt, computeAnnual: computeAnnual };
})();
