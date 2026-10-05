/* ══════════════════════════════════════════════════
   pendel-rechner.js — Auto vs. Deutschlandticket / ÖPNV pro Monat
   100 % client-seitig. Konstanten mit Stand (2026).
   Review 18.09.2026: + Entfernungspauschale-Steuerersparnis,
   + Jahresvergleich, + EN-Output-Fix, + dynamischer km-Kosten-Label.
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function num(v) { var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; }
  function fmt(n) { return n.toLocaleString('de-DE', { maximumFractionDigits: 0 }); }
  function fmt1(n) { return n.toLocaleString('de-DE', { maximumFractionDigits: 1 }); }
  var DE = (typeof window.__siteLang === 'undefined') || window.__siteLang === 'de';

  /* Stand: 01/2026 — Deutschlandticket-Preis ab 01.01.2026 (Verkehrsministerkonferenz,
     Preisbeschluss Okt/Nov 2025): vorher 49 € (2023–2024), 58 € (2025). */
  var DTICKET = 63;
  // Stand: 2026 — Jobticket: 5 % Rabatt wenn Arbeitgeber >= 25 % zuschießt (§ 3 Nr. 15 EStG)
  var DTICKET_JOB = Math.round(DTICKET * 0.95 * 100) / 100; // 59,85
  // Stand: 2026 — typische Pendeltage bei 5-Tage-Woche (rechnerisch 21,7)
  var DEFAULT_DAYS = 21;
  // Stand: 01/2026 — Auto all-in (ADAC-basiert): Kleinwagen ~0,30–0,35 €/km, Kompakt ~0,40 €/km
  var DEFAULT_KMCOST = 0.35;
  // Stand: 01/2026 — Entfernungspauschale (Steueränderungsgesetz 2025): seit dem
  // 01.01.2026 einheitlich 0,38 €/km ab dem ersten Kilometer (zuvor 0,30 €/km bis km 20).
  var PENDLER_KM = 0.38;
  // Stand: 2026 — üblicher Grenzsteuersatz-Tipp für die Steuerersparnis-Schätzung (30 %)
  var DEFAULT_TAXRATE = 30;

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var km = num(E('pd-km').value);
    var days = num(E('pd-days').value) || DEFAULT_DAYS;
    var kmPerMonth = km * 2 * days; // Hin+Rück, Arbeitstage
    var carKmCost = num(E('pd-kmcost').value) || DEFAULT_KMCOST;
    var parking = num(E('pd-parking').value);
    var carMonthly = kmPerMonth * carKmCost + parking;
    var kmCostLabel = (num(E('pd-kmcost').value) > 0) ? fmt1(carKmCost).replace('.', ',') + ' €/km' : '0,35 €/km';

    var ticketSel = E('pd-ticket');
    var ticketVal = num(ticketSel.value);
    var ticketNoteDe = '';
    var ticketNoteEn = '';
    if (ticketVal === DTICKET_JOB) { ticketNoteDe = 'Jobticket (5 % Rabatt, Arbeitgeber-Zuschuss ≥ 25 %)'; ticketNoteEn = 'Job ticket (5% discount, employer share ≥ 25%)'; }
    else { ticketNoteDe = 'Deutschlandticket (Stand: 01/2026)'; ticketNoteEn = 'Deutschlandticket (as of: 01/2026)'; }
    var ticketNote = DE ? ticketNoteDe : ticketNoteEn;

    var opnvMonthly = ticketVal;
    var diff = carMonthly - opnvMonthly;
    var winnerTxt, summary;
    if (diff > 0.5) {
      summary = DE ? 'Das Auto kostet dich monatlich mehr als das ÖPNV-Ticket.' : 'Driving costs you more per month than the public transport ticket.';
      winnerTxt = DE ? 'ÖPNV günstiger' : 'Public transport cheaper';
    } else if (diff < -0.5) {
      summary = DE ? 'Das Auto ist monatlich günstiger als das ÖPNV-Ticket.' : 'Driving is cheaper per month than the public transport ticket.';
      winnerTxt = DE ? 'Auto günstiger' : 'Car cheaper';
    } else {
      summary = DE ? 'Auto und ÖPNV liegen monatlich nahezu gleichauf.' : 'Car and public transport are almost equal per month.';
      winnerTxt = DE ? 'Nahezu gleichauf' : 'Almost equal';
    }

    /* Entfernungspauschale-Steuerersparnis: absetzbar = einfache Strecke (km) x
       Arbeitstage im Jahr x 0,38 €; Steuerersparnis = absetzbarer Betrag x Steuersatz. */
    var taxRate = num(E('pd-taxrate').value);
    if (taxRate <= 0) taxRate = 0;
    var annualDays = days * 12;
    var dedAnnual = km * annualDays * PENDLER_KM;
    var taxSavingAnnual = dedAnnual * taxRate / 100;
    var taxSavingMonthly = taxSavingAnnual / 12;

    var html = '<div class="result-display" style="display:block">';
    // Monatsvergleich
    html += '<div class="calc-result-row"><span>' + (DE ? 'Strecke pro Monat' : 'Distance per month') + ' (Hin+Rück)</span><strong>' + fmt(kmPerMonth) + ' km</strong></div>';
    html += '<div class="calc-result-row"><span>🚗 ' + (DE ? 'Auto monatlich' : 'Car monthly') + '</span><strong>' + fmt(carMonthly) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Fahrtkosten-Anteil (' + kmCostLabel + ')' : 'Fuel/cost share (' + carKmCost.toString() + ' €/km)') + '</span><strong>' + fmt(kmPerMonth * carKmCost) + ' €</strong></div>';
    if (parking > 0) html += '<div class="calc-result-row"><span>' + (DE ? 'Parken monatlich' : 'Parking monthly') + '</span><strong>' + fmt(parking) + ' €</strong></div>';
    html += '<div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:8px"><span>🚆 ' + (DE ? 'ÖPNV monatlich' : 'Public transport monthly') + ' (' + ticketNote + ')</span><strong>' + fmt(opnvMonthly) + ' €</strong></div>';
    html += '<div class="calc-result-badge">' + winnerTxt + ': ' + (DE ? 'Ersparnis ' : 'Savings ') + fmt(Math.abs(diff)) + ' €/Monat</div>';
    html += '<p style="margin-top:10px;font-size:0.85rem;color:var(--text-muted)">' + summary + '</p>';
    // Jahresvergleich
    html += '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:8px">';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Auto pro Jahr' : 'Car per year') + '</span><strong>' + fmt(carMonthly * 12) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'ÖPNV pro Jahr' : 'Public transport per year') + '</span><strong>' + fmt(opnvMonthly * 12) + ' €</strong></div>';
    html += '</div>';
    // Entfernungspauschale-Steuerersparnis
    if (km > 0 && taxRate > 0) {
      html += '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:8px">';
      html += '<div class="calc-result-row"><span>💶 ' + (DE ? 'Entfernungspauschale (0,38 €/km, Stand 01/2026)' : 'Commuting tax allowance (€0.38/km, as of 01/2026)') + '</span><strong>' + fmt(dedAnnual) + ' €</strong><span style="font-size:0.8rem;color:var(--text-muted)">/' + (DE ? 'Jahr' : 'yr') + '</span></div>';
      html += '<div class="calc-result-row"><span>' + (DE ? 'Geschätzte Steuerersparnis (' + fmt1(taxRate).replace('.', ',') + ' % Steuersatz)' : 'Estimated tax saving (' + taxRate + '% rate)') + '</span><strong>' + fmt(taxSavingAnnual) + ' €</strong><span style="font-size:0.8rem;color:var(--text-muted)">/' + (DE ? 'Jahr' : 'yr') + '</span></div>';
      html += '<div class="calc-result-row"><span>' + (DE ? 'Das entspricht pro Monat rund' : 'That is roughly') + '</span><strong>' + fmt(taxSavingMonthly) + ' €</strong><span style="font-size:0.8rem;color:var(--text-muted)">/' + (DE ? 'Monat' : 'mo') + '</span></div>';
      html += '</div>';
    }
    html += '</div>';
    output.innerHTML = html;
  }

  function setup() {
    var inputs = E('tool-inputs');
    var output = E('tool-output');
    if (!inputs || !output) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-primary btn-generate';
    btn.textContent = DE ? 'Vergleichen' : 'Compare';
    inputs.appendChild(btn);
    btn.addEventListener('click', run);
    output.innerHTML = '<p class="text-muted">' + (DE ? 'Gib deine einfache Entfernung und Arbeitstage ein, dann vergleicht das Tool Auto und ÖPNV pro Monat und Jahr.' : 'Enter your one-way distance and workdays, then the tool compares car and public transport per month and year.') + '</p>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { run: run, DTICKET: DTICKET, DTICKET_JOB: DTICKET_JOB, DEFAULT_KMCOST: DEFAULT_KMCOST, DEFAULT_DAYS: DEFAULT_DAYS, PENDLER_KM: PENDLER_KM, DEFAULT_TAXRATE: DEFAULT_TAXRATE };
  }
})();
