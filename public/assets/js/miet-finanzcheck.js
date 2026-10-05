/* ══════════════════════════════════════════════════
   miet-finanzcheck.js | 30 %-Regel / Mietbelastungs-Check
   100 % client-seitig.
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(v) { var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; }
  function fmt(n) { return n.toLocaleString('de-DE', { maximumFractionDigits: 0, minimumFractionDigits: 0 }); }
  function fmt1(n) { return n.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 }); }
  var DE = (typeof window.__siteLang === 'undefined') || window.__siteLang === 'de';

  /* Faustregeln (Orientierung, keine Finanzberatung):
     – 30%-Regel: Die Warmmiete sollte rund 30 % des Nettoeinkommens nicht überschreiten
       (üblicher Rahmen 25–35 %; Verbraucherzentrale, Mieterbund).
     – Betriebskosten ("zweite Miete"): im Schnitt rund 2,67 €/m² pro Monat
       (Deutscher Mieterbund, Betriebskostenspiegel; regional 2,28–3,68 €/m²). */
  var GUIDELINE = 0.30;          // 30 % als Orientierungswert
  var STRESS = 0.35;             // ab 35 % wird es kritisch
  var OPERATING_PER_M2 = 2.67;   // €/m² Betriebskosten (dmb Betriebskostenspiegel, Abrechnungsjahr 2024)

  function buildResult() {
    var income = num(E('mf-income') ? E('mf-income').value : '');
    var rent = num(E('mf-rent') ? E('mf-rent').value : '');
    var area = num(E('mf-area') ? E('mf-area').value : ''); // optional
    if (isNaN(income) || income <= 0) {
      return { error: DE ? 'Bitte gib dein monatliches Nettoeinkommen ein.' : 'Please enter your monthly net income.' };
    }
    if (isNaN(rent) || rent <= 0) {
      return { error: DE ? 'Bitte gib deine Warmmiete ein.' : 'Please enter your warm rent.' };
    }
    var share = rent / income;
    var status;
    if (share <= GUIDELINE) status = 'ok';
    else if (share <= STRESS) status = 'watch';
    else status = 'crit';
    // Betriebskosten je m² anpassbar (optional), sonst Bundesdurchschnitt.
    var opCostRaw = E('mf-opcost') ? E('mf-opcost').value : '';
    var opCost = num(opCostRaw);
    if (!(opCost > 0)) opCost = OPERATING_PER_M2;
    var estOperating = !isNaN(area) && area > 0 ? area * opCost : null;
    var estCold = estOperating !== null ? Math.max(0, rent - estOperating) : null;
    var maxWarm = Math.round(income * GUIDELINE);
    return { income: income, rent: rent, area: area, share: share, status: status, opCost: opCost, estOperating: estOperating, estCold: estCold, maxWarm: maxWarm };
  }

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var r = buildResult();
    if (r.error) {
      output.innerHTML = '<div class="result-display"><p class="text-muted">' + esc(r.error) + '</p></div>';
      return;
    }
    var sharePct = (r.share * 100).toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' %';
    var statusText, statusColor, statusDetail;
    if (r.status === 'ok') {
      statusText = DE ? 'Im grünen Bereich' : 'In the green zone';
      statusColor = 'var(--ok, #2e8b57)';
      statusDetail = DE ? 'Deine Miete liegt bei oder unter 30 % deines Nettoeinkommens. Das gilt als tragfähige Belastung.' : 'Your rent is at or below 30 % of your net income. This is considered a manageable burden.';
    } else if (r.status === 'watch') {
      statusText = DE ? 'Erhöhte Belastung' : 'Elevated burden';
      statusColor = '#c98a2d';
      statusDetail = DE ? 'Zwischen 30 und 35 % deines Nettoeinkommens: noch machbar, aber es bleibt wenig Spielraum für andere Ausgaben und Rücklagen.' : 'Between 30 and 35 % of your net income: doable, but it leaves little room for other expenses and savings.';
    } else {
      statusText = DE ? 'Kritisch' : 'Critical';
      statusColor = '#b03a2e';
      statusDetail = DE ? 'Über 35 % deines Nettoeinkommens. Das gilt als kritisch: wenig Puffer fürs Leben und Sparen. Prüfe eine günstigere Wohnung oder wie du Nebenkosten und andere Fixkosten senken kannst.' : 'Above 35 % of your net income. This is considered critical: little buffer for living and saving. Consider a cheaper home or how to cut utilities and other fixed costs.';
    }
    var html = '<div class="result-display">';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Warmmiete' : 'Warm rent') + '</span><strong>' + fmt(r.rent) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Nettoeinkommen' : 'Net income') + '</span><strong>' + fmt(r.income) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Mietbelastungsquote' : 'Rent burden ratio') + '</span><strong>' + sharePct + '</strong></div>';
    html += '<div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:8px"><span>' + (DE ? 'Bewertung' : 'Assessment') + '</span><strong style="color:' + statusColor + '">' + esc(statusText) + '</strong></div>';
    html += '<p style="font-size:0.85rem;color:var(--text-muted);margin-top:8px">' + esc(statusDetail) + '</p>';
    html += '<div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:8px"><span>' + (DE ? 'Empfohlene Obergrenze (30 %)' : 'Recommended ceiling (30 %)') + '</span><strong>' + fmt(r.maxWarm) + ' €</strong></div>';
    var buf = r.rent - r.maxWarm;
    var bufferNote = buf <= 0
      ? (DE ? 'Du liegst ' + fmt(-buf) + ' € unter der 30-%-Obergrenze. Es bleibt etwas Puffer.' : 'You are ' + fmt(-buf) + ' € below the 30 % ceiling. Some buffer remains.')
      : (DE ? 'Du liegst ' + fmt(buf) + ' € über der 30-%-Obergrenze.' : 'You are ' + fmt(buf) + ' € above the 30 % ceiling.');
    html += '<p style="font-size:0.82rem;color:var(--text-muted);margin-top:6px">' + esc(bufferNote) + '</p>';
    if (r.estOperating !== null && r.estCold !== null) {
      html += '<div class="calc-result-row" style="margin-top:10px"><span>' + (DE ? 'Geschätzte Kaltmiete (bei ' + fmt1(r.opCost) + ' €/m² Betriebskosten)' : 'Estimated cold rent (at ' + fmt1(r.opCost) + ' €/m² operating costs)') + '</span><strong>' + fmt(r.estCold) + ' €</strong></div>';
      html += '<p class="calculator-note" style="font-size:0.75rem;color:var(--text-muted)">' + (DE ? 'Betriebskosten-Durchschnitt (2,67 €/m²): Deutscher Mieterbund, Betriebskostenspiegel Abrechnungsjahr 2024 (regional 2,28 bis 3,68 €/m²). Deinen eigenen Wert kannst du im Feld Betriebskosten eingeben.' : 'Operating-cost average (2.67 €/m²): Deutscher Mieterbund, Betriebskostenspiegel billing year 2024 (regionally 2.28 to 3.68 €/m²). You can enter your own value in the operating-cost field.') + '</p>';
    }
    html += '<p class="calculator-note" style="margin-top:12px;font-size:0.78rem;color:var(--text-muted)">' + (DE ? 'Die 30-%-Regel ist eine Faustregel zur Orientierung, keine rechtliche Pflicht. Die örtlichen Mietmärkte (z. B. in Großstädten) liegen oft über 30 %.' : 'The 30 % rule is a guideline, not a legal requirement. Local rental markets (e.g. in big cities) often exceed 30 %.') + '</p>';
    html += '</div>';
    output.innerHTML = html;

    // Playbook integration: report this finished step (client-side only).
    // Carry the monthly net income forward (scalar) plus the key user fields
    // so downstream steps can autofill their matching inputs.
    if (r.income > 0 && window.playbook) window.playbook.report({
      tool: 'miet-finanzcheck',
      summary: (DE ? 'Mietbelastung: ' : 'Rent burden: ') + sharePct,
      value: r.income,
      fields: {
        nettoEinkommen: r.income,
        warmmiete: r.rent,
        wohnflaeche: isNaN(r.area) || r.area <= 0 ? null : r.area
      }
    });
  }

  function setup() {
    var inputs = E('tool-inputs');
    var output = E('tool-output');
    if (!inputs || !output) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-primary btn-generate';
    btn.textContent = DE ? 'Mietbelastung prüfen' : 'Check rent burden';
    inputs.appendChild(btn);
    btn.addEventListener('click', run);
    output.innerHTML = '<p class="text-muted">' + (DE ? 'Trage Nettoeinkommen und Warmmiete ein, dann klicke auf „Mietbelastung prüfen“. Die Wohnfläche (optional) schätzt die Kaltmiete aus den Betriebskosten.' : 'Enter net income and warm rent, then click "Check rent burden". The floor area (optional) estimates the cold rent from operating costs.') + '</p>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildResult: buildResult, GUIDELINE: GUIDELINE, STRESS: STRESS, OPERATING_PER_M2: OPERATING_PER_M2 };
  }
})();
