/* ══════════════════════════════════════════════════
   reisebudget-rechner.js — Reisebudget-Planer (Transport+Hotel+Essen+Aktivitäten)
   100 % client-seitig. Stand: 2026.
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function num(v) { var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; }
  function fmt(n) { return n.toLocaleString('de-DE', { maximumFractionDigits: 0 }); }
  var DE = (typeof window.__siteLang === 'undefined') || window.__siteLang === 'de';

  /* Richtwerte (Stand: 2026), als Vorschlagswerte im Eingabeformular:
     - Hotel DE Ø ~96 €/Nacht brutto (IHA 2025); typ. Stadthotel 70–120 €
     - Essen/Tag: 28 € Verpflegungsmehraufwand (EStG, Inland 2026), realistisch 25–40 €
     - Stadtverkehr/Tag: ~6–12 € (VBB 2026) */

  /* Pure rechnende Engine (node-testbar).
     p: { persons, nights, hotel, food, transport, local, act }  (Zahlen)
     returns { error|null, total, perPerson, perNight, perPersonPerNight } */
  function computeBudget(p) {
    if (!(p.persons >= 1)) return { error: 'persons' };
    if (!(p.nights >= 1)) return { error: 'nights' };
    var roomNights = Math.ceil(p.persons / 2);         // 2 Personen je Zimmer (Annahme)
    var hotelCost = (p.hotel || 0) * roomNights * p.nights;
    var days = p.nights + 1;                            // + Anreisetag
    var foodCost = (p.food || 0) * p.persons * days;
    var localCost = (p.local || 0) * p.persons * days;
    var total = hotelCost + foodCost + localCost + (p.transport || 0) + (p.act || 0);
    return {
      error: null,
      roomNights: roomNights,
      days: days,
      hotelCost: hotelCost,
      foodCost: foodCost,
      localCost: localCost,
      total: total,
      perPerson: total / p.persons,
      perNight: total / p.nights,
      perPersonPerNight: total / p.persons / p.nights
    };
  }

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var persons = num(E('rb-persons').value) || 0;
    var nights = num(E('rb-nights').value) || 0;
    var hotel = num(E('rb-hotel').value);      // €/Nacht pro Zimmer
    var food = num(E('rb-food').value) || 28;  // €/Person/Tag
    var transport = num(E('rb-transport').value); // € gesamt
    var local = num(E('rb-local').value) || 8; // €/Person/Tag Stadtverkehr
    var act = num(E('rb-act').value);          // € gesamt

    var r = computeBudget({ persons: persons, nights: nights, hotel: hotel,
      food: food, transport: transport, local: local, act: act });

    if (r.error) {
      output.innerHTML = '<div class="result-warning" role="alert">' +
        (r.error === 'persons'
          ? (DE ? 'Bitte gib eine gültige Anzahl Personen ein (mindestens 1).' : 'Please enter a valid number of people (at least 1).')
          : (DE ? 'Bitte gib eine gültige Anzahl Nächte ein (mindestens 1).' : 'Please enter a valid number of nights (at least 1).')) +
        '</div>';
      return;
    }

    var html = '<div class="result-display" style="display:block">';
    html += '<div class="calc-result-row"><span>🏨 ' + (DE ? 'Hotel (' + r.roomNights + ' Zimmer × ' + nights + ' Nächte)' : 'Hotel (' + r.roomNights + ' room × ' + nights + ' nights)') + '</span><strong>' + fmt(r.hotelCost) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>🍽 ' + (DE ? 'Essen (' + persons + ' Pers. × ' + r.days + ' Tage × ' + fmt(food) + ' €)' : 'Food (' + persons + ' people × ' + r.days + ' days × €' + fmt(food) + ')') + '</span><strong>' + fmt(r.foodCost) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>🚇 ' + (DE ? 'Stadtverkehr vor Ort' : 'Local transport') + '</span><strong>' + fmt(r.localCost) + ' €</strong></div>';
    if (transport > 0) html += '<div class="calc-result-row"><span>✈️ ' + (DE ? 'An-/Abreise' : 'Travelling') + '</span><strong>' + fmt(transport) + ' €</strong></div>';
    if (act > 0) html += '<div class="calc-result-row"><span>🎫 ' + (DE ? 'Aktivitäten / Eintritte' : 'Activities / entry fees') + '</span><strong>' + fmt(act) + ' €</strong></div>';
    html += '<div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:8px"><span>' + (DE ? 'Gesamtbudget' : 'Total budget') + '</span><strong>' + fmt(r.total) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Pro Person' : 'Per person') + '</span><strong>' + fmt(r.perPerson) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Ø pro Nacht' : 'Avg. per night') + '</span><strong>' + fmt(r.perNight) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Ø pro Person pro Nacht' : 'Avg. per person per night') + '</span><strong>' + fmt(r.perPersonPerNight) + ' €</strong></div>';
    html += '</div>';
    output.innerHTML = html;
  }

  function setup() {
    var inputs = E('tool-inputs');
    var output = E('tool-output');
    if (!inputs || !output) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-primary btn-generate';
    btn.textContent = DE ? 'Budget berechnen' : 'Calculate budget';
    inputs.appendChild(btn);
    btn.addEventListener('click', run);
    output.innerHTML = '<p class="text-muted">' + (DE ? 'Trage die Reise-Details ein (Personen, Nächte, Hotel, Essen, Verkehr), um das Gesamt-, Pro-Kopf- und Pro-Nacht-Budget zu berechnen.' : 'Enter the trip details (people, nights, hotel, food, transport) to calculate the total, per-person and per-night budget.') + '</p>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { run: run, computeBudget: computeBudget };
  }
})();
