/* ══════════════════════════════════════════════════
   waschkosten-rechner.js — Kosten pro Waschgang
   Konstanten mit Stand: und Quelle (keine erfundenen Werte)
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(v) { var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; }
  function fmt(n, dec) { return n.toLocaleString('de-DE', { minimumFractionDigits: (dec==null?2:dec), maximumFractionDigits: (dec==null?2:dec) }); }
  var DE = (typeof window.__siteLang === 'undefined') || window.__siteLang === 'de';

  /* ── Konstanten (Stand: 08/2026) ──
     Quellen: BDEW Strompreisanalyse (37,0 ct/kWh, Stand 08/2026),
     Wasser + Abwasser Gesamt ~4,80 €/m³ (Ø 2026: 4,5–5,5 €/m³, wasser-experte.net / kosten.org 2026),
     Waschmittel ~10–30 ct, typisch ~15 ct pro Waschgang (Öko-Test 2024).
     Siehe methodik-Seite. */
  var CONST = {
    kWh_price_default: 0.37,     // EUR/kWh, Haushaltsstrom inkl. Grundgebühr (BDEW, Stand 08/2026)
    water_price_default: 4.80,   // EUR/m³ Wasser + Abwasser gesamt (Ø 2026: 4,5–5,5 €/m³)
    detergent_default: 0.15,     // EUR pro Waschgang (Öko-Test-Mittel, Stand 2024)
    detergent_high: 0.35         // EUR für z. B. flüssig/Tabs je nach Marke
  };

  /* Energieverbrauch + Wasser je Maschinentyp und Programm (kWh / Liter).
     Energie: NEW Energie/Stromspiegel/Ökostrom (0,5–1,0 kWh Ø, Stand 2025/26).
     Wasser: Verivox Ø 46 L (2025), ältere Maschinen 55–70 L, 1990er bis 180 L. */
  var MACHINE = {
    modern:  { label: 'Neue Maschine (Energieeffizienzklasse A–C)', labelEn: 'New machine (energy class A–C)',
               water: 45 },
    middle:  { label: 'Maschine ca. 5–10 Jahre', labelEn: 'Machine about 5–10 years old',
               water: 60 },
    old:     { label: 'Ältere Maschine (10+ Jahre)', labelEn: 'Older machine (10+ years)',
               water: 110 }
  };
  var PROGRAM = {
    eco30: { label: 'Eco 30 °C', labelEn: 'Eco 30 °C', kWh: 0.35 },
    eco40: { label: 'Eco 40 °C', labelEn: 'Eco 40 °C', kWh: 0.55 },
    n40:   { label: '40 °C Normal', labelEn: '40 °C normal', kWh: 0.70 },
    n60:   { label: '60 °C Normal', labelEn: '60 °C normal', kWh: 1.00 },
    n90:   { label: '90 °C / Hygiene', labelEn: '90 °C / hygiene', kWh: 1.40 }
  };

  function buildResult() {
    var machine = (E('wk-machine') && E('wk-machine').value) || 'modern';
    var program = (E('wk-program') && E('wk-program').value) || 'eco40';
    var kWhP = num(E('wk-kwh') ? E('wk-kwh').value : 0.37);
    var waterP = num(E('wk-water') ? E('wk-water').value : 4.80);
    var detP = num(E('wk-det') ? E('wk-det').value : 0.15);
    var washesPerMonth = num(E('wk-count') ? E('wk-count').value : 4);
    if (isNaN(kWhP) || isNaN(waterP) || isNaN(detP) || isNaN(washesPerMonth) || kWhP < 0 || waterP < 0 || washesPerMonth < 0) {
      return { error: DE ? 'Bitte gültige Werte eingeben.' : 'Please enter valid values.' };
    }
    var m = MACHINE[machine];
    var p = PROGRAM[program];
    var elecCost = p.kWh * kWhP;
    var waterCost = (m.water / 1000) * waterP;
    var totalPer = elecCost + waterCost + detP;
    var perMonth = totalPer * washesPerMonth;
    var perYear = perMonth * 12;
    var kwhPerYear = p.kWh * washesPerMonth * 12;
    var waterPerYear = (m.water / 1000) * washesPerMonth * 12;

    return {
      machine: m, program: p, kWhPrice: kWhP, waterPrice: waterP, detPrice: detP,
      washesPerMonth: washesPerMonth, elecCost: elecCost, waterCost: waterCost,
      totalPer: totalPer, perMonth: perMonth, perYear: perYear,
      kwhPerYear: kwhPerYear, waterPerYear: waterPerYear
    };
  }

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var r = buildResult();
    if (r.error) {
      output.innerHTML = '<div class="result-display"><p class="text-muted">' + esc(r.error) + '</p></div>';
      return;
    }
    var parts = [];
    parts.push({ label: DE ? 'Strom (' + r.program.label + ', ' + fmt(r.program.kWh, 2) + ' kWh)' : ('Electricity (' + r.program.labelEn + ', ' + fmt(r.program.kWh, 2) + ' kWh)'), value: r.elecCost });
    parts.push({ label: DE ? ('Wasser + Abwasser (' + r.machine.water + ' Liter)') : ('Water + wastewater (' + r.machine.water + ' litres)'), value: r.waterCost });
    parts.push({ label: DE ? 'Waschmittel' : 'Detergent', value: r.detPrice });

    var html = '<div class="result-display">';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Kosten pro Waschgang' : 'Cost per wash cycle') + '</span><strong>' + fmt(r.totalPer) + ' €</strong></div>';
    html += '<table class="calc-table" style="width:100%;margin:12px 0;border-collapse:collapse;font-size:0.9rem"><tbody>';
    parts.forEach(function (p) {
      html += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 4px">' + esc(p.label) + '</td><td style="padding:6px 4px;text-align:right">' + fmt(p.value) + ' €</td></tr>';
    });
    html += '</tbody></table>';
    html += '<div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:8px"><span>' + (DE ? 'Pro Monat (' + r.washesPerMonth + ' Waschgänge)' : 'Per month (' + r.washesPerMonth + ' cycles)') + '</span><strong>' + fmt(r.perMonth) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Pro Jahr' : 'Per year') + '</span><strong>' + fmt(r.perYear) + ' €</strong></div>';
    html += '<div class="calc-result-row" style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px"><span>' + (DE ? 'Verbrauch pro Jahr' : 'Resource use per year') + '</span><strong>' + fmt(r.kwhPerYear, 1) + ' kWh · ' + fmt(r.waterPerYear, 1) + ' m³</strong></div>';
    html += '<p class="calculator-note" style="margin-top:12px;font-size:0.78rem;color:var(--text-muted)">' + (DE ? 'Alle Werte sind Durchschnittswerte für Deutschland' : 'All figures are German averages') + ' (Strom: BDEW 08/2026, Wasser+Abwasser: Ø 2026, Waschmittel: Öko-Test 2024). ' + (DE ? 'Tatsächliche Kosten hängen von deinem Tarif und deiner Maschine ab.' : 'Actual costs depend on your tariff and machine.') + '</p>';
    html += '</div>';
    output.innerHTML = html;
  }

  function setup() {
    var inputs = E('tool-inputs');
    var output = E('tool-output');
    if (!inputs || !output) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-primary btn-generate';
    btn.textContent = DE ? 'Waschkosten berechnen' : 'Calculate washing costs';
    inputs.appendChild(btn);
    btn.addEventListener('click', run);
    output.innerHTML = '<p class="text-muted">' + (DE ? 'Stelle die Maschine und das Programm ein und klicke auf „Waschkosten berechnen“, um die Kosten pro Waschgang zu sehen.' : 'Set your machine and programme and click "Calculate washing costs" to see the cost per cycle.') + '</p>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildResult: buildResult, CONST: CONST, MACHINE: MACHINE, PROGRAM: PROGRAM };
  }
})();
