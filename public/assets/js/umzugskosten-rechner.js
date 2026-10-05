/* ══════════════════════════════════════════════════
   umzugskosten-rechner.js - realistische Einmalkosten eines Umzugs
   100 % client-seitig. Konstanten mit Stand (2026) und Quelle.
   Ziel: Nutzer auf realistische, höhere Gesamtkosten vorbereiten,
   damit der Umzug ohne böse Überraschung klappt.
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
  }
  function num(v) { var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; }
  function fmt(n) { return n.toLocaleString('de-DE', { maximumFractionDigits: 0, minimumFractionDigits: 0 }); }
  var DE = (typeof window.__siteLang === 'undefined') || window.__siteLang === 'de';

  /* Einmalkosten-Konstanten (Quellen und Stand: 2026):
     – Kaution: max. 3 Nettokaltmieten (§ 551 BGB, gesetzliche Obergrenze).
     – Umzugshelfer privat: 18–30 €/h pro Person (umzug-berlin.de, 2026); Default 25 €/h.
     – Etage ohne Aufzug: ca. 30–60 €/Etage Aufschlag (Marktüblichkeit, 2026); Default 40 €/Etage.
     – Halteverbotszone / Parkkosten: ca. 50–250 € (Marktüblichkeit, 2026); Default 150 €.
     – Nachsendeauftrag: ca. 32–35 € (deutsche Post / Portale, 2026); Default 33 €.
     – Umzugskartons: ca. 2–6 €/Stück (LichtBlick / umzugsportal.de, 2026).
     – Kleintransporter: ab ca. 43–60 €/Tag (Autovermietungen, 2026).
     – Kraftstoff: Diesel ~2,32 €/L, Super E10 ~2,29 €/L (ADAC, 09/2026).
     – Umzugsunternehmen Festpreis, lokaler Umzug (bis 50 km) 2026 (umzug-kostenrechner.de):
        1 Zi. 300–600 €, 2 Zi. 500–1.000 €, 3 Zi. 800–1.500 €, 4 Zi. 1.200–2.200 €, 5 Zi./Haus 1.800–3.000 €;
       Fernumzug (ab 200 km): 1 Zi. 600–1.200 €, …, 5 Zi./Haus 3.000–5.500 €.
     – Ummeldung der Wohnung: in den meisten Kommunen kostenlos. */
  var DEPOSIT_MONTHS = 3;
  var VAN_DAY_DEFAULT = 50;
  var BOX_PRICE_DEFAULT = 3.00;
  var FUEL_DEFAULT = 2.32;        // €/L (Diesel, ADAC 09/2026)
  var L_PER_100KM = 9.0;          // typischer Transporter-Verbrauch
  var HELPER_RATE_DEFAULT = 25;   // €/h je Helfer (Spanne 18–30)
  var ETAGE_PER_FLOOR = 40;       // € je zusätzliche Etage ohne Aufzug (Spanne 30–60)
  var HALTVERBOT_COST = 150;      // € Halteverbot/Parken (Spanne 50–250)
  var NACH_SENDE_COST = 33;       // € Nachsendeauftrag (Spanne 32–35)
  var FIRMA_1Z = [550, 1100];     // 1-Zimmer Festpreis (Richtwert, niedrig)
  // Schätzbänder 2026 (umzug-kostenrechner.de) - Mittelwerte je Zimmerklasse
  var FIRMA_BANDS = {
    lokal: { 1: 450, 2: 750, 3: 1150, 4: 1700, 5: 2400 },
    fern:  { 1: 900, 2: 1500, 3: 2150, 4: 3100, 5: 4250 }
  };

  var MT = { // move type
    selbst: 'selbst', firma: 'firma'
  };

  function buildResult() {
    var type = E('uz-type') ? E('uz-type').value : MT.selbst;
    var cold = num(E('uz-cold') ? E('uz-cold').value : '');
    var boxes = num(E('uz-boxes') ? E('uz-boxes').value : '') || 0;
    var boxP = num(E('uz-boxprice') ? E('uz-boxprice').value : '') || BOX_PRICE_DEFAULT;
    var vanDay = num(E('uz-vanday') ? E('uz-vanday').value : '') || VAN_DAY_DEFAULT;
    var vanDays = num(E('uz-vandays') ? E('uz-vandays').value : '') || 1;
    var km = num(E('uz-km') ? E('uz-km').value : '') || 0;
    var fuel = num(E('uz-fuel') ? E('uz-fuel').value : '') || FUEL_DEFAULT;
    var firma = num(E('uz-firma') ? E('uz-firma').value : '') || 0;

    // Arbeit (nur Selbstumzug)
    var helpers = num(E('uz-helpers') ? E('uz-helpers').value : '') || 0;
    var hours = num(E('uz-hours') ? E('uz-hours').value : '') || 0;
    var hrate = num(E('uz-hprate') ? E('uz-hprate').value : '') || HELPER_RATE_DEFAULT;

    // Zuschläge (beide Umzugsarten)
    var floors = num(E('uz-floor') ? E('uz-floor').value : '') || 0;
    var haltverbot = (E('uz-haltverbot') && E('uz-haltverbot').checked) ? true : false;

    // Nebenkosten (beide Umzugsarten)
    var doppelmiete = (E('uz-doppelmiete') && E('uz-doppelmiete').checked) ? true : false;
    var nachsende = (E('uz-nachsende') && E('uz-nachsende').checked) ? true : false;
    var renov = num(E('uz-renov') ? E('uz-renov').value : '') || 0;

    if (isNaN(cold) || cold <= 0) {
      return { error: DE ? 'Bitte gib die Kaltmiete deiner neuen Wohnung ein.' : 'Please enter the cold rent of your new flat.' };
    }
    var deposit = cold * DEPOSIT_MONTHS;
    var items = [];
    items.push({ label: DE ? 'Mietkaution (max. 3 Nettokaltmieten)' : 'Rental deposit (max. 3 cold rents)', value: deposit });

    if (type === MT.firma) {
      // Festpreis: nutzerangabe > Schätzung aus Größe/Entfernung > Richtwert
      var firmaCost;
      if (firma > 0) {
        firmaCost = firma;
      } else {
        var size = E('uz-size') ? E('uz-size').value : '';
        var dist = (E('uz-dist') && E('uz-dist').value === 'fern') ? 'fern' : 'lokal';
        if (FIRMA_BANDS[dist] && FIRMA_BANDS[dist][size]) {
          firmaCost = FIRMA_BANDS[dist][size];
        } else {
          firmaCost = FIRMA_1Z[0];
        }
      }
      items.push({ label: DE ? 'Umzugsunternehmen (Festpreis)' : 'Moving company (fixed price)', value: firmaCost });
    } else {
      var boxCost = boxes * boxP;
      var vanCost = vanDay * vanDays;
      var fuelCost = km / 100 * L_PER_100KM * fuel;
      var laborCost = helpers * hours * hrate;
      if (boxCost > 0) items.push({ label: DE ? 'Umzugskartons' : 'Moving boxes', value: boxCost });
      if (vanCost > 0) items.push({ label: DE ? 'Transporter-Miete' : 'Van rental', value: vanCost });
      if (km > 0) items.push({ label: DE ? 'Kraftstoff' : 'Fuel', value: fuelCost });
      if (laborCost > 0) items.push({ label: DE ? 'Umzugshelfer (Lohn)' : 'Moving helpers (labour)', value: laborCost });
    }

    // Zuschläge
    var floorCost = floors * ETAGE_PER_FLOOR;
    if (floorCost > 0) items.push({ label: DE ? 'Etage ohne Aufzug' : 'Floor without elevator', value: floorCost });
    if (haltverbot) items.push({ label: DE ? 'Halteverbotszone / Parken' : 'No-parking zone / parking', value: HALTVERBOT_COST });

    // Nebenkosten
    if (doppelmiete) items.push({ label: DE ? 'Doppelmiete (ca. 1 Monatskaltmiete)' : 'Double rent (approx. 1 month)', value: cold });
    if (nachsende) items.push({ label: DE ? 'Nachsendeauftrag' : 'Mail forwarding', value: NACH_SENDE_COST });
    if (renov > 0) items.push({ label: DE ? 'Renovierung der alten Wohnung' : 'Renovation of the old flat', value: renov });

    return { type: type, deposit: deposit, items: items, cold: cold, labor: (helpers * hours * hrate) };
  }

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var r = buildResult();
    if (r.error) {
      output.innerHTML = '<div class="result-display"><p class="text-muted">' + esc(r.error) + '</p></div>';
      return;
    }
    var total = 0;
    r.items.forEach(function(it) { total += it.value; });
    var html = '<div class="result-display">';
    r.items.forEach(function(it) {
      html += '<div class="calc-result-row"><span>' + esc(it.label) + '</span><strong>' + fmt(it.value) + ' €</strong></div>';
    });
    html += '<div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:8px"><span><strong>' + (DE ? 'Einmalkosten gesamt' : 'Total one-off costs') + '</strong></span><strong>' + fmt(total) + ' €</strong></div>';
    if (r.type === MT.firma) {
      html += '<p class="calculator-note" style="margin-top:12px;font-size:0.78rem;color:var(--text-muted)">' + (DE
        ? 'Ein typischer Privatumzug mit Firma liegt 2026 bei 300 bis 3.500 € und mehr. Lokal (bis 50 km) kosten 1–2 Zimmer etwa 450–1.000 €, 3–4 Zimmer etwa 1.150–2.200 €; Fernumzüge (ab 200 km) starten höher. Schätze den Festpreis über die Wohnungsgröße oder hol mindestens 3 Angebote ein. Zuschläge wie Etage ohne Aufzug und Halteverbotszone kommen oft dazu.'
        : 'A typical move with a company ranged roughly 300 to 3,500 € and up in 2026. Local (up to 50 km), 1–2 rooms cost about 450–1,000 €, 3–4 rooms about 1,150–2,200 €; long-distance moves start higher. Estimate the price via the flat size or get at least 3 quotes. Surcharges like a floor without elevator and a no-parking zone are common.') + '</p>';
    } else {
      html += '<p class="calculator-note" style="margin-top:12px;font-size:0.78rem;color:var(--text-muted)">' + (DE
        ? 'Privater Helfer: 18–30 €/h pro Person (2026), hier als Stundensatz anpassbar. Etage ohne Aufzug: ca. 40 € je Etage. Zuschläge und Nebenkosten wie Doppelmiete oder Renovierung lassen sich oben aktivieren, damit du realistisch kalkulierst. Kraftstoff-Default: Diesel 2,32 €/L (ADAC, Stand 09/2026), im Feld oben anpassbar.'
        : 'Private helper: 18–30 €/h per person (2026), adjustable above. Floor without elevator: about 40 € per floor. Switch on surcharges and side costs such as double rent or renovation above to plan realistically. Fuel default: diesel 2.32 €/L (ADAC, as of 09/2026), adjustable in the field above.') + '</p>';
    }
    html += '</div>';
    output.innerHTML = html;

    // Playbook integration: report this finished step (client-side only),
    // so the flow stores progress and offers the next step.
    if (total > 0 && window.playbook) window.playbook.report({
      tool: 'umzugskosten-rechner',
      summary: (DE ? 'Umzugskosten: ' : 'Moving costs: ') + fmt(total) + ' €',
      value: total,
      fields: { umzugskosten: total }
    });
  }

  function setup() {
    var inputs = E('tool-inputs');
    var output = E('tool-output');
    if (!inputs || !output) return;

    // Show/hide relevant fields per move type
    function toggle() {
      var type = E('uz-type') ? E('uz-type').value : MT.selbst;
      ['uz-boxes','uz-boxprice'].forEach(function(id){
        var f = E(id); if (f) f.style.display = (type === MT.selbst ? '' : 'none');
      });
      ['uz-vanday','uz-vandays'].forEach(function(id){
        var f = E(id); if (f) f.style.display = (type === MT.selbst ? '' : 'none');
      });
      var kmF = E('uz-km'), fuelF = E('uz-fuel');
      if (kmF) kmF.style.display = (type === MT.selbst ? '' : 'none');
      if (fuelF) fuelF.style.display = (type === MT.selbst ? '' : 'none');
      var firmaF = E('uz-firma');
      if (firmaF) firmaF.style.display = (type === MT.firma ? '' : 'none');
      ['uz-helpers','uz-hours','uz-hprate'].forEach(function(id){
        var f = E(id); if (f) f.style.display = (type === MT.selbst ? '' : 'none');
      });
      var sizeF = E('uz-size'), distF = E('uz-dist');
      if (sizeF) sizeF.style.display = (type === MT.firma ? '' : 'none');
      if (distF) distF.style.display = (type === MT.firma ? '' : 'none');
      var floorF = E('uz-floor'), haltF = E('uz-haltverbot');
      if (floorF) floorF.style.display = (type === MT.selbst || type === MT.firma ? '' : 'none');
      if (haltF) haltF.style.display = (type === MT.selbst || type === MT.firma ? '' : 'none');
      var doppF = E('uz-doppelmiete'), nachF = E('uz-nachsende'), renF = E('uz-renov');
      if (doppF) doppF.style.display = (type === MT.selbst || type === MT.firma ? '' : 'none');
      if (nachF) nachF.style.display = (type === MT.selbst || type === MT.firma ? '' : 'none');
      if (renF) renF.style.display = (type === MT.selbst || type === MT.firma ? '' : 'none');
    }
    var sel = E('uz-type');
    if (sel) {
      sel.addEventListener('change', toggle);
    }

    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-primary btn-generate';
    btn.textContent = DE ? 'Umzugskosten berechnen' : 'Calculate moving costs';
    inputs.appendChild(btn);
    btn.addEventListener('click', run);
    toggle();
    output.innerHTML = '<p class="text-muted">' + (DE ? 'Wähle deine Umzugsart, trage die Kaltmiete deiner neuen Wohnung ein und passe die Details an. Aktiviere Zuschläge (Etage ohne Aufzug, Halteverbotszone) und Nebenkosten (Doppelmiete, Nachsendeauftrag, Renovierung), um ein realistisches Gesamtbild zu bekommen. Dann klicke auf „Umzugskosten berechnen“.' : 'Choose your move type, enter the cold rent of your new flat and adjust the details. Switch on surcharges (floor without elevator, no-parking zone) and side costs (double rent, mail forwarding, renovation) for a realistic overall picture. Then click \"Calculate moving costs\".') + '</p>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildResult: buildResult, DEPOSIT_MONTHS: DEPOSIT_MONTHS, MT: MT, HELPER_RATE_DEFAULT: HELPER_RATE_DEFAULT, ETAGE_PER_FLOOR: ETAGE_PER_FLOOR, HALTVERBOT_COST: HALTVERBOT_COST, NACH_SENDE_COST: NACH_SENDE_COST, FIRMA_BANDS: FIRMA_BANDS };
  }
})();
