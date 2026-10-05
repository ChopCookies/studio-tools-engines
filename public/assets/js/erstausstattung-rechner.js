/* ══════════════════════════════════════════════════
   erstausstattung-rechner.js — Kosten erste eigene Wohnung
   Preisbänder: real recherchiert (Stand 09/2026)
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(v) { var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) && n > 0 ? n : 0; }
  function fmt(n) { return n.toLocaleString('de-DE', { maximumFractionDigits: 0 }); }
  var DE = (typeof window.__siteLang === 'undefined') || window.__siteLang === 'de';

  /* Preisbänder je Budgetstufe: [sparsam(gebraucht), mittel, komfort(neu/marke)].
     Quellen: haushaltstipps.com, jugendverbraucherdialog.de, haubnergroup.de, Stand 09/2026.
     Mittelwerte der jeweiligen Spanne. */
  var ITEMS = {
    kueche:   { label: 'Küchenzeile + Großgeräte', labelEn: 'Kitchen + large appliances', range: [600, 1400, 2800] },
    schlafen: { label: 'Schlafzimmer (Bett, Matratze, Kleiderschrank)', labelEn: 'Bedroom (bed, mattress, wardrobe)', range: [350, 900, 1800] },
    wohnen:   { label: 'Wohnzimmer (Sofa, Tisch, Lampen)', labelEn: 'Living room (sofa, table, lamps)', range: [250, 650, 1500] },
    bad:      { label: 'Bad (Handtücher, Duschvorhang, Kleinmöbel)', labelEn: 'Bathroom (towels, shower curtain)', range: [60, 110, 200] },
    klein:    { label: 'Kleinkram & Putzausstattung', labelEn: 'Small items & cleaning', range: [80, 150, 300] },
    wasch:    { label: 'Waschmaschine', labelEn: 'Washing machine', range: [200, 450, 900] }
  };

  var BUDGET_LABEL = {
    sparsam:  DE ? 'Sparsam (gebraucht / Basismarken)' : 'Budget (used / basic brands)',
    mittel:   DE ? 'Mittel (gemischt)' : 'Mid-range (mixed)',
    komfort:  DE ? 'Komfort (neu / Marken)' : 'Comfort (new / brands)'
  };

  function buildResult() {
    var level = (E('ea-budget') && E('ea-budget').value) || 'mittel';
    var order = level === 'sparsam' ? 0 : level === 'komfort' ? 2 : 1;
    var sum = 0; var rows = [];
    Object.keys(ITEMS).forEach(function (k) {
      var cb = E('ea-' + k);
      if (!cb || !cb.checked) return;
      var it = ITEMS[k];
      var v = it.range[order];
      sum += v;
      rows.push({ label: it.label, labelEn: it.labelEn, value: v });
    });
    return { level: level, order: order, rows: rows, sum: sum };
  }

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var r = buildResult();
    if (!r.rows.length) {
      output.innerHTML = '<div class="result-display"><p class="text-muted">' + (DE ? 'Bitte wähle mindestens einen Ausstattungspunkt.' : 'Please select at least one item.') + '</p></div>';
      return;
    }
    var kaution = num(E('ea-kaution') && E('ea-kaution').value);
    var umzug = num(E('ea-umzug') && E('ea-umzug').value);
    var extraSum = kaution + umzug;
    var total = r.sum + extraSum;

    var html = '<div class="result-display" style="display:block">';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Geschätzte Erstausstattung gesamt' : 'Estimated total setup cost') + '</span><strong>ca. ' + fmt(r.sum) + ' €</strong></div>';
    html += '<p class="text-muted" style="font-size:0.85rem;margin:4px 0 8px">' + esc(DE ? 'Budgetstufe: ' : 'Budget level: ') + esc(BUDGET_LABEL[r.level]) + '</p>';
    html += '<table class="calc-table" style="width:100%;border-collapse:collapse;font-size:0.9rem"><tbody>';
    r.rows.forEach(function (row) {
      html += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 4px">' + esc(DE ? row.label : row.labelEn) + '</td><td style="padding:6px 4px;text-align:right">' + fmt(row.value) + ' €</td></tr>';
    });
    if (kaution > 0) {
      html += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 4px">' + (DE ? 'Mietkaution' : 'Rental deposit') + '</td><td style="padding:6px 4px;text-align:right">' + fmt(kaution) + ' €</td></tr>';
    }
    if (umzug > 0) {
      html += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 4px">' + (DE ? 'Umzugskosten' : 'Moving costs') + '</td><td style="padding:6px 4px;text-align:right">' + fmt(umzug) + ' €</td></tr>';
    }
    html += '</tbody></table>';
    html += '<div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:8px"><span>' + (DE ? (extraSum > 0 ? 'Einzugsfalle gesamt (Richtwert)' : 'Gesamt (Richtwert)') : (extraSum > 0 ? 'Total move-in (estimate)' : 'Total (estimate)')) + '</span><strong>ca. ' + fmt(total) + ' €</strong></div>';
    html += '<p class="calculator-note" style="margin-top:12px;font-size:0.78rem;color:var(--text-muted)">' + (DE ? 'Richtwerte, keine echte Offerte' : 'Estimates, not a real quote') + ' (Stand 09/2026, haushaltstipps.com / jugendverbraucherdialog.de). ' + (DE ? 'Die tatsächlichen Kosten hängen von Region, Qualität und Gebrauchtmarkt ab.' : 'Actual costs depend on region, quality and the second-hand market.') + '</p>';
    html += '</div>';
    output.innerHTML = html;

    // Playbook integration: report this finished step (client-side only),
    // so the flow stores progress and offers the next step.
    if (r.sum > 0 && window.playbook) window.playbook.report({
      tool: 'erstausstattung-rechner',
      summary: (DE ? 'Erstausstattung: ca. ' : 'Starter equipment: approx. ') + fmt(r.sum) + ' €',
      value: r.sum,
      fields: { erstausstattung: r.sum }
    });
  }

  function setup() {
    var inputs = E('tool-inputs');
    var output = E('tool-output');
    if (!inputs || !output) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-primary btn-generate';
    btn.textContent = DE ? 'Erstausstattung berechnen' : 'Calculate setup cost';
    inputs.appendChild(btn);
    btn.addEventListener('click', run);
    output.innerHTML = '<p class="text-muted">' + (DE ? 'Wähle die Budgetstufe und Ausstattungspunkte aus, dann klicke auf „Erstausstattung berechnen“. Mietkaution und Umzugskosten kannst du oben optional eintragen, dann fließen sie in das Gesamtergebnis ein.' : 'Choose the budget level and items, then click "Calculate setup cost". You can optionally add the rental deposit and moving costs above and they flow into the total.') + '</p>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildResult: buildResult, ITEMS: ITEMS, num: num };
  }
})();
